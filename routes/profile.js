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
                      limits: { fileSize: 5 * 1024 * 1024 } // 5MB upload limit
});

const MAX_AVATAR_BYTES = 1 * 1024 * 1024; // 1MB final limit

router.get("/profile", requireLogin, (req, res) => {
  res.render("profile");
});

router.post("/profile/update", requireLogin, upload.single("avatar"), async (req, res) => {
  const user = getUser(req);
  const displayName = (req.body.display_name || "").trim();

  const existingUser = db.prepare("SELECT avatar FROM users WHERE id = ?").get(user.id);
  const oldAvatar = existingUser?.avatar;

  let newAvatarPath = null;

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
      return res.status(400).send("Avatar too large after processing");
    }

    await fs.promises.writeFile(outputPath, buffer);

    newAvatarPath = `/uploads/avatars/${filename}`;
  }

  if (newAvatarPath) {
    db.prepare(`UPDATE users SET display_name = ?, avatar = ? WHERE id = ?`)
    .run(displayName || null, newAvatarPath, user.id);

    if (oldAvatar && oldAvatar !== newAvatarPath) {
      deleteAvatarFile(oldAvatar);
    }
  } else {
    db.prepare(`UPDATE users SET display_name = ? WHERE id = ?`)
    .run(displayName || null, user.id);
  }

  res.redirect("/profile");
});

module.exports = router;
