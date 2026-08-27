const request = require('supertest');
const pwd = require('../../middlewares/pwd');

async function createTestUser({ username = 'admin', password = 'password', role = 'admin', name = 'Test Admin' } = {}) {
  // Lazy-load models after MONGO_URI set by global setup
  const { User } = require('../../libs/mongoose');
  const hashed = pwd.pwdgen(password);

  await User.updateOne(
    { username },
    { $set: { username, password: hashed, userObj: { role, name } } },
    { upsert: true }
  );

  return { username, password };
}

async function loginAndGetToken({ username = 'admin', password = 'password' } = {}) {
  // Lazy-load app to ensure env is ready
  const { app } = require('../../src/server');
  const res = await request(app)
    .post('/login')
    .send({ username, password });

  if (res.status !== 200 || !res.body?.token) {
    throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return res.body.token;
}

module.exports = { createTestUser, loginAndGetToken };


