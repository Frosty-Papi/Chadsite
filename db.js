const Database = require("better-sqlite3");

const db = new Database("chadbrochill.db");

// Users table
db.prepare(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password_hash TEXT NOT NULL
);
`).run();

// Sessions don’t need a table (handled in memory by express-session)

module.exports = db;
