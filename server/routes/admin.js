const express = require('express');
const router = express.Router();

const pool = require('../db');

const authMiddleware =
    require('../middleware/authMiddleware');

const adminMiddleware =
    require('../middleware/adminMiddleware');


// =========================
// GET USERS
// =========================
router.get(
    '/users',
    authMiddleware,
    adminMiddleware,

    async (req, res) => {

        const result = await pool.query(
            `SELECT id, email, role, blocked
             FROM users
             ORDER BY id`
        );

        res.json(result.rows);
    }
);


// =========================
// BLOCK USER
// =========================
router.put(
    '/users/:id/block',
    authMiddleware,
    adminMiddleware,

    async (req, res) => {

        const id = parseInt(req.params.id);

        if (!Number.isInteger(id)) {
            return res.status(400).json({
                error: 'Invalid user id'
            });
        }

        if (id === req.user.id) {
            return res.status(400).json({
                error: 'Admin cannot block himself'
            });
        }

        await pool.query(
            `UPDATE users
             SET blocked=true
             WHERE id=$1`,
            [id]
        );

        res.json({
            ok:true
        });
    }
);


// =========================
// UNBLOCK USER
// =========================
router.put(
    '/users/:id/unblock',
    authMiddleware,
    adminMiddleware,

    async (req, res) => {

        const id = parseInt(req.params.id);

        if (!Number.isInteger(id)) {
            return res.status(400).json({
                error: 'Invalid user id'
            });
        }

        await pool.query(
            `UPDATE users
             SET blocked=false
             WHERE id=$1`,
            [id]
        );

        res.json({
            ok:true
        });
    }
);


// =========================
// DELETE USER
// =========================
router.delete(
    '/users/:id',
    authMiddleware,
    adminMiddleware,

    async (req, res) => {

        const id = parseInt(req.params.id);

        if (!Number.isInteger(id)) {
            return res.status(400).json({
                error: 'Invalid user id'
            });
        }

        if (id === req.user.id) {
            return res.status(400).json({
                error: 'Admin cannot delete himself'
            });
        }

        // delete elements
        await pool.query(
            `DELETE FROM elements
             WHERE board_id IN (
                SELECT id
                FROM boards
                WHERE user_id=$1
             )`,
            [id]
        );

        // delete boards
        await pool.query(
            'DELETE FROM boards WHERE user_id=$1',
            [id]
        );

        // delete user
        await pool.query(
            'DELETE FROM users WHERE id=$1',
            [id]
        );

        res.json({
            ok:true
        });
    }
);


// =========================
// GET BOARDS
// =========================
router.get(
    '/boards',
    authMiddleware,
    adminMiddleware,

    async (req, res) => {

        const result = await pool.query(
            `SELECT boards.*,
                    users.email
             FROM boards
             JOIN users
             ON boards.user_id = users.id
             ORDER BY boards.id`
        );

        res.json(result.rows);
    }
);


// =========================
// DELETE BOARD
// =========================
router.delete(
    '/boards/:id',
    authMiddleware,
    adminMiddleware,

    async (req, res) => {

        const id = parseInt(req.params.id);

        if (!Number.isInteger(id)) {
            return res.status(400).json({
                error: 'Invalid board id'
            });
        }

        await pool.query(
            'DELETE FROM elements WHERE board_id=$1',
            [id]
        );

        await pool.query(
            'DELETE FROM boards WHERE id=$1',
            [id]
        );

        res.json({
            ok:true
        });
    }
);


// =========================
// STATS
// =========================
router.get(
    '/stats',
    authMiddleware,
    adminMiddleware,

    async (req, res) => {

        const users = await pool.query(
            'SELECT COUNT(*) FROM users'
        );

        const boards = await pool.query(
            'SELECT COUNT(*) FROM boards'
        );

        res.json({
            users: users.rows[0].count,
            boards: boards.rows[0].count
        });
    }
);

module.exports = router;