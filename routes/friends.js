const express = require("express");
const db = require("../db");
const { getUser, requireLogin } = require("../middleware/auth");

const router = express.Router();

function decorate(rows) {
  const now = Date.now();
  return rows.map(r => {
    const last = r.last_seen_at ? new Date(r.last_seen_at).getTime() : 0;
    return { ...r, is_online: !!last && now - last < 120000 };
  });
}

router.get("/api/friends", requireLogin, (req, res) => {
  const user = getUser(req);

  const friends = decorate(db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar, u.last_seen_at
    FROM friends f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ?
    ORDER BY COALESCE(u.display_name, u.username) COLLATE NOCASE
  `).all(user.id));

  const incoming = decorate(db.prepare(`
    SELECT fr.id, u.id AS user_id, u.username, u.display_name, u.avatar, u.last_seen_at
    FROM friend_requests fr
    JOIN users u ON u.id = fr.sender_id
    WHERE fr.receiver_id = ? AND fr.status = 'pending'
  `).all(user.id));

  const outgoing = decorate(db.prepare(`
    SELECT fr.id, u.id AS user_id, u.username, u.display_name, u.avatar, u.last_seen_at
    FROM friend_requests fr
    JOIN users u ON u.id = fr.receiver_id
    WHERE fr.sender_id = ? AND fr.status = 'pending'
  `).all(user.id));

  res.json({ success: true, friends, incoming, outgoing });
});

router.post("/api/friends/remove", requireLogin, (req, res) => {
  const user = getUser(req);
  const targetId = Number(req.body.userId);

  db.prepare(`DELETE FROM friends WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)`)
    .run(user.id, targetId, targetId, user.id);

  res.json({ success: true });
});

module.exports = router;
