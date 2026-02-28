const protocol = require('./protocol');

// roomName -> Set<ws>
const roomConnections = new Map();

function joinRoom(ws, roomName) {
  if (!roomConnections.has(roomName)) {
    roomConnections.set(roomName, new Set());
  }
  roomConnections.get(roomName).add(ws);

  if (!ws.rooms) ws.rooms = new Set();
  ws.rooms.add(roomName);
}

function leaveRoom(ws, roomName) {
  const conns = roomConnections.get(roomName);
  if (conns) {
    conns.delete(ws);
    if (conns.size === 0) roomConnections.delete(roomName);
  }

  if (ws.rooms) ws.rooms.delete(roomName);
}

function leaveAllRooms(ws) {
  if (!ws.rooms) return [];
  const rooms = [...ws.rooms];
  for (const room of rooms) {
    leaveRoom(ws, room);
  }
  return rooms;
}

function broadcastToRoom(roomName, obj, excludeWs) {
  const conns = roomConnections.get(roomName);
  if (!conns) return;
  const data = JSON.stringify(obj);
  for (const ws of conns) {
    if (ws !== excludeWs && ws.readyState === 1) {
      ws.send(data);
    }
  }
}

function getOnlineUsers(roomName) {
  const conns = roomConnections.get(roomName);
  if (!conns) return [];
  const users = [];
  for (const ws of conns) {
    if (ws.user) users.push(ws.user);
  }
  return [...new Set(users)];
}

function findUserWs(username, allClients) {
  for (const ws of allClients) {
    if (ws.user === username && ws.readyState === 1) return ws;
  }
  return null;
}

module.exports = { joinRoom, leaveRoom, leaveAllRooms, broadcastToRoom, getOnlineUsers, findUserWs };
