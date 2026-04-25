const express = require("express");
const db = require("../db");
const { getUser, requireLogin } = require("../middleware/auth");

const router = express.Router();

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

  db.prepare("INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES (?, ?, 'pending')").run(user.id, target.id);
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
    db.prepare("UPDATE friend_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(action, request.id);
    if (action === "accepted") {
      db.prepare("INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)").run(request.sender_id, request.receiver_id);
      db.prepare("INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)").run(request.receiver_id, request.sender_id);
    }
  })();

  res.json({ success: true });
}

router.post("/api/friends/request/:id/respond", requireLogin, respondToRequest);
router.post("/api/profile/friends/respond", requireLogin, respondToRequest);
router.post("/api/profile/friends/request", requireLogin, (req, res, next) => {
  req.url = "/api/friends/request";
  next();
}, router);

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

module.exports = router;
