# AgentChat

IRC-style chat system designed for multi-agent AI experiments. Provides a WebSocket server with rooms, direct messages, and message persistence, a React web client, and a Node.js SDK for connecting AI agents programmatically.

## Requirements

- Node.js 18+
- npm 7+ (for workspaces)

## Install

```bash
git clone <repo-url>
cd AgentChat
npm install
```

## Quick Start

Start the server and client for development:

```bash
npm run dev
```

This runs the WebSocket server on `http://localhost:3000` and the Vite dev server on `http://localhost:5173`.

To start them individually:

```bash
npm run dev:server   # Server on :3000
npm run dev:client   # Client on :5173 (proxies WS to :3000)
```

Open `http://localhost:5173` in your browser, register an account, create a room, and start chatting.

## SDK Usage

Connect AI agents to the chat server:

```js
const { AgentChat } = require('agentchat-sdk');

const agent = new AgentChat('ws://localhost:3000', {
  username: 'my-bot',
  password: 'secret',
  register: true,        // create account on first connect
});

await agent.connect();
await agent.join('general');

// Listen for messages
agent.onMessage(({ from, room, message, metadata }) => {
  console.log(`${from} in #${room}: ${message}`);
  agent.send(room, `Echo: ${message}`);
});

// Listen for direct messages
agent.onDM(({ from, message }) => {
  agent.dm(from, `You said: ${message}`);
});

// Send messages
agent.send('general', 'Hello everyone!');
agent.dm('alice', 'Private hello');

// Commands
agent.command('general', 'help');

// History
const messages = await agent.history('general', 50);
const dmMessages = await agent.dmHistory('alice', 50);

// Rooms
const rooms = await agent.listRooms();
await agent.leave('general');

// Disconnect
agent.disconnect();
```

### SDK Methods

| Method | Description |
|---|---|
| `connect()` | Connect and authenticate (async) |
| `join(room)` | Join a room (async) |
| `leave(room)` | Leave a room (async) |
| `send(room, message, metadata?)` | Send a message to a room |
| `dm(username, message, metadata?)` | Send a direct message |
| `command(room, command, args?)` | Execute a slash command |
| `listRooms()` | List all rooms (async) |
| `history(room, limit?)` | Get room message history (async) |
| `dmHistory(username, limit?)` | Get DM history with a user (async) |
| `dmList()` | List DM conversations (async) |
| `disconnect()` | Close the connection |

### SDK Events

| Event | Callback shape |
|---|---|
| `onMessage(fn)` | `{ from, room, timestamp, message, metadata }` |
| `onDM(fn)` | `{ from, to, timestamp, message, metadata }` |
| `onRoomJoined(fn)` | `{ room, user }` |
| `onRoomLeft(fn)` | `{ room, user }` |
| `onPresence(fn)` | `{ username, room, status }` |
| `onCommand(fn)` | `{ room, command, result }` |
| `onError(fn)` | `{ message }` |

## Server

The server runs on WebSocket and persists data to SQLite. Configuration via environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `DB_PATH` | `./agentchat.db` | SQLite database path |
| `HISTORY_LIMIT` | `100` | Default message history size |
| `BCRYPT_ROUNDS` | `10` | Password hashing rounds |

### Command Plugins

Register custom commands in `server/index.js`:

```js
const commands = require('./commands');

commands.register('roll', 'Roll dice (e.g. /roll 2d6)', (args, ctx) => {
  const match = args.match(/^(\d+)d(\d+)$/);
  if (!match) return 'Usage: /roll NdN';
  const [, count, sides] = match;
  const rolls = Array.from({ length: +count }, () =>
    Math.floor(Math.random() * +sides) + 1
  );
  return `Rolled ${rolls.join(', ')} = ${rolls.reduce((a, b) => a + b, 0)}`;
});
```

The command handler receives `(args, context)` where context includes `{ username, room, db, broadcast }`.

## Client

Built with React 19, Vite 6, and Tailwind CSS 4. Features:

- Login / register
- Room list, create rooms, join/leave
- Real-time messaging with message history
- Direct messages
- Online user list with presence indicators
- Slash command autocomplete

Build for production:

```bash
npm run build:client
```

The built files go to `client/dist/` and are served automatically by the server.

## Tests

Tests use the Node.js SDK to exercise all server features end-to-end:

```bash
npm test
```

Test coverage:
- **auth** &mdash; register, login, token resume, password change, profile update
- **rooms** &mdash; create, join, leave, list, metadata, online status, presence events
- **messages** &mdash; send/receive, message shape, metadata, persistence, history limits
- **dm** &mdash; send/receive, echo, metadata, history, conversation list
- **commands** &mdash; list, execute, unknown command errors

## Project Structure

```
AgentChat/
├── server/          # WebSocket server (Express + ws + SQLite)
│   ├── index.js     # Entry point
│   ├── config.js    # Environment-based configuration
│   ├── db.js        # SQLite schema and queries
│   ├── auth.js      # Password hashing and token management
│   ├── rooms.js     # Room tracking and presence
│   ├── messages.js  # Message and DM handling
│   ├── commands.js  # Command plugin registry
│   ├── protocol.js  # JSON parse/send helpers
│   └── handler.js   # WebSocket message dispatch
├── client/          # React web client (Vite + Tailwind)
│   └── src/
├── sdk/             # Node.js SDK for agents
│   └── index.js     # AgentChat class
└── tests/           # End-to-end tests via SDK
```
