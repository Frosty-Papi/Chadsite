const express = require("express");
const db = require("../db");
const { getUser, requireLogin } = require("../middleware/auth");

const router = express.Router();

function tableExists(table) {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
}

function hasColumn(table, column) {
  if (!tableExists(table)) return false;
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
}

function addColumnIfMissing(table, column, definition) {
  if (tableExists(table) && !hasColumn(table, column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

addColumnIfMissing("friend_requests", "is_read", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("play_invites", "is_read", "INTEGER NOT NULL DEFAULT 0");

function decoratePresence(rows) {
  const now = Date.now();
  return rows.map(row => {
    const lastSeen = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
    return { ...row, is_online: !!lastSeen && now - lastSeen < 120000 };
  });
}

router.get("/api/friends", requireLogin, (req, res) => {
  const user = getUser(req);

  const friends = decoratePresence(db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar, u.last_seen_at
    FROM friends f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ?
    ORDER BY COALESCE(u.display_name, u.username) COLLATE NOCASE
  `).all(user.id));

  const incoming = decoratePresence(db.prepare(`
    SELECT fr.id, u.id AS user_id, u.username, u.display_name, u.avatar, u.last_seen_at
    FROM friend_requests fr
    JOIN users u ON u.id = fr.sender_id
    WHERE fr.receiver_id = ? AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
  `).all(user.id));

  const outgoing = decoratePresence(db.prepare(`
    SELECT fr.id, u.id AS user_id, u.username, u.display_name, u.avatar, u.last_seen_at
    FROM friend_requests fr
    JOIN users u ON u.id = fr.receiver_id
    WHERE fr.sender_id = ? AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
  `).all(user.id));

  res.json({ success: true, friends, incoming, outgoing });
});

router.post("/api/friends/request", requireLogin, (req, res) => {
  const user = getUser(req);
  const username = String(req.body.username || "").trim().toLowerCase();

  if (!username) return res.status(400).json({ error: "Username is required" });

  const target = db.prepare("SELECT id, username FROM users WHERE lower(username) = ?").get(username);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.id === user.id) return res.status(400).json({ error: "You cannot add yourself" });

  const existingFriend = db.prepare("SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?").get(user.id, target.id);
  if (existingFriend) return res.status(409).json({ error: "Already friends" });

  const existingRequest = db.prepare(`
    SELECT id, sender_id, receiver_id, status
    FROM friend_requests
    WHERE (sender_id = ? AND receiver_id = ?)
       OR (sender_id = ? AND receiver_id = ?)
  `).get(user.id, target.id, target.id, user.id);

  if (existingRequest?.status === "pending") {
    return res.status(409).json({ error: existingRequest.sender_id === target.id ? "That user has already sent you a request" : "Friend request already exists" });
  }

  if (existingRequest) db.prepare("DELETE FROM friend_requests WHERE id = ?").run(existingRequest.id);

  db.prepare("INSERT INTO friend_requests (sender_id, receiver_id, status, is_read) VALUES (?, ?, 'pending', 0)").run(user.id, target.id);
  res.json({ success: true });
});

function respondToRequest(req, res) {
  const user = getUser(req);
  const id = Number.parseInt(req.params.id || req.body.requestId, 10);
  const action = String(req.body.action || "").toLowerCase() === "accept" ? "accepted" : "rejected";

  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid request" });

  const request = db.prepare(`
    SELECT * FROM friend_requests
    WHERE id = ? AND receiver_id = ? AND status = 'pending'
  `).get(id, user.id);

  if (!request) return res.status(404).json({ error: "Friend request not found" });

  db.transaction(() => {
    db.prepare("UPDATE friend_requests SET status = ?, is_read = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(action, request.id);
    if (action === "accepted") {
      db.prepare("INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)").run(request.sender_id, request.receiver_id);
      db.prepare("INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)").run(request.receiver_id, request.sender_id);
    }
  })();

  res.json({ success: true });
}

router.post("/api/friends/request/:id/respond", requireLogin, respondToRequest);
router.post("/api/profile/friends/respond", requireLogin, respondToRequest);

router.post("/api/profile/friends/request", requireLogin, (req, res) => {
  const user = getUser(req);
  const username = String(req.body.username || "").trim().toLowerCase();
  if (!username) return res.status(400).json({ error: "Username is required" });

  const target = db.prepare("SELECT id, username FROM users WHERE lower(username) = ?").get(username);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.id === user.id) return res.status(400).json({ error: "You cannot add yourself" });

  const existingFriend = db.prepare("SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?").get(user.id, target.id);
  if (existingFriend) return res.status(409).json({ error: "Already friends" });

  const existingRequest = db.prepare(`
    SELECT id, sender_id, receiver_id, status
    FROM friend_requests
    WHERE (sender_id = ? AND receiver_id = ?)
       OR (sender_id = ? AND receiver_id = ?)
  `).get(user.id, target.id, target.id, user.id);

  if (existingRequest?.status === "pending") return res.status(409).json({ error: "Friend request already exists" });
  if (existingRequest) db.prepare("DELETE FROM friend_requests WHERE id = ?").run(existingRequest.id);

  db.prepare("INSERT INTO friend_requests (sender_id, receiver_id, status, is_read) VALUES (?, ?, 'pending', 0)").run(user.id, target.id);
  res.json({ success: true });
});

router.post("/api/friends/remove", requireLogin, (req, res) => {
  const user = getUser(req);
  const targetId = Number.parseInt(req.body.userId, 10);

  if (!Number.isInteger(targetId) || targetId === user.id) return res.status(400).json({ error: "Invalid friend" });

  db.prepare(`
    DELETE FROM friends
    WHERE (user_id = ? AND friend_id = ?)
       OR (user_id = ? AND friend_id = ?)
  `).run(user.id, targetId, targetId, user.id);

  res.json({ success: true });
});

router.get("/api/notifications", requireLogin, (req, res) => {
  const user = getUser(req);

  const invites = tableExists("play_invites") ? db.prepare(`
    SELECT i.id, 'invite' AS type, COALESCE(i.is_read, 0) AS is_read,
           i.created_at, s.title, u.username
    FROM play_invites i
    JOIN play_sessions s ON s.id = i.session_id
    JOIN users u ON u.id = i.sender_id
    WHERE i.receiver_id = ? AND i.status = 'pending'
  `).all(user.id) : [];

  const requests = db.prepare(`
    SELECT fr.id, 'friend_request' AS type, COALESCE(fr.is_read, 0) AS is_read,
           fr.created_at, u.username
    FROM friend_requests fr
    JOIN users u ON u.id = fr.sender_id
    WHERE fr.receiver_id = ? AND fr.status = 'pending'
  `).all(user.id);

  const notifications = [...invites, ...requests]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  res.json({
    notifications,
    unreadCount: notifications.filter(n => !Number(n.is_read)).length
  });
});

router.post("/api/notifications/read", requireLogin, (req, res) => {
  const user = getUser(req);
  const id = Number.parseInt(req.body.id, 10);
  const type = String(req.body.type || "");

  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid notification" });

  if (type === "invite" && tableExists("play_invites")) {
    db.prepare("UPDATE play_invites SET is_read = 1 WHERE id = ? AND receiver_id = ?").run(id, user.id);
  } else if (type === "friend_request") {
    db.prepare("UPDATE friend_requests SET is_read = 1 WHERE id = ? AND receiver_id = ?").run(id, user.id);
  } else {
    return res.status(400).json({ error: "Invalid notification type" });
  }

  res.json({ success: true });
});

router.post("/api/notifications/read-all", requireLogin, (req, res) => {
  const user = getUser(req);

  if (tableExists("play_invites")) {
    db.prepare("UPDATE play_invites SET is_read = 1 WHERE receiver_id = ? AND status = 'pending'").run(user.id);
  }
  db.prepare("UPDATE friend_requests SET is_read = 1 WHERE receiver_id = ? AND status = 'pending'").run(user.id);

  res.json({ success: true });
});

module.exports = router;
