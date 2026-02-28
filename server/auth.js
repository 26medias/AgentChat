const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

// In-memory token store: token -> username
const tokens = new Map();

async function hashPassword(plain) {
  return bcrypt.hash(plain, config.BCRYPT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function createToken(username) {
  const token = uuidv4();
  tokens.set(token, username);
  return token;
}

function verifyToken(token) {
  return tokens.get(token) || null;
}

function revokeToken(token) {
  tokens.delete(token);
}

module.exports = { hashPassword, verifyPassword, createToken, verifyToken, revokeToken };
