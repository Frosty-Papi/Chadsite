const express = require("express");
const db = require("../db");

const router = express.Router();

router.get('/load', (req, res) => {
    const userId = req.session?.userId || null;

    if (userId) {
        const row = db.prepare(`
        SELECT builds FROM user_decks WHERE user_id = ?
        `).get(userId);

        if (!row || !row.builds) return res.json([]);

        return res.json(JSON.parse(row.builds));
    }

    return res.json(req.session.builds || []);
});

router.post('/save', (req, res) => {
    const userId = req.session?.userId || null;
    const builds = JSON.stringify(req.body.builds || []);

    if (userId) {
        db.prepare(`
        INSERT INTO user_decks (user_id, builds)
        VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
        builds = excluded.builds,
        updated_at = CURRENT_TIMESTAMP
        `).run(userId, builds);

        return res.json({ success: true });
    }

    req.session.builds = req.body.builds || [];
    res.json({ success: true });
});

module.exports = router;
