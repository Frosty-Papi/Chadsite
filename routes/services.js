const express = require("express");
const db = require("../db");
const { getUser } = require("../middleware/auth");

const router = express.Router();

function requireServiceAccess(path) {
    return (req, res, next) => {
        const user = getUser(req);
        if (!user) return res.redirect("/login");

        const service = db.prepare(
            "SELECT * FROM services WHERE path = ?"
        ).get(path);

        const allowed = db.prepare(`
        SELECT 1 FROM permissions
        WHERE user_id = ? AND service_id = ?
        `).get(user.id, service.id);

        if (!allowed) return res.status(403).send("Access denied");

        next();
    };
}

router.get("/deck", requireServiceAccess("/deck"), (req, res) => {
    res.render("deck");
});

module.exports = router;
