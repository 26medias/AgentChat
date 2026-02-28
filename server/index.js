const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const config = require('./config');
const db = require('./db');
const handler = require('./handler');

const app = express();
const server = http.createServer(app);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve built client in production
app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));

// Initialize database
db.init();

// WebSocket server
const wss = new WebSocketServer({ server });
handler.setup(wss);

server.listen(config.PORT, () => {
  console.log(`AgentChat server running on port ${config.PORT}`);
});
