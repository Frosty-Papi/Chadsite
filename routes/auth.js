const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const { validatePassword } = require("../lib/passwords");

const router = express.Router();

router.get("/login", (req, res) => {
  res.render("login", { error: req.query.error });
});

router.post("/login", (req, res) => {
  const { username, password } = req.body;

  const username = String(req.body.username || "").trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE lower(username) = ?").get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.render("login", { error: "Invalid login" });
  }

  if (user.is_disabled) {
    if (user.disabled_until && new Date(user.disabled_until) <= new Date()) {
      db.prepare(`UPDATE users SET is_disabled = 0, disabled_until = NULL, disable_reason = NULL WHERE id = ?`).run(user.id);
    } else {
      return res.render("login", { error: "Account disabled" });
    }
  }

  req.session.regenerate(() => {
    req.session.userId = user.id;

    if (user.must_reset_password) {
      return res.redirect("/force-reset");
    }

    res.redirect("/");
  });
});

router.get("/force-reset", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  res.render("force-reset");
});

router.post("/force-reset", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");

  const { new: newPass, confirm } = req.body;

  if (newPass !== confirm) {
    return res.send("Passwords do not match");
  }

  const err = validatePassword(newPass);
  if (err) return res.send(err);

  const hash = bcrypt.hashSync(newPass, 10);

  db.prepare(`UPDATE users SET password_hash = ?, must_reset_password = 0, password_reset_token = 0 WHERE id = ?`)
    .run(hash, req.session.userId);

  res.redirect("/");
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

module.exports = router;
