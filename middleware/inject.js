const db = require("../db");
const { getUser } = require("./auth");

module.exports = (req, res, next) => {
    const user = getUser(req);

    res.locals.user = user;

    if (user) {
        res.locals.services = db.prepare(`
        SELECT s.*
        FROM services s
        JOIN permissions p ON p.service_id = s.id
        WHERE p.user_id = ?
        `).all(user.id);
    } else {
        res.locals.services = [];
    }

    next();
};
