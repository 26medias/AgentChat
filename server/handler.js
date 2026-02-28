const protocol = require('./protocol');
const auth = require('./auth');
const db = require('./db');
const rooms = require('./rooms');
const messages = require('./messages');
const commands = require('./commands');
const config = require('./config');

const RESERVED_USERNAMES = ['system'];

function setup(wss) {
  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.user = null;
    ws.rooms = new Set();

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', async (raw) => {
      const msg = protocol.parse(raw);
      if (!msg || !msg.type) {
        return protocol.send(ws, { type: 'system:error', message: 'Invalid message' });
      }

      // Auth messages
      if (msg.type.startsWith('auth:')) return handleAuth(ws, msg);

      // Everything else requires authentication
      if (!ws.user) {
        return protocol.send(ws, { type: 'system:error', message: 'Not authenticated' });
      }

      if (msg.type.startsWith('room:')) return handleRoom(ws, msg);
      if (msg.type.startsWith('message:')) return handleMessage(ws, msg);
      if (msg.type.startsWith('dm:')) return handleDM(ws, msg, wss.clients);
      if (msg.type.startsWith('command:')) return handleCommand(ws, msg);
      if (msg.type === 'ping') return protocol.send(ws, { type: 'pong' });
    });

    ws.on('close', () => {
      const leftRooms = rooms.leaveAllRooms(ws);
      if (ws.user) {
        for (const room of leftRooms) {
          rooms.broadcastToRoom(room, {
            type: 'presence:offline',
            username: ws.user,
            room,
          });
        }
      }
    });
  });

  // Heartbeat
  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, config.HEARTBEAT_INTERVAL);

  wss.on('close', () => clearInterval(interval));
}

async function handleAuth(ws, msg) {
  switch (msg.type) {
    case 'auth:register': {
      const { username, password } = msg;
      if (!username || !password) {
        return protocol.send(ws, { type: 'auth:error', message: 'Username and password required' });
      }
      if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
        return protocol.send(ws, { type: 'auth:error', message: 'Username is reserved' });
      }
      if (db.getUser(username)) {
        return protocol.send(ws, { type: 'auth:error', message: 'Username already taken' });
      }
      const hashed = await auth.hashPassword(password);
      db.createUser(username, hashed);
      const token = auth.createToken(username);
      ws.user = username;
      const user = db.getUser(username);
      protocol.send(ws, {
        type: 'auth:success',
        token,
        user: { username: user.username, avatar: user.avatar, about: user.about },
      });
      break;
    }

    case 'auth:login': {
      const { username, password } = msg;
      if (!username || !password) {
        return protocol.send(ws, { type: 'auth:error', message: 'Username and password required' });
      }
      const user = db.getUser(username);
      if (!user) {
        return protocol.send(ws, { type: 'auth:error', message: 'Invalid credentials' });
      }
      const valid = await auth.verifyPassword(password, user.password);
      if (!valid) {
        return protocol.send(ws, { type: 'auth:error', message: 'Invalid credentials' });
      }
      const token = auth.createToken(username);
      ws.user = username;
      protocol.send(ws, {
        type: 'auth:success',
        token,
        user: { username: user.username, avatar: user.avatar, about: user.about },
      });
      break;
    }

    case 'auth:resume': {
      const { token } = msg;
      const username = auth.verifyToken(token);
      if (!username) {
        return protocol.send(ws, { type: 'auth:error', message: 'Invalid or expired token' });
      }
      ws.user = username;
      const user = db.getUser(username);
      protocol.send(ws, {
        type: 'auth:success',
        token,
        user: { username: user.username, avatar: user.avatar, about: user.about },
      });
      break;
    }

    case 'auth:change_password': {
      if (!ws.user) {
        return protocol.send(ws, { type: 'auth:error', message: 'Not authenticated' });
      }
      const { oldPassword, newPassword } = msg;
      const user = db.getUser(ws.user);
      const valid = await auth.verifyPassword(oldPassword, user.password);
      if (!valid) {
        return protocol.send(ws, { type: 'auth:error', message: 'Incorrect current password' });
      }
      const hashed = await auth.hashPassword(newPassword);
      db.updatePassword(ws.user, hashed);
      protocol.send(ws, { type: 'auth:success', message: 'Password changed' });
      break;
    }

    case 'auth:update_profile': {
      if (!ws.user) {
        return protocol.send(ws, { type: 'auth:error', message: 'Not authenticated' });
      }
      const { avatar, about } = msg;
      const user = db.getUser(ws.user);
      db.updateProfile(ws.user, avatar ?? user.avatar, about ?? user.about);
      const updated = db.getUser(ws.user);
      protocol.send(ws, {
        type: 'auth:profile_updated',
        user: { username: updated.username, avatar: updated.avatar, about: updated.about },
      });
      break;
    }
  }
}

function handleRoom(ws, msg) {
  switch (msg.type) {
    case 'room:list': {
      const allRooms = db.getRooms();
      const result = allRooms.map(r => ({
        name: r.name,
        description: r.description,
        metadata: r.metadata,
        userCount: rooms.getOnlineUsers(r.name).length,
      }));
      protocol.send(ws, { type: 'room:list', rooms: result });
      break;
    }

    case 'room:create': {
      const { name, description, metadata } = msg;
      if (!name) {
        return protocol.send(ws, { type: 'room:error', message: 'Room name required' });
      }
      if (db.getRoom(name)) {
        return protocol.send(ws, { type: 'room:error', message: 'Room already exists' });
      }
      db.createRoom(name, description || '', metadata || {}, ws.user);
      const room = db.getRoom(name);
      protocol.send(ws, { type: 'room:created', room });
      break;
    }

    case 'room:join': {
      const { room } = msg;
      if (!room) {
        return protocol.send(ws, { type: 'room:error', message: 'Room name required' });
      }
      if (!db.getRoom(room)) {
        return protocol.send(ws, { type: 'room:error', message: 'Room does not exist' });
      }
      db.addRoomMember(room, ws.user);
      rooms.joinRoom(ws, room);
      rooms.broadcastToRoom(room, { type: 'room:joined', room, user: ws.user });
      protocol.send(ws, { type: 'room:joined', room, user: ws.user });
      break;
    }

    case 'room:leave': {
      const { room } = msg;
      if (!room) {
        return protocol.send(ws, { type: 'room:error', message: 'Room name required' });
      }
      rooms.broadcastToRoom(room, { type: 'room:left', room, user: ws.user });
      rooms.leaveRoom(ws, room);
      db.removeRoomMember(room, ws.user);
      protocol.send(ws, { type: 'room:left', room, user: ws.user });
      break;
    }

    case 'room:users': {
      const { room } = msg;
      if (!room) {
        return protocol.send(ws, { type: 'room:error', message: 'Room name required' });
      }
      const onlineUsers = rooms.getOnlineUsers(room);
      const users = onlineUsers.map(username => {
        const u = db.getUser(username);
        return { username, avatar: u ? u.avatar : '', online: true };
      });
      protocol.send(ws, { type: 'room:users', room, users });
      break;
    }

    case 'room:history': {
      const { room, limit } = msg;
      if (!room) {
        return protocol.send(ws, { type: 'room:error', message: 'Room name required' });
      }
      const history = db.getMessages(room, limit || config.HISTORY_LIMIT);
      protocol.send(ws, { type: 'room:history', room, messages: history });
      break;
    }
  }
}

function handleMessage(ws, msg) {
  if (msg.type === 'message:send') {
    messages.handleSendMessage(ws, msg);
  }
}

function handleDM(ws, msg, allClients) {
  switch (msg.type) {
    case 'dm:send':
      messages.handleDMSend(ws, msg, allClients);
      break;

    case 'dm:history': {
      const { with: withUser, limit } = msg;
      if (!withUser) {
        return protocol.send(ws, { type: 'system:error', message: 'Missing user' });
      }
      const history = db.getDMs(ws.user, withUser, limit || config.HISTORY_LIMIT);
      protocol.send(ws, { type: 'dm:history', with: withUser, messages: history });
      break;
    }

    case 'dm:list': {
      const conversations = db.getDMConversations(ws.user);
      protocol.send(ws, { type: 'dm:list', conversations });
      break;
    }
  }
}

async function handleCommand(ws, msg) {
  switch (msg.type) {
    case 'command:send': {
      const { room, command, args } = msg;
      if (!command) {
        return protocol.send(ws, { type: 'command:error', message: 'Missing command' });
      }
      const result = await commands.execute(command, args || '', {
        username: ws.user,
        room,
        db,
        broadcast: (r, obj) => rooms.broadcastToRoom(r, obj),
      });
      if (result === null) {
        protocol.send(ws, { type: 'command:error', command, message: 'Unknown command' });
      } else {
        protocol.send(ws, { type: 'command:result', room, command, result });
      }
      break;
    }

    case 'command:list': {
      protocol.send(ws, { type: 'command:list', commands: commands.list() });
      break;
    }
  }
}

module.exports = { setup };
