const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, createAgent, wait, rawSendAndWait, waitForMessage } = require('./helpers');

describe('Rooms', () => {
  let alice, bob;

  before(async () => {
    await startServer();
    alice = createAgent('alice', 'pass', { register: true });
    await alice.connect();
    bob = createAgent('bob', 'pass', { register: true });
    await bob.connect();
  });

  after(async () => {
    alice.disconnect();
    bob.disconnect();
    await stopServer();
  });

  describe('create', () => {
    it('should create a room', async () => {
      const result = await rawSendAndWait(
        alice,
        { type: 'room:create', name: 'general', description: 'Main chat' },
        'room:created',
      );
      assert.equal(result.room.name, 'general');
      assert.equal(result.room.description, 'Main chat');
    });

    it('should create a room with custom metadata', async () => {
      const meta = { topic: 'AI', maxAgents: 5 };
      const result = await rawSendAndWait(
        alice,
        { type: 'room:create', name: 'meta-room', description: 'With metadata', metadata: meta },
        'room:created',
      );
      assert.deepEqual(result.room.metadata, meta);
    });

    it('should reject duplicate room name', async () => {
      const result = await rawSendAndWait(
        alice,
        { type: 'room:create', name: 'general' },
        'room:error',
      );
      assert.equal(result.message, 'Room already exists');
    });
  });

  describe('list', () => {
    it('should list all rooms', async () => {
      const rooms = await alice.listRooms();
      assert.ok(rooms.length >= 2);
      const names = rooms.map(r => r.name);
      assert.ok(names.includes('general'));
      assert.ok(names.includes('meta-room'));
    });

    it('should include room metadata in listing', async () => {
      const rooms = await alice.listRooms();
      const metaRoom = rooms.find(r => r.name === 'meta-room');
      assert.deepEqual(metaRoom.metadata, { topic: 'AI', maxAgents: 5 });
    });

    it('should include userCount in listing', async () => {
      await alice.join('general');
      await wait(100);

      const rooms = await bob.listRooms();
      const general = rooms.find(r => r.name === 'general');
      assert.ok(general.userCount >= 1);
    });
  });

  describe('join and leave', () => {
    it('should join a room', async () => {
      const result = await bob.join('general');
      assert.equal(result.room, 'general');
      assert.equal(result.user, 'bob');
    });

    it('should reject joining a nonexistent room', async () => {
      const result = await rawSendAndWait(
        bob,
        { type: 'room:join', room: 'no-such-room' },
        'room:error',
      );
      assert.equal(result.message, 'Room does not exist');
    });

    it('should leave a room', async () => {
      // Create and join a temp room
      await rawSendAndWait(alice, { type: 'room:create', name: 'temp-leave' }, 'room:created');
      await alice.join('temp-leave');

      const result = await alice.leave('temp-leave');
      assert.equal(result.room, 'temp-leave');
      assert.equal(result.user, 'alice');
    });
  });

  describe('online status', () => {
    it('should show online users in a room', async () => {
      const result = await rawSendAndWait(
        alice,
        { type: 'room:users', room: 'general' },
        'room:users',
      );
      const usernames = result.users.map(u => u.username);
      assert.ok(usernames.includes('alice'));
      assert.ok(usernames.includes('bob'));
      for (const u of result.users) {
        assert.equal(u.online, true);
      }
    });

    it('should update online status when user leaves', async () => {
      await rawSendAndWait(alice, { type: 'room:create', name: 'status-room' }, 'room:created');
      await alice.join('status-room');
      await bob.join('status-room');
      await wait(50);

      await bob.leave('status-room');
      await wait(50);

      const result = await rawSendAndWait(
        alice,
        { type: 'room:users', room: 'status-room' },
        'room:users',
      );
      const usernames = result.users.map(u => u.username);
      assert.ok(usernames.includes('alice'));
      assert.ok(!usernames.includes('bob'));
    });
  });

  describe('presence events', () => {
    it('should notify when a user joins', async () => {
      await rawSendAndWait(alice, { type: 'room:create', name: 'presence-room' }, 'room:created');
      await alice.join('presence-room');
      await wait(50);

      // Listen for bob's join on alice's connection
      const joinPromise = waitForMessage(alice, 'room:joined');
      await bob.join('presence-room');
      const msg = await joinPromise;

      assert.equal(msg.room, 'presence-room');
      assert.equal(msg.user, 'bob');
    });

    it('should notify when a user disconnects', async () => {
      await rawSendAndWait(alice, { type: 'room:create', name: 'offline-room' }, 'room:created');
      await alice.join('offline-room');

      const charlie = createAgent('charlie', 'pass', { register: true });
      await charlie.connect();
      await charlie.join('offline-room');
      await wait(50);

      // Listen for charlie going offline
      const offlinePromise = waitForMessage(alice, 'presence:offline');
      charlie.disconnect();
      const msg = await offlinePromise;

      assert.equal(msg.username, 'charlie');
      assert.equal(msg.room, 'offline-room');
    });
  });
});
