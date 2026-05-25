require('dotenv').config();

const jwt = require('jsonwebtoken');
const pool = require('../db');

async function optionalAuthMiddleware(req, res, next) {

    try {

        const authHeader = req.headers.authorization;

        if (!authHeader) {
            req.user = null;
            return next();
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            req.user = null;
            return next();
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const result = await pool.query(
            `SELECT id, email, role, blocked
             FROM users
             WHERE id=$1`,
            [decoded.id]
        );

        if (result.rows.length === 0 || result.rows[0].blocked) {
            req.user = null;
            return next();
        }

        req.user = result.rows[0];

        next();

    } catch (err) {

        req.user = null;
        next();
    }
}

module.exports = optionalAuthMiddleware;