const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const { getUser, requireLogin } = require("../middleware/auth");

const router = express.Router();

router.get("/profile", requireLogin, (req, res) => {
    res.render("profile");
});

router.post("/profile/password", requireLogin, (req, res) => {
    const user = getUser(req);
    const { current, new: newPass, confirm } = req.body;

    if (newPass !== confirm) {
        return res.send("Passwords do not match");
    }

    const dbUser = db.prepare(
        "SELECT password_hash FROM users WHERE id = ?"
    ).get(user.id);

    if (!bcrypt.compareSync(current, dbUser.password_hash)) {
        return res.send("Wrong password");
    }

    const hash = bcrypt.hashSync(newPass, 10);

    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .run(hash, user.id);

    res.redirect("/profile");
});

module.exports = router;
