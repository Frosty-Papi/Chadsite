const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const { getUser, requireLogin } = require("../middleware/auth");
const { validatePassword } = require("../lib/passwords");
const { deleteAvatarFile, ensureAvatarDir } = require("../lib/files");

const multer = require("multer");
const sharp = require("sharp");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const MAX_AVATAR_BYTES = 1 * 1024 * 1024;

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function wantsJson(req) {
  return req.xhr || String(req.headers.accept || "").includes("application/json");
}

function decoratePresence(rows) {
  const now = Date.now();
  return rows.map(row => {
    const lastSeen = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
    return { ...row, is_online: !!lastSeen && now - lastSeen < 120000 };
  });
}

router.get("/profile", requireLogin, (req, res) => {
  const user = getUser(req);

  const incomingRequests = decoratePresence(db.prepare(`
    SELECT fr.id, fr.sender_id, fr.created_at,
           u.username, u.display_name, u.avatar, u.last_seen_at
    FROM friend_requests fr
    JOIN users u ON u.id = fr.sender_id
    WHERE fr.receiver_id = ? AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
  `).all(user.id));

  const outgoingRequests = decoratePresence(db.prepare(`
    SELECT fr.id, fr.receiver_id, fr.created_at,
           u.username, u.display_name, u.avatar, u.last_seen_at
    FROM friend_requests fr
    JOIN users u ON u.id = fr.receiver_id
    WHERE fr.sender_id = ? AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
  `).all(user.id));

  const friends = decoratePresence(db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar, u.last_seen_at
    FROM friends f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ?
    ORDER BY COALESCE(u.display_name, u.username) COLLATE NOCASE ASC
  `).all(user.id));

  res.render("profile", { incomingRequests, outgoingRequests, friends });
});

router.post("/profile/update", requireLogin, upload.single("avatar"), async (req, res) => {
  const user = getUser(req);
  const hasDisplayName = Object.prototype.hasOwnProperty.call(req.body, "display_name");
  const displayName = hasDisplayName ? String(req.body.display_name || "").trim() : null;

  const existingUser = db.prepare("SELECT avatar FROM users WHERE id = ?").get(user.id);
  const oldAvatar = existingUser?.avatar;
  let newAvatarPath = null;

  try {
    if (req.file) {
      ensureAvatarDir();
      const filename = crypto.randomUUID() + ".webp";
      const outputPath = path.join(__dirname, "..", "storage", "avatars", filename);

      const buffer = await sharp(req.file.buffer)
        .rotate()
        .resize(300, 300, { fit: "cover" })
        .webp({ quality: 82 })
        .toBuffer();

      if (buffer.length > MAX_AVATAR_BYTES) {
        if (wantsJson(req)) return res.status(400).json({ error: "Avatar too large after processing" });
        return res.status(400).send("Avatar too large after processing");
      }

      await fs.promises.writeFile(outputPath, buffer);
      newAvatarPath = `/uploads/avatars/${filename}`;
    }

    if (newAvatarPath && hasDisplayName) {
      db.prepare("UPDATE users SET display_name = ?, avatar = ? WHERE id = ?")
        .run(displayName || null, newAvatarPath, user.id);
    } else if (newAvatarPath) {
      db.prepare("UPDATE users SET avatar = ? WHERE id = ?").run(newAvatarPath, user.id);
    } else if (hasDisplayName) {
      db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(displayName || null, user.id);
    }

    if (newAvatarPath && oldAvatar && oldAvatar !== newAvatarPath) deleteAvatarFile(oldAvatar);

    if (wantsJson(req)) {
      const updatedUser = db.prepare("SELECT id, username, display_name, avatar FROM users WHERE id = ?").get(user.id);
      return res.json({ success: true, user: updatedUser, avatar: updatedUser.avatar });
    }

    res.redirect("/profile");
  } catch (error) {
    if (newAvatarPath) deleteAvatarFile(newAvatarPath);
    if (wantsJson(req)) return res.status(500).json({ error: "Avatar upload failed" });
    res.status(500).send("Avatar upload failed");
  }
});

router.post("/profile/password", requireLogin, (req, res) => {
  const user = getUser(req);
  const { current, new: newPass, confirm } = req.body;

  if (!current || !newPass || !confirm) return res.status(400).send("Missing fields");
  if (newPass !== confirm) return res.status(400).send("Passwords do not match");

  const fullUser = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  if (!fullUser || !bcrypt.compareSync(current, fullUser.password_hash)) {
    return res.status(400).send("Current password is incorrect");
  }

  const err = validatePassword(newPass, fullUser.username);
  if (err) return res.status(400).send(err);

  const hash = bcrypt.hashSync(newPass, 10);
  db.prepare("UPDATE users SET password_hash = ?, must_reset_password = 0, password_reset_token = 0 WHERE id = ?")
    .run(hash, user.id);

  res.redirect("/profile");
});

router.post("/api/profile/friends/request", requireLogin, (req, res) => {
  const user = getUser(req);
  const username = normalizeUsername(req.body.username);

  if (!username) return res.status(400).json({ error: "Username is required" });

  const target = db.prepare("SELECT id, username, display_name FROM users WHERE lower(username) = ?").get(username);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.id === user.id) return res.status(400).json({ error: "You cannot add yourself" });

  const existingFriend = db.prepare("SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?").get(user.id, target.id);
  if (existingFriend) return res.status(409).json({ error: "You are already friends" });

  const existingRequest = db.prepare(`
    SELECT id, sender_id, receiver_id, status
    FROM friend_requests
    WHERE (sender_id = ? AND receiver_id = ?)
       OR (sender_id = ? AND receiver_id = ?)
  `).get(user.id, target.id, target.id, user.id);

  if (existingRequest?.status === "pending") return res.status(409).json({ error: "A pending friend request already exists" });
  if (existingRequest) db.prepare("DELETE FROM friend_requests WHERE id = ?").run(existingRequest.id);

  db.prepare("INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES (?, ?, 'pending')").run(user.id, target.id);
  res.json({ success: true });
});

router.post("/api/profile/friends/respond", requireLogin, (req, res) => {
  const user = getUser(req);
  const requestId = Number.parseInt(req.body.requestId, 10);
  const action = String(req.body.action || "").trim().toLowerCase();

  if (!Number.isInteger(requestId) || !["accept", "reject"].includes(action)) return res.status(400).json({ error: "Invalid request" });

  const request = db.prepare("SELECT id, sender_id, receiver_id, status FROM friend_requests WHERE id = ? AND receiver_id = ?")
    .get(requestId, user.id);
  if (!request || request.status !== "pending") return res.status(404).json({ error: "Friend request not found" });

  if (action === "reject") {
    db.prepare("UPDATE friend_requests SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(requestId);
    return res.json({ success: true });
  }

  db.transaction(() => {
    db.prepare("UPDATE friend_requests SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(requestId);
    db.prepare("INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)").run(user.id, request.sender_id);
    db.prepare("INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)").run(request.sender_id, user.id);
  })();

  res.json({ success: true });
});

module.exports = router;
