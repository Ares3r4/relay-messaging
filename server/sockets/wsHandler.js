import { supabase } from "../supabaseClient.js";
import { 
  addSocketToRoom, 
  removeSocketFromRoom, 
  broadcastToRoom,
  getRoomUsers 
} from "./roomManager.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUUID = (str) => typeof str === "string" && UUID_REGEX.test(str);

export const setupWebSocketServer = (wss) => {
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.warn("[HEARTBEAT] Terminating unresponsive socket connection");
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  wss.on("connection", async (ws, req) => {
    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    const host = req.headers.host || "localhost";
    const requestUrl = new URL(req.url || "", `http://${host}`);
    
    let token = requestUrl.searchParams.get("token");
    if (token) {
      token = token.replace(/^Bearer\s+/i, "").trim();
    }

    if (!token) {
      ws.close(4001, "Unauthorized: Token missing");
      return;
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      ws.close(4001, `Unauthorized: ${authError?.message || "Invalid token"}`);
      return;
    }

    ws.user = user;
    ws.currentRoom = null;   
    ws.currentRoomId = null; 

    const leaveCurrentRoom = () => {
      if (ws.currentRoomId) {
        const oldRoomId = ws.currentRoomId;
        removeSocketFromRoom(oldRoomId, ws);

        broadcastToRoom(oldRoomId, {
          type: "USER_LEFT",
          payload: {
            user: { id: ws.user.id, email: ws.user.email },
            activeUsers: getRoomUsers(oldRoomId)
          }
        });

        ws.currentRoom = null;
        ws.currentRoomId = null;
      }
    };

    ws.on("message", async (rawData) => {
      try {
        const { type, payload } = JSON.parse(rawData);

        switch (type) {
          case "JOIN_ROOM": {
            const roomInput = payload.roomId;
            let dbRoomId = null;

            if (isUUID(roomInput)) {
              dbRoomId = roomInput;
            } else {
              const { data: room } = await supabase
                .from("rooms")
                .select("id")
                .ilike("name", roomInput)
                .maybeSingle();

              if (room?.id) {
                dbRoomId = room.id;
              } else {
                const { data: newRoom, error: createError } = await supabase
                  .from("rooms")
                  .insert([{ name: roomInput }])
                  .select("id")
                  .single();

                if (createError || !newRoom?.id) {
                  console.error("[JOIN_ROOM] Creation error:", createError?.message);
                  ws.send(JSON.stringify({ error: `Room "${roomInput}" not found and creation failed.` }));
                  return;
                }
                dbRoomId = newRoom.id;
              }
            }

            leaveCurrentRoom();

            ws.currentRoom = roomInput;
            ws.currentRoomId = dbRoomId;

            addSocketToRoom(dbRoomId, ws);

            const activeUsers = getRoomUsers(dbRoomId);

            ws.send(JSON.stringify({ 
              type: "JOIN_SUCCESS", 
              message: `Joined room ${roomInput}`, 
              roomId: dbRoomId,
              users: activeUsers
            }));

            broadcastToRoom(dbRoomId, {
              type: "USER_JOINED",
              payload: {
                user: { id: ws.user.id, email: ws.user.email },
                activeUsers
              }
            }, ws);

            const { data: history, error: historyError } = await supabase
              .from("messages")
              .select("id, sender_id, content, created_at")
              .eq("room_id", ws.currentRoomId)
              .order("created_at", { descending: true })
              .limit(50);

            if (historyError) {
              console.error("[JOIN_ROOM] History error:", historyError.message);
              ws.send(JSON.stringify({ error: "Failed to fetch room history" }));
            } else {
              ws.send(JSON.stringify({ type: "ROOM_HISTORY", payload: history }));
            }
            break;
          }

          case "SEND_MESSAGE": {
            if (!ws.currentRoomId) {
              ws.send(JSON.stringify({ error: "You must join a room before sending messages" }));
              return;
            }

            const { data: savedMessages, error: sendError } = await supabase
              .from("messages")
              .insert([
                {
                  room_id: ws.currentRoomId,
                  sender_id: ws.user.id,
                  content: payload.content
                }
              ])
              .select();

            if (sendError || !savedMessages?.length) {
              console.error("[SEND_MESSAGE] Supabase insert failed:", sendError);
              ws.send(JSON.stringify({ error: `Failed to send message: ${sendError?.message}` }));
            } else {
              const newMessage = savedMessages[0];
              broadcastToRoom(ws.currentRoomId, {
                type: "NEW_MESSAGE",
                payload: newMessage
              });
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
      leaveCurrentRoom();
    });
  });
};