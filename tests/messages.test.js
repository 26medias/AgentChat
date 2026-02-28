const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, createAgent, wait, rawSendAndWait, waitForMessage } = require('./helpers');

describe('Messages', () => {
  let alice, bob;

  before(async () => {
    await startServer({ HISTORY_LIMIT: '5' });
    alice = createAgent('alice', 'pass', { register: true });
    await alice.connect();
    bob = createAgent('bob', 'pass', { register: true });
    await bob.connect();

    // Create and join a shared room
    await rawSendAndWait(alice, { type: 'room:create', name: 'chat' }, 'room:created');
    await alice.join('chat');
    await bob.join('chat');
    await wait(50);
  });

  after(async () => {
    alice.disconnect();
    bob.disconnect();
    await stopServer();
  });

  describe('send and receive', () => {
    it('should deliver a message to other users in the room', async () => {
      const received = waitForMessage(bob, m => m.type === 'message:new' && m.message === 'Hello Bob!');
      alice.send('chat', 'Hello Bob!');
      const msg = await received;

      assert.equal(msg.from, 'alice');
      assert.equal(msg.room, 'chat');
      assert.equal(msg.message, 'Hello Bob!');
    });

    it('should include all required fields in message', async () => {
      const received = waitForMessage(bob, m => m.type === 'message:new' && m.message === 'test fields');
      alice.send('chat', 'test fields');
      const msg = await received;

      assert.equal(typeof msg.id, 'string');
      assert.ok(msg.id.length > 0);
      assert.equal(typeof msg.timestamp, 'number');
      assert.ok(msg.timestamp > 0);
      assert.equal(msg.from, 'alice');
      assert.equal(msg.room, 'chat');
      assert.equal(msg.message, 'test fields');
      assert.equal(typeof msg.metadata, 'object');
    });

    it('should preserve custom metadata on messages', async () => {
      const meta = { intent: 'greeting', confidence: 0.95, tags: ['hello', 'friendly'] };
      const received = waitForMessage(bob, m => m.type === 'message:new' && m.message === 'Hi with meta');
      alice.send('chat', 'Hi with meta', meta);
      const msg = await received;

      assert.deepEqual(msg.metadata, meta);
    });

    it('should reject sending to a room the user has not joined', async () => {
      await rawSendAndWait(alice, { type: 'room:create', name: 'nojoin' }, 'room:created');

      const errResult = await rawSendAndWait(
        alice,
        { type: 'message:send', room: 'nojoin', message: 'should fail' },
        'system:error',
      );
      assert.ok(errResult.message.includes('not joined'));
    });
  });

  describe('persistence and history', () => {
    it('should persist messages and return them via history', async () => {
      const unique = `persist-test-${Date.now()}`;
      const received = waitForMessage(bob, m => m.type === 'message:new' && m.message === unique);
      alice.send('chat', unique);
      await received;

      const history = await alice.history('chat', 50);
      assert.ok(history.length > 0);
      const found = history.find(m => m.message === unique);
      assert.ok(found, 'Persisted message should appear in history');
      assert.equal(found.sender, 'alice');
      assert.equal(found.room, 'chat');
    });

    it('should respect explicit history limit', async () => {
      // Create a fresh room for this test
      await rawSendAndWait(alice, { type: 'room:create', name: 'limit-room' }, 'room:created');
      await alice.join('limit-room');
      await bob.join('limit-room');
      await wait(50);

      // Send 5 messages, waiting for each to be delivered
      for (let i = 0; i < 5; i++) {
        const received = waitForMessage(bob,
          m => m.type === 'message:new' && m.room === 'limit-room' && m.message === `msg-${i}`
        );
        alice.send('limit-room', `msg-${i}`);
        await received;
      }

      // Request only 3
      const history = await alice.history('limit-room', 3);
      assert.equal(history.length, 3);
      // Should be the last 3 messages in chronological order
      assert.equal(history[0].message, 'msg-2');
      assert.equal(history[1].message, 'msg-3');
      assert.equal(history[2].message, 'msg-4');
    });

    it('should respect server default HISTORY_LIMIT when no limit is specified', async () => {
      // Server started with HISTORY_LIMIT=5
      await rawSendAndWait(alice, { type: 'room:create', name: 'deflimit-room' }, 'room:created');
      await alice.join('deflimit-room');
      await bob.join('deflimit-room');
      await wait(50);

      // Send 8 messages
      for (let i = 0; i < 8; i++) {
        const received = waitForMessage(bob,
          m => m.type === 'message:new' && m.room === 'deflimit-room' && m.message === `dlm-${i}`
        );
        alice.send('deflimit-room', `dlm-${i}`);
        await received;
      }

      // Request history without a limit (raw message, no limit field)
      const result = await rawSendAndWait(
        alice,
        { type: 'room:history', room: 'deflimit-room' },
        'room:history',
      );
      assert.equal(result.messages.length, 5);
      // Should be the last 5 in chronological order
      assert.equal(result.messages[0].message, 'dlm-3');
      assert.equal(result.messages[4].message, 'dlm-7');
    });

    it('should return history in chronological order', async () => {
      const history = await alice.history('chat', 50);
      for (let i = 1; i < history.length; i++) {
        assert.ok(history[i].timestamp >= history[i - 1].timestamp);
      }
    });
  });
});
