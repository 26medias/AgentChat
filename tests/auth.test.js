const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, createAgent, wait, rawSendAndWait } = require('./helpers');

describe('Authentication', () => {
  before(() => startServer());
  after(() => stopServer());

  describe('register', () => {
    it('should register a new user and return user object', async () => {
      const agent = createAgent('newuser', 'pass123', { register: true });
      const user = await agent.connect();

      assert.equal(user.username, 'newuser');
      assert.equal(typeof user.avatar, 'string');
      assert.equal(typeof user.about, 'string');
      assert.ok(agent.token);

      agent.disconnect();
    });

    it('should reject duplicate username', async () => {
      const agent1 = createAgent('dupuser', 'pass', { register: true });
      await agent1.connect();

      const agent2 = createAgent('dupuser', 'pass', { register: true });
      await assert.rejects(() => agent2.connect(), { message: 'Username already taken' });

      agent1.disconnect();
      agent2.disconnect();
    });
  });

  describe('login', () => {
    it('should login with correct credentials', async () => {
      // Register first
      const reg = createAgent('loginuser', 'secret', { register: true });
      await reg.connect();
      reg.disconnect();
      await wait(100);

      // Login
      const agent = createAgent('loginuser', 'secret', { register: false });
      const user = await agent.connect();
      assert.equal(user.username, 'loginuser');
      agent.disconnect();
    });

    it('should reject wrong password', async () => {
      const agent = createAgent('loginuser', 'wrongpass', { register: false });
      await assert.rejects(() => agent.connect(), { message: 'Invalid credentials' });
      agent.disconnect();
    });

    it('should reject nonexistent user', async () => {
      const agent = createAgent('nosuchuser', 'pass', { register: false });
      await assert.rejects(() => agent.connect(), { message: 'Invalid credentials' });
      agent.disconnect();
    });
  });

  describe('token resume', () => {
    it('should resume session with a valid token', async () => {
      const agent1 = createAgent('resumeuser', 'pass', { register: true });
      await agent1.connect();
      const token = agent1.token;
      agent1.disconnect();
      await wait(100);

      // Reconnect using the token
      const agent2 = createAgent('resumeuser', 'pass', { register: false });
      agent2.token = token;
      const user = await agent2.connect();
      assert.equal(user.username, 'resumeuser');
      agent2.disconnect();
    });

    it('should reject an invalid token', async () => {
      const agent = createAgent('whoever', 'pass', { register: false });
      agent.token = 'bogus-token-value';
      await assert.rejects(() => agent.connect(), { message: 'Invalid or expired token' });
      agent.disconnect();
    });
  });

  describe('password change', () => {
    it('should allow changing password and logging in with the new one', async () => {
      const agent = createAgent('pwuser', 'oldpass', { register: true });
      await agent.connect();

      const result = await rawSendAndWait(
        agent,
        { type: 'auth:change_password', oldPassword: 'oldpass', newPassword: 'newpass' },
        'auth:success',
      );
      assert.ok(result);
      agent.disconnect();
      await wait(100);

      // Login with new password
      const agent2 = createAgent('pwuser', 'newpass', { register: false });
      const user = await agent2.connect();
      assert.equal(user.username, 'pwuser');
      agent2.disconnect();

      // Old password should fail
      const agent3 = createAgent('pwuser', 'oldpass', { register: false });
      await assert.rejects(() => agent3.connect(), { message: 'Invalid credentials' });
      agent3.disconnect();
    });

    it('should reject wrong current password', async () => {
      const agent = createAgent('pwuser2', 'mypass', { register: true });
      await agent.connect();

      const result = await rawSendAndWait(
        agent,
        { type: 'auth:change_password', oldPassword: 'wrongold', newPassword: 'newpass' },
        'auth:error',
      );
      assert.equal(result.message, 'Incorrect current password');
      agent.disconnect();
    });
  });

  describe('profile', () => {
    it('should update avatar and about', async () => {
      const agent = createAgent('profileuser', 'pass', { register: true });
      await agent.connect();

      const result = await rawSendAndWait(
        agent,
        { type: 'auth:update_profile', avatar: 'https://example.com/pic.png', about: 'I am a bot' },
        'auth:profile_updated',
      );

      assert.equal(result.user.username, 'profileuser');
      assert.equal(result.user.avatar, 'https://example.com/pic.png');
      assert.equal(result.user.about, 'I am a bot');
      agent.disconnect();
    });

    it('should preserve fields not sent in update', async () => {
      const agent = createAgent('profileuser2', 'pass', { register: true });
      await agent.connect();

      // Set avatar
      await rawSendAndWait(
        agent,
        { type: 'auth:update_profile', avatar: 'pic.png' },
        'auth:profile_updated',
      );

      // Update only about — avatar should be preserved
      const result = await rawSendAndWait(
        agent,
        { type: 'auth:update_profile', about: 'hello' },
        'auth:profile_updated',
      );

      assert.equal(result.user.avatar, 'pic.png');
      assert.equal(result.user.about, 'hello');
      agent.disconnect();
    });
  });
});
