const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, createAgent, wait, rawSendAndWait, waitForMessage } = require('./helpers');

describe('Direct Messages', () => {
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

  describe('send and receive', () => {
    it('should deliver a DM to the recipient', async () => {
      const received = waitForMessage(bob, m => m.type === 'dm:new' && m.message === 'Hey Bob');
      alice.dm('bob', 'Hey Bob');
      const msg = await received;

      assert.equal(msg.from, 'alice');
      assert.equal(msg.to, 'bob');
      assert.equal(msg.message, 'Hey Bob');
    });

    it('should echo the DM back to the sender', async () => {
      const echo = waitForMessage(alice, m => m.type === 'dm:new' && m.message === 'echo test');
      alice.dm('bob', 'echo test');
      const msg = await echo;

      assert.equal(msg.from, 'alice');
      assert.equal(msg.to, 'bob');
      assert.equal(msg.message, 'echo test');
    });

    it('should include all required fields in DM', async () => {
      const received = waitForMessage(bob, m => m.type === 'dm:new' && m.message === 'field check');
      alice.dm('bob', 'field check');
      const msg = await received;

      assert.equal(typeof msg.id, 'string');
      assert.ok(msg.id.length > 0);
      assert.equal(typeof msg.timestamp, 'number');
      assert.ok(msg.timestamp > 0);
      assert.equal(msg.from, 'alice');
      assert.equal(msg.to, 'bob');
      assert.equal(msg.message, 'field check');
      assert.equal(typeof msg.metadata, 'object');
    });

    it('should preserve custom metadata on DMs', async () => {
      const meta = { priority: 'high', context: { taskId: 42 } };
      const received = waitForMessage(bob, m => m.type === 'dm:new' && m.message === 'meta dm');
      alice.dm('bob', 'meta dm', meta);
      const msg = await received;

      assert.deepEqual(msg.metadata, meta);
    });

    it('should reject DM to nonexistent user', async () => {
      const errResult = await rawSendAndWait(
        alice,
        { type: 'dm:send', to: 'nobody', message: 'hello?' },
        'system:error',
      );
      assert.ok(errResult.message.includes('not found'));
    });
  });

  describe('history', () => {
    it('should persist DMs and return history', async () => {
      const unique = `dm-persist-${Date.now()}`;
      const received = waitForMessage(bob, m => m.type === 'dm:new' && m.message === unique);
      alice.dm('bob', unique);
      await received;

      const history = await alice.dmHistory('bob');
      assert.ok(history.length > 0);
      const found = history.find(m => m.message === unique);
      assert.ok(found, 'Persisted DM should appear in history');
    });

    it('should return DMs from both directions in history', async () => {
      const r1 = waitForMessage(bob, m => m.type === 'dm:new' && m.message === 'from-alice');
      alice.dm('bob', 'from-alice');
      await r1;

      const r2 = waitForMessage(alice, m => m.type === 'dm:new' && m.message === 'from-bob');
      bob.dm('alice', 'from-bob');
      await r2;

      const history = await alice.dmHistory('bob');
      const fromAlice = history.find(m => m.message === 'from-alice');
      const fromBob = history.find(m => m.message === 'from-bob');
      assert.ok(fromAlice);
      assert.ok(fromBob);
    });

    it('should respect DM history limit', async () => {
      const carol = createAgent('carol', 'pass', { register: true });
      await carol.connect();

      for (let i = 0; i < 5; i++) {
        const received = waitForMessage(carol, m => m.type === 'dm:new' && m.message === `dm-${i}`);
        alice.dm('carol', `dm-${i}`);
        await received;
      }

      const history = await alice.dmHistory('carol', 3);
      assert.equal(history.length, 3);
      assert.equal(history[0].message, 'dm-2');
      assert.equal(history[2].message, 'dm-4');

      carol.disconnect();
    });

    it('should return DM history in chronological order', async () => {
      const history = await alice.dmHistory('bob');
      for (let i = 1; i < history.length; i++) {
        assert.ok(history[i].timestamp >= history[i - 1].timestamp);
      }
    });
  });

  describe('conversation list', () => {
    it('should list DM conversations', async () => {
      const conversations = await alice.dmList();
      assert.ok(Array.isArray(conversations));
      assert.ok(conversations.includes('bob'));
    });

    it('should include new conversations after first DM', async () => {
      const dave = createAgent('dave', 'pass', { register: true });
      await dave.connect();

      const received = waitForMessage(dave, m => m.type === 'dm:new' && m.message === 'hello dave');
      alice.dm('dave', 'hello dave');
      await received;

      const conversations = await alice.dmList();
      assert.ok(conversations.includes('dave'));

      dave.disconnect();
    });
  });
});
