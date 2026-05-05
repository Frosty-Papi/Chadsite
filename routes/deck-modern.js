const express = require("express");
const db = require("../db");

const router = express.Router();

router.get('/load', (req, res) => {
    const userId = req.session?.userId || null;

    if (userId) {
        const row = db.prepare(`
        SELECT builds FROM user_decks WHERE user_id = ?
        `).get(userId);

        if (!row || !row.builds) return res.json({ builds: [], lastPlayed: 0 });

        return res.json({
            builds: JSON.parse(row.builds),
                        lastPlayed: row.last_played || 0
        });
    }

    return res.json(req.session.builds || []);
});

router.post('/save', (req, res) => {
    try {
        const userId = req.session?.userId || null;
        const builds = JSON.stringify(req.body.builds || []);
        const lastPlayed = req.body.lastPlayed ?? 0;

        db.prepare(`
        INSERT INTO user_decks (user_id, builds, last_played)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
        builds = excluded.builds,
        last_played = excluded.last_played,
        updated_at = CURRENT_TIMESTAMP
        `).run(userId, builds, lastPlayed);

        res.json({ success: true });
    } catch (err) {
        console.error("🔥 SAVE ERROR:", err);   // ← THIS IS KEY
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
