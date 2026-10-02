import { WebSocketServer } from "ws";
import express from "express";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js"; // Fixed: named import
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

  ws.on("message", async (rawData) => {
    try {
      const { type, payload } = JSON.parse(rawData);

      switch (type) {
        case "JOIN_ROOM": { // Added block scope
          if (ws.currentRoom && activeRooms.has(ws.currentRoom)) {
            activeRooms.get(ws.currentRoom).delete(ws);
          }
          
          ws.currentRoom = payload.roomId;

          if (!activeRooms.has(payload.roomId)) {
            activeRooms.set(payload.roomId, new Set());
          }
          activeRooms.get(payload.roomId).add(ws);

          ws.send(JSON.stringify({ type: "JOIN_SUCCESS", message: `Joined room ${payload.roomId}` }));

          const { data: history, error: historyError } = await supabase
            .from('messages')
            .select('id, sender_id, content, created_at')
            .eq('room_id', payload.roomId)
            .order('created_at', { ascending: true })
            .limit(50);

          if (historyError) {
            ws.send(JSON.stringify({ error: "Failed to fetch room history" }));
          } else {
            ws.send(JSON.stringify({ type: "ROOM_HISTORY", payload: history }));
          }
          break;
        }

        case "SEND_MESSAGE": { // Added block scope
          if (!ws.currentRoom) {
            ws.send(JSON.stringify({ error: "You must join a room before sending messages" }));
            return;
          }

          // Fixed: Added .select() to return the saved row
          const { data: savedMessages, error: sendError } = await supabase
            .from('messages')
            .insert([
              {
                room_id: ws.currentRoom,
                sender_id: ws.user.id,
                content: payload.content
              }
            ])
            .select();

          if (sendError || !savedMessages) {
            ws.send(JSON.stringify({ error: "Failed to send message" }));
          } else {
            const newMessage = savedMessages[0];
            const messageFrame = JSON.stringify({ type: "NEW_MESSAGE", payload: newMessage });

            // Broadcast to all active connections in this room
            const roomMembers = activeRooms.get(ws.currentRoom);
            if (roomMembers) {
              for (const clientSocket of roomMembers) {
                if (clientSocket.readyState === 1) { // 1 = OPEN
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

  // Handle client disconnects to clean up room sets
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