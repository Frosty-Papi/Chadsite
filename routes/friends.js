const express = require("express");
const db = require("../db");
const { getUser, requireLogin } = require("../middleware/auth");

const router = express.Router();

router.get("/api/friends", requireLogin, (req, res) => {
  const user = getUser(req);

  const friends = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar
    FROM friendships f
    JOIN users u ON u.id = f.friend_user_id
    WHERE f.user_id = ?
    ORDER BY COALESCE(u.display_name, u.username) COLLATE NOCASE
  `).all(user.id);

  const incoming = db.prepare(`
    SELECT fr.id, u.id AS user_id, u.username, u.display_name
    FROM friend_requests fr
    JOIN users u ON u.id = fr.requester_user_id
    WHERE fr.addressee_user_id = ? AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
  `).all(user.id);

  const outgoing = db.prepare(`
    SELECT fr.id, u.id AS user_id, u.username, u.display_name
    FROM friend_requests fr
    JOIN users u ON u.id = fr.addressee_user_id
    WHERE fr.requester_user_id = ? AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
  `).all(user.id);

  res.json({ success: true, friends, incoming, outgoing });
});

router.post("/api/friends/request", requireLogin, (req, res) => {
  const user = getUser(req);
  const username = String(req.body.username || "").trim();

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  const target = db.prepare("SELECT id, username FROM users WHERE username = ?").get(username);
  if (!target) {
    return res.status(404).json({ error: "User not found" });
  }

  if (target.id === user.id) {
    return res.status(400).json({ error: "You cannot add yourself" });
  }

  const existingFriend = db.prepare(`
    SELECT 1 FROM friendships WHERE user_id = ? AND friend_user_id = ?
  `).get(user.id, target.id);
  if (existingFriend) {
    return res.status(409).json({ error: "Already friends" });
  }

  const reversePending = db.prepare(`
    SELECT id FROM friend_requests
    WHERE requester_user_id = ? AND addressee_user_id = ? AND status = 'pending'
  `).get(target.id, user.id);

  if (reversePending) {
    return res.status(409).json({ error: "That user has already sent you a request" });
  }

  try {
    db.prepare(`
      INSERT INTO friend_requests (requester_user_id, addressee_user_id, status)
      VALUES (?, ?, 'pending')
    `).run(user.id, target.id);

    return res.json({ success: true });
  } catch (error) {
    return res.status(409).json({ error: "Friend request already exists" });
  }
});

router.post("/api/friends/request/:id/respond", requireLogin, (req, res) => {
  const user = getUser(req);
  const action = req.body.action === "accept" ? "accepted" : "rejected";

  const request = db.prepare(`
    SELECT *
    FROM friend_requests
    WHERE id = ? AND addressee_user_id = ? AND status = 'pending'
  `).get(req.params.id, user.id);

  if (!request) {
    return res.status(404).json({ error: "Friend request not found" });
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE friend_requests
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(action, request.id);

    if (action === 'accepted') {
      db.prepare(`
        INSERT OR IGNORE INTO friendships (user_id, friend_user_id)
        VALUES (?, ?)
      `).run(request.requester_user_id, request.addressee_user_id);

      db.prepare(`
        INSERT OR IGNORE INTO friendships (user_id, friend_user_id)
        VALUES (?, ?)
      `).run(request.addressee_user_id, request.requester_user_id);
    }
  });

  tx();
  res.json({ success: true });
});

module.exports = router;
