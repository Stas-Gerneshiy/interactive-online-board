require('dotenv').config();

const jwt = require('jsonwebtoken');
const pool = require('../db');

async function authMiddleware(req, res, next) {

    try {

        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                error: 'No token'
            });
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                error: 'Token missing'
            });
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

        if (result.rows.length === 0) {
            return res.status(401).json({
                error: 'User not found'
            });
        }

        const user = result.rows[0];

        if (user.blocked) {
            return res.status(403).json({
                error: 'Account blocked'
            });
        }

        req.user = {
            id: user.id,
            email: user.email,
            role: user.role
        };

        next();

    } catch (err) {

        return res.status(401).json({
            error: 'Invalid token'
        });
    }
}

module.exports = authMiddleware;