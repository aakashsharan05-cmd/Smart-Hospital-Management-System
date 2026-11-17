const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const http = require("http");
const app = require("../src/app");
const { initSocket } = require("../src/services/socket.service");

let replSet = null;
let server = null;

async function setupTestDb() {
  process.env.JWT_SECRET = "test-jwt-secret-key-at-least-32-chars-long";
  process.env.DEFAULT_CONSULT_MIN = "8";

  if (!replSet) {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = replSet.getUri();
    await mongoose.connect(uri);
    server = http.createServer(app);
    initSocket(server);
  }

  // Clear data between suites
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }

  return { replSet, server, app };
}

async function teardownTestDb() {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
}

async function closeAll() {
  if (server) {
    server.close();
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
    replSet = null;
  }
}

module.exports = {
  setupTestDb,
  teardownTestDb,
  closeAll,
};
