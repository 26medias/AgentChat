const WebSocket = require('ws');

class AgentChat {
  /**
   * @param {string} url - WebSocket URL, e.g. 'ws://localhost:3000'
   * @param {object} opts
   * @param {string} opts.username
   * @param {string} opts.password
   * @param {boolean} [opts.register=false] - Register a new account
   * @param {boolean} [opts.autoReconnect=true]
   */
  constructor(url, opts = {}) {
    this.url = url;
    this.username = opts.username;
    this.password = opts.password;
    this.register = opts.register || false;
    this.autoReconnect = opts.autoReconnect !== false;
    this.token = null;
    this.ws = null;
    this._handlers = {};
    this._pendingCallbacks = {};
    this._reconnectTimer = null;
    this._connected = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        const type = this.token ? 'auth:resume' : (this.register ? 'auth:register' : 'auth:login');
        const payload = this.token
          ? { type, token: this.token }
          : { type, username: this.username, password: this.password };
        this.ws.send(JSON.stringify(payload));
      });

      this.ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }
        this._dispatch(msg);
      });

      this.ws.on('close', () => {
        this._connected = false;
        if (this.autoReconnect && this.token) {
          this._reconnectTimer = setTimeout(() => this.connect().catch(() => {}), 3000);
        }
      });

      this.ws.on('error', () => {});

      // Wait for auth result
      this._pendingCallbacks['auth'] = (msg) => {
        if (msg.type === 'auth:success') {
          this.token = msg.token;
          this._connected = true;
          // After first successful register, switch to login for reconnects
          this.register = false;
          resolve(msg.user);
        } else if (msg.type === 'auth:error') {
          reject(new Error(msg.message));
        }
      };
    });
  }

  _dispatch(msg) {
    // Auth callback
    if (msg.type.startsWith('auth:') && this._pendingCallbacks['auth']) {
      this._pendingCallbacks['auth'](msg);
      if (msg.type === 'auth:success' || msg.type === 'auth:error') {
        delete this._pendingCallbacks['auth'];
      }
      return;
    }

    // Pending one-shot callbacks (for async methods like join, listRooms, etc.)
    const cbKey = this._callbackKeyFor(msg);
    if (cbKey && this._pendingCallbacks[cbKey]) {
      this._pendingCallbacks[cbKey](msg);
      delete this._pendingCallbacks[cbKey];
      return;
    }

    // Event handlers
    if (msg.type === 'message:new' && this._handlers['message']) {
      this._handlers['message'](msg);
    } else if (msg.type === 'dm:new' && this._handlers['dm']) {
      this._handlers['dm'](msg);
    } else if (msg.type === 'room:joined' && this._handlers['roomJoined']) {
      this._handlers['roomJoined'](msg);
    } else if (msg.type === 'room:left' && this._handlers['roomLeft']) {
      this._handlers['roomLeft'](msg);
    } else if (msg.type === 'presence:online' && this._handlers['presence']) {
      this._handlers['presence']({ ...msg, status: 'online' });
    } else if (msg.type === 'presence:offline' && this._handlers['presence']) {
      this._handlers['presence']({ ...msg, status: 'offline' });
    } else if (msg.type === 'command:result' && this._handlers['command']) {
      this._handlers['command'](msg);
    } else if ((msg.type === 'system:error' || msg.type === 'room:error' || msg.type === 'command:error') && this._handlers['error']) {
      this._handlers['error'](msg);
    }
  }

  _callbackKeyFor(msg) {
    if (msg.type === 'room:joined') return `join:${msg.room}`;
    if (msg.type === 'room:left') return `leave:${msg.room}`;
    if (msg.type === 'room:list') return 'room:list';
    if (msg.type === 'room:created') return `room:create:${msg.room?.name}`;
    if (msg.type === 'room:history') return `history:${msg.room}`;
    if (msg.type === 'dm:history') return `dm:history:${msg.with}`;
    if (msg.type === 'dm:list') return 'dm:list';
    return null;
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  _request(sendObj, callbackKey) {
    return new Promise((resolve) => {
      this._pendingCallbacks[callbackKey] = resolve;
      this._send(sendObj);
    });
  }

  async join(roomName) {
    const result = await this._request(
      { type: 'room:join', room: roomName },
      `join:${roomName}`
    );
    return result;
  }

  async leave(roomName) {
    const result = await this._request(
      { type: 'room:leave', room: roomName },
      `leave:${roomName}`
    );
    return result;
  }

  send(roomName, message, metadata = {}) {
    this._send({ type: 'message:send', room: roomName, message, metadata });
  }

  dm(username, message, metadata = {}) {
    this._send({ type: 'dm:send', to: username, message, metadata });
  }

  command(roomName, command, args = '') {
    this._send({ type: 'command:send', room: roomName, command, args });
  }

  async listRooms() {
    const result = await this._request({ type: 'room:list' }, 'room:list');
    return result.rooms;
  }

  async history(roomName, limit = 50) {
    const result = await this._request(
      { type: 'room:history', room: roomName, limit },
      `history:${roomName}`
    );
    return result.messages;
  }

  async dmHistory(username, limit = 50) {
    const result = await this._request(
      { type: 'dm:history', with: username, limit },
      `dm:history:${username}`
    );
    return result.messages;
  }

  async dmList() {
    const result = await this._request({ type: 'dm:list' }, 'dm:list');
    return result.conversations;
  }

  // Event handlers
  onMessage(handler) { this._handlers['message'] = handler; return this; }
  onDM(handler) { this._handlers['dm'] = handler; return this; }
  onRoomJoined(handler) { this._handlers['roomJoined'] = handler; return this; }
  onRoomLeft(handler) { this._handlers['roomLeft'] = handler; return this; }
  onPresence(handler) { this._handlers['presence'] = handler; return this; }
  onCommand(handler) { this._handlers['command'] = handler; return this; }
  onError(handler) { this._handlers['error'] = handler; return this; }

  disconnect() {
    this.autoReconnect = false;
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this.ws) this.ws.close();
  }
}

module.exports = { AgentChat };
