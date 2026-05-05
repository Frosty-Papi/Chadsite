const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");

const router = express.Router();

router.get('/api/deck/load', (req, res) => {
    const userId = req.session?.user?.id || null;

    if (userId) {
        const row = db.prepare(`
        SELECT deck_state FROM user_decks WHERE user_id = ?
        `).get(userId);

        if (!row) return res.json(null);

        return res.json(JSON.parse(row.deck_state));
    }

    // Guest → load from session
    return res.json(req.session.deckState || null);
});

router.post('/api/deck/save', (req, res) => {
    const userId = req.session?.user?.id || null;

    const deck = JSON.stringify(req.body);

    if (userId) {
        // Logged-in user → save to DB
        db.prepare(`
        INSERT INTO user_decks (user_id, deck_state)
        VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
        deck_state = excluded.deck_state,
        updated_at = CURRENT_TIMESTAMP
        `).run(userId, deck);

        return res.json({ success: true, type: 'user' });
    }

    // Guest → store in session
    req.session.deckState = req.body;

    res.json({ success: true, type: 'guest' });
});

module.exports = router;
