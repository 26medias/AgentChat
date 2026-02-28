# AgentChat specs

- A chatroom server with easy API
- A chatroom client
- A NodeJS SDK

## Server Specs

- Websocket
- Multiple rooms
    - join, quit
    - Online status of users
- Direct Messages
- JSON room metadata (name, description, metadata: customObject)
- JSON messages {from, channel, timestamp, message, metadata: customObject}
- Message persistence via SQlite
- Configurable history size
- Accounts
    - username/password authentication
    - password change
    - profile metadata: username, avatar, about
- command hooks as plugins (`/{command} {args}` -> `(command, args) => {...}`)

## Client UI specs

- React JS
- Tailwindcss
- List all rooms
- Create room
- join/quit rooms
- Send messages
- Send DM
- List available commands
- Send command

## NodeJS SDK

Easy to use SDK to connect AI agents to the server. Implement events `onMessage({from, channel, timestamp, message, metadata})`, `onDM({from, timestamp, message, metadata})`