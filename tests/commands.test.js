const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, createAgent, wait, rawSendAndWait } = require('./helpers');

describe('Command Hooks', () => {
  let alice;

  before(async () => {
    await startServer();
    alice = createAgent('alice', 'pass', { register: true });
    await alice.connect();

    await rawSendAndWait(alice, { type: 'room:create', name: 'cmd-room' }, 'room:created');
    await alice.join('cmd-room');
    await wait(50);
  });

  after(async () => {
    alice.disconnect();
    await stopServer();
  });

  describe('list commands', () => {
    it('should return available commands', async () => {
      const result = await rawSendAndWait(
        alice,
        { type: 'command:list' },
        'command:list',
      );
      assert.ok(Array.isArray(result.commands));
      assert.ok(result.commands.length > 0);

      const help = result.commands.find(c => c.name === 'help');
      assert.ok(help);
      assert.equal(typeof help.description, 'string');
    });
  });

  describe('execute commands', () => {
    it('should execute the built-in /help command', async () => {
      const result = await rawSendAndWait(
        alice,
        { type: 'command:send', room: 'cmd-room', command: 'help', args: '' },
        'command:result',
      );
      assert.equal(result.command, 'help');
      assert.equal(result.room, 'cmd-room');
      assert.equal(typeof result.result, 'string');
      assert.ok(result.result.includes('/help'));
    });

    it('should return error for unknown command', async () => {
      const result = await rawSendAndWait(
        alice,
        { type: 'command:send', room: 'cmd-room', command: 'nonexistent', args: '' },
        'command:error',
      );
      assert.equal(result.command, 'nonexistent');
      assert.ok(result.message.includes('Unknown command'));
    });
  });

  describe('command context', () => {
    it('should pass room context to command handler', async () => {
      // The /help command doesn't use context, but we can verify
      // it works in the context of a room by checking the result includes room
      const result = await rawSendAndWait(
        alice,
        { type: 'command:send', room: 'cmd-room', command: 'help', args: '' },
        'command:result',
      );
      assert.equal(result.room, 'cmd-room');
    });
  });
});
