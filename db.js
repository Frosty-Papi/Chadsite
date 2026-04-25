// FRIEND SYSTEM (CANONICAL + CLEAN MIGRATION)

db.prepare(`
CREATE TABLE IF NOT EXISTS friend_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','accepted','rejected','cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(sender_id, receiver_id)
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS friends (
  user_id INTEGER NOT NULL,
  friend_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, friend_id)
)
`).run();

// migrate legacy requester/addressee
const frCols2 = db.prepare(`PRAGMA table_info(friend_requests)`).all();
if (frCols2.some(c => c.name === "requester_user_id")) {
  db.transaction(() => {
    db.prepare(`ALTER TABLE friend_requests RENAME TO friend_requests_old`).run();

    db.prepare(`
      CREATE TABLE friend_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER,
        receiver_id INTEGER,
        status TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `).run();

    db.prepare(`
      INSERT INTO friend_requests
      SELECT id, requester_user_id, addressee_user_id, status, created_at, updated_at
      FROM friend_requests_old
    `).run();

    db.prepare(`DROP TABLE friend_requests_old`).run();
  })();
}

// migrate friendships
const hasOldFriends = db.prepare(`SELECT name FROM sqlite_master WHERE name='friendships'`).get();
if (hasOldFriends) {
  db.prepare(`INSERT OR IGNORE INTO friends SELECT user_id, friend_user_id, CURRENT_TIMESTAMP FROM friendships`).run();
  db.prepare(`DROP TABLE friendships`).run();
}
