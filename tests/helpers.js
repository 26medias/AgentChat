const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { AgentChat } = require('../sdk');

let serverProcess;
let port;
let tmpDir;

async function startServer(envOverrides = {}) {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentchat-test-'));
  const dbPath = path.join(tmpDir, 'test.db');
  port = 10000 + Math.floor(Math.random() * 50000);

  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['index.js'], {
      cwd: path.join(__dirname, '..', 'server'),
      env: {
        ...process.env,
        PORT: String(port),
        DB_PATH: dbPath,
        BCRYPT_ROUNDS: '1',
        ...envOverrides,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes('running on port')) resolve();
    });

    serverProcess.on('error', reject);
    setTimeout(() => reject(new Error('Server startup timeout')), 10000);
  });
}

async function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
    await wait(200);
  }
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
}

function createAgent(username, password, opts = {}) {
  return new AgentChat(`ws://localhost:${port}`, {
    username,
    password,
    autoReconnect: false,
    ...opts,
  });
}

function wait(ms = 100) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Send a raw WS message and wait for a response matching a type.
 */
function rawSendAndWait(agent, sendObj, matchType, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${matchType}`)), timeout);
    const handler = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === matchType) {
        clearTimeout(timer);
        agent.ws.removeListener('message', handler);
        resolve(msg);
      }
    };
    agent.ws.on('message', handler);
    agent._send(sendObj);
  });
}

/**
 * Wait for the next message matching a type string or predicate function.
 */
function waitForMessage(agent, match, timeout = 3000) {
  const predicate = typeof match === 'function' ? match : (msg) => msg.type === match;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for message')), timeout);
    const handler = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (predicate(msg)) {
        clearTimeout(timer);
        agent.ws.removeListener('message', handler);
        resolve(msg);
      }
    };
    agent.ws.on('message', handler);
  });
}

module.exports = { startServer, stopServer, createAgent, wait, rawSendAndWait, waitForMessage };
