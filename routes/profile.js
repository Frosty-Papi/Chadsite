const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const { getUser, requireLogin } = require("../middleware/auth");
const { validatePassword } = require("../lib/passwords");
const multer = require("multer");
const path = require("path");
const router = express.Router();

const storage = multer.diskStorage({
  destination: "public/uploads/avatars",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || ".png");
    cb(null, `avatar_${req.session.userId}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }
});

router.get("/profile", requireLogin, (req, res) => {
  res.render("profile");
});

router.post("/profile/password", requireLogin, (req, res) => {
  const user = getUser(req);
  const { current, new: newPass, confirm } = req.body;

  if (newPass !== confirm) {
    return res.send("Passwords do not match");
  }

  const err = validatePassword(newPass, user.username);
  if (err) return res.send(err);

  const dbUser = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id);

  if (!bcrypt.compareSync(current, dbUser.password_hash)) {
    return res.send("Wrong password");
  }

  const hash = bcrypt.hashSync(newPass, 10);

  db.prepare(`UPDATE users SET password_hash = ?, must_reset_password = 0, password_reset_token = 0 WHERE id = ?`)
    .run(hash, user.id);

  res.redirect("/profile");
});

router.post("/profile/update", requireLogin, upload.single("avatar"), (req, res) => {
  const user = getUser(req);
  const displayName = (req.body.display_name || "").trim();
  const avatarPath = req.file ? `/uploads/avatars/${req.file.filename}` : null;

  if (avatarPath) {
    db.prepare(`UPDATE users SET display_name = ?, avatar = ? WHERE id = ?`)
      .run(displayName || null, avatarPath, user.id);
  } else {
    db.prepare(`UPDATE users SET display_name = ? WHERE id = ?`)
      .run(displayName || null, user.id);
  }

  res.redirect("/profile");
});

module.exports = router;
