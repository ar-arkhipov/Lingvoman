const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_123';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
// Silence OpenAI-related warnings in tests
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

before(async function () {
  mongoServer = await MongoMemoryServer.create({
    instance: { dbName: 'lingvoman_test' }
  });
  const uri = mongoServer.getUri();

  process.env.MONGO_URI = uri;
});

after(async function () {

  if (mongoServer) {
    await mongoServer.stop();
  }
});


