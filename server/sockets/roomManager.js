// Room ID -> connected sockets.
const activeRooms = new Map();

export const addSocketToRoom = (roomId, ws) => {
  if (!activeRooms.has(roomId)) {
    activeRooms.set(roomId, new Set());
  }
  activeRooms.get(roomId).add(ws);
};

export const removeSocketFromRoom = (roomId, ws) => {
  if (!roomId || !activeRooms.has(roomId)) return;

  const roomMembers = activeRooms.get(roomId);
  roomMembers.delete(ws);

  if (roomMembers.size === 0) {
    activeRooms.delete(roomId);
  }
};

export const broadcastToRoom = (roomId, payload, excludeSocket = null) => {
  const roomMembers = activeRooms.get(roomId);
  if (!roomMembers) return;

  const messageFrame = typeof payload === "string" ? payload : JSON.stringify(payload);

  for (const clientSocket of roomMembers) {
    if (clientSocket !== excludeSocket && clientSocket.readyState === 1) {
      clientSocket.send(messageFrame);
    }
  }
};

export const getRoomUsers = (roomId) => {
  const roomMembers = activeRooms.get(roomId);
  if (!roomMembers) return [];

  const users = [];
  const seenUserIds = new Set();

  for (const ws of roomMembers) {
    if (ws.user && !seenUserIds.has(ws.user.id)) {
      seenUserIds.add(ws.user.id);
      users.push({
        id: ws.user.id,
        email: ws.user.email,
        user_metadata: ws.user.user_metadata || {}
      });
    }
  }

  return users;
};