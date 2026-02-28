const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const rooms = require('./rooms');
const protocol = require('./protocol');

function handleSendMessage(ws, msg) {
  const { room, message, metadata } = msg;
  if (!room || !message) {
    return protocol.send(ws, { type: 'system:error', message: 'Missing room or message' });
  }

  if (!ws.rooms || !ws.rooms.has(room)) {
    return protocol.send(ws, { type: 'system:error', message: 'You have not joined this room' });
  }

  const id = uuidv4();
  const timestamp = Date.now();
  const outMsg = {
    type: 'message:new',
    id,
    from: ws.user,
    room,
    timestamp,
    message,
    metadata: metadata || {},
  };

  db.saveMessage(id, room, ws.user, message, metadata || {}, timestamp);
  rooms.broadcastToRoom(room, outMsg);
}

function handleDMSend(ws, msg, allClients) {
  const { to, message, metadata } = msg;
  if (!to || !message) {
    return protocol.send(ws, { type: 'system:error', message: 'Missing recipient or message' });
  }

  const recipient = db.getUser(to);
  if (!recipient) {
    return protocol.send(ws, { type: 'system:error', message: 'User not found' });
  }

  const id = uuidv4();
  const timestamp = Date.now();
  const outMsg = {
    type: 'dm:new',
    id,
    from: ws.user,
    to,
    timestamp,
    message,
    metadata: metadata || {},
  };

  db.saveDM(id, ws.user, to, message, metadata || {}, timestamp);

  // Send to recipient if online
  const recipientWs = rooms.findUserWs(to, allClients);
  if (recipientWs) protocol.send(recipientWs, outMsg);

  // Echo back to sender
  protocol.send(ws, outMsg);
}

module.exports = { handleSendMessage, handleDMSend };
