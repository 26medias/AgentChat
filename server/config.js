const path = require('path');

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  DB_PATH: process.env.DB_PATH || path.join(__dirname, 'agentchat.db'),
  HISTORY_LIMIT: parseInt(process.env.HISTORY_LIMIT, 10) || 100,
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
  HEARTBEAT_INTERVAL: 30000,
};
