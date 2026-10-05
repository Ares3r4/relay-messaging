import { WebSocketServer } from "ws";
import express from "express";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js";
import { createServer } from "node:http";
import signupRouter from "./api/signup.js";
import loginRouter from "./api/login.js";

dotenv.config();

const app = express();
app.use(express.json());

app.use("/api/signup", signupRouter);
app.use("/api/login", loginRouter);

const server = createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 8080;

const activeRooms = new Map();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUUID = (str) => typeof str === "string" && UUID_REGEX.test(str);

wss.on("connection", async (ws, req) => {
  const urlParams = new URLSearchParams(req.url?.split('?')[1]);
  const token = urlParams.get('token');

  if (!token) {
    ws.close(4001, "Unauthorized: Token missing");
    return;
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    ws.close(4001, "Unauthorized");
    return;
  }

  ws.user = user;
  ws.currentRoom = null;   
  ws.currentRoomId = null; 

  ws.on("message", async (rawData) => {
    try {
      const { type, payload } = JSON.parse(rawData);

      switch (type) {
        case "JOIN_ROOM": {
          const roomInput = payload.roomId;
          let dbRoomId = roomInput;

          if (!isUUID(roomInput)) {
            // Match against 'name' column (case-insensitive)
            const { data: room, error: roomError } = await supabase
              .from('rooms')
              .select('id')
              .ilike('name', roomInput)
              .maybeSingle();

            if (roomError) {
              console.error(`[JOIN_ROOM] Query error: ${roomError.message}`);
            }

            if (room?.id) {
              dbRoomId = room.id;
            } else {
              console.warn(`[JOIN_ROOM] No room row found in 'rooms' table with name = "${roomInput}"`);
            }
          }

          if (ws.currentRoom && activeRooms.has(ws.currentRoom)) {
            activeRooms.get(ws.currentRoom).delete(ws);
          }

          ws.currentRoom = roomInput;
          ws.currentRoomId = dbRoomId;

          if (!activeRooms.has(roomInput)) {
            activeRooms.set(roomInput, new Set());
          }
          activeRooms.get(roomInput).add(ws);

          ws.send(JSON.stringify({ type: "JOIN_SUCCESS", message: `Joined room ${roomInput}` }));

          const { data: history, error: historyError } = await supabase
            .from('messages')
            .select('id, sender_id, content, created_at')
            .eq('id', ws.currentRoomId)
            .order('created_at', { ascending: true })
            .limit(50);

          if (historyError) {
            console.error("[JOIN_ROOM] History fetch error:", historyError.message);
            ws.send(JSON.stringify({ error: "Failed to fetch room history" }));
          } else {
            ws.send(JSON.stringify({ type: "ROOM_HISTORY", payload: history }));
          }
          break;
        }

        case "SEND_MESSAGE": {
          if (!ws.currentRoom || !ws.currentRoomId) {
            ws.send(JSON.stringify({ error: "You must join a room before sending messages" }));
            return;
          }

          const { data: savedMessages, error: sendError } = await supabase
            .from('messages')
            .insert([
              {
                room_id: ws.currentRoomId,
                sender_id: ws.user.id,
                content: payload.content
              }
            ])
            .select();

          if (sendError || !savedMessages?.length) {
            console.error("[SEND_MESSAGE] Supabase insert failed:", {
              roomId: ws.currentRoomId,
              code: sendError?.code,
              message: sendError?.message,
              details: sendError?.details,
              hint: sendError?.hint
            });
            ws.send(JSON.stringify({ error: `Failed to send message: ${sendError?.message}` }));
          } else {
            const newMessage = savedMessages[0];
            const messageFrame = JSON.stringify({ type: "NEW_MESSAGE", payload: newMessage });

            const roomMembers = activeRooms.get(ws.currentRoom);
            if (roomMembers) {
              for (const clientSocket of roomMembers) {
                if (clientSocket.readyState === 1) { 
                  clientSocket.send(messageFrame);
                }
              }
            }
          }
          break;
        }

        default:
          ws.send(JSON.stringify({ error: "Unknown message type" }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ error: "Invalid JSON format received" }));
    }
  });

  ws.on("close", () => {
    if (ws.currentRoom && activeRooms.has(ws.currentRoom)) {
      activeRooms.get(ws.currentRoom).delete(ws);
      if (activeRooms.get(ws.currentRoom).size === 0) {
        activeRooms.delete(ws.currentRoom);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});