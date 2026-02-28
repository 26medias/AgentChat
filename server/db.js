const Database = require('better-sqlite3');
const config = require('./config');

let db;

function init() {
  db = new Database(config.DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      username   TEXT PRIMARY KEY,
      password   TEXT NOT NULL,
      avatar     TEXT DEFAULT '',
      about      TEXT DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rooms (
      name        TEXT PRIMARY KEY,
      description TEXT DEFAULT '',
      metadata    TEXT DEFAULT '{}',
      created_by  TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(username)
    );

    CREATE TABLE IF NOT EXISTS room_members (
      room      TEXT NOT NULL,
      username  TEXT NOT NULL,
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (room, username),
      FOREIGN KEY (room) REFERENCES rooms(name),
      FOREIGN KEY (username) REFERENCES users(username)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id        TEXT PRIMARY KEY,
      room      TEXT NOT NULL,
      sender    TEXT NOT NULL,
      message   TEXT NOT NULL,
      metadata  TEXT DEFAULT '{}',
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (room) REFERENCES rooms(name),
      FOREIGN KEY (sender) REFERENCES users(username)
    );

    CREATE TABLE IF NOT EXISTS direct_messages (
      id        TEXT PRIMARY KEY,
      sender    TEXT NOT NULL,
      recipient TEXT NOT NULL,
      message   TEXT NOT NULL,
      metadata  TEXT DEFAULT '{}',
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (sender) REFERENCES users(username),
      FOREIGN KEY (recipient) REFERENCES users(username)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_room_ts ON messages(room, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_dm_pair_ts ON direct_messages(sender, recipient, timestamp DESC);
  `);

  return db;
}

// Users
function createUser(username, hashedPassword) {
  db.prepare('INSERT INTO users (username, password, created_at) VALUES (?, ?, ?)').run(username, hashedPassword, Date.now());
}

function getUser(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function updatePassword(username, hashedPassword) {
  db.prepare('UPDATE users SET password = ? WHERE username = ?').run(hashedPassword, username);
}

function updateProfile(username, avatar, about) {
  db.prepare('UPDATE users SET avatar = ?, about = ? WHERE username = ?').run(avatar, about, username);
}

// Rooms
function createRoom(name, description, metadata, createdBy) {
  db.prepare('INSERT INTO rooms (name, description, metadata, created_by, created_at) VALUES (?, ?, ?, ?, ?)').run(name, description, JSON.stringify(metadata), createdBy, Date.now());
}

function getRoom(name) {
  const row = db.prepare('SELECT * FROM rooms WHERE name = ?').get(name);
  if (row) row.metadata = JSON.parse(row.metadata);
  return row;
}

function getRooms() {
  const rows = db.prepare('SELECT * FROM rooms').all();
  for (const row of rows) row.metadata = JSON.parse(row.metadata);
  return rows;
}

function addRoomMember(room, username) {
  db.prepare('INSERT OR IGNORE INTO room_members (room, username, joined_at) VALUES (?, ?, ?)').run(room, username, Date.now());
}

function removeRoomMember(room, username) {
  db.prepare('DELETE FROM room_members WHERE room = ? AND username = ?').run(room, username);
}

function getRoomMembers(room) {
  return db.prepare('SELECT username FROM room_members WHERE room = ?').all(room).map(r => r.username);
}

// Messages
function saveMessage(id, room, sender, message, metadata, timestamp) {
  db.prepare('INSERT INTO messages (id, room, sender, message, metadata, timestamp) VALUES (?, ?, ?, ?, ?, ?)').run(id, room, sender, message, JSON.stringify(metadata), timestamp);
}

function getMessages(room, limit) {
  const rows = db.prepare('SELECT * FROM messages WHERE room = ? ORDER BY timestamp DESC, rowid DESC LIMIT ?').all(room, limit || config.HISTORY_LIMIT);
  rows.reverse();
  for (const row of rows) row.metadata = JSON.parse(row.metadata);
  return rows;
}

// Direct Messages
function saveDM(id, sender, recipient, message, metadata, timestamp) {
  db.prepare('INSERT INTO direct_messages (id, sender, recipient, message, metadata, timestamp) VALUES (?, ?, ?, ?, ?, ?)').run(id, sender, recipient, message, JSON.stringify(metadata), timestamp);
}

function getDMs(user1, user2, limit) {
  const rows = db.prepare(`
    SELECT * FROM direct_messages
    WHERE (sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?)
    ORDER BY timestamp DESC, rowid DESC LIMIT ?
  `).all(user1, user2, user2, user1, limit || config.HISTORY_LIMIT);
  rows.reverse();
  for (const row of rows) row.metadata = JSON.parse(row.metadata);
  return rows;
}

function getDMConversations(username) {
  const rows = db.prepare(`
    SELECT DISTINCT CASE WHEN sender = ? THEN recipient ELSE sender END AS other
    FROM direct_messages
    WHERE sender = ? OR recipient = ?
  `).all(username, username, username);
  return rows.map(r => r.other);
}

module.exports = {
  init, createUser, getUser, updatePassword, updateProfile,
  createRoom, getRoom, getRooms, addRoomMember, removeRoomMember, getRoomMembers,
  saveMessage, getMessages, saveDM, getDMs, getDMConversations,
};
