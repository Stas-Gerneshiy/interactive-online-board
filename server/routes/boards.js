const express = require('express');
const router = express.Router();

const pool = require('../db');

const authMiddleware =
    require('../middleware/authMiddleware');


// =======================
// GET BOARDS
// =======================
router.get(
    '/',
    authMiddleware,

    async (req, res) => {

        const result = await pool.query(
            `SELECT *
             FROM boards
             WHERE user_id=$1
             ORDER BY id`,
            [req.user?.id]
        );

        res.json(result.rows);
    }
);


// =======================
// CREATE BOARD
// =======================
router.post(
    '/',
    authMiddleware,

    async (req, res) => {

        const result = await pool.query(
            `INSERT INTO boards
             (title, user_id)
             VALUES ($1, $2)
             RETURNING *`,
            [
                'Нова дошка',
                req.user?.id
            ]
        );

        res.json(result.rows[0]);
    }
);


// =======================
// UPDATE BOARD
// =======================
router.put(
    '/:id',
    authMiddleware,

    async (req, res) => {

        const id =
            parseInt(req.params.id);

        if (!Number.isInteger(id)) {
            return res.status(400).json({
                error: 'Invalid board id'
            });
        }

        const check = await pool.query(
            `SELECT *
             FROM boards
             WHERE id=$1
             AND user_id=$2`,
            [id, req.user?.id]
        );

        if(check.rows.length === 0){

            return res.status(403).json({
                error:'Access denied'
            });
        }

        const { title } = req.body;

        if(!title){

            return res.status(400).json({
                error:'Title required'
            });
        }

        await pool.query(
            `UPDATE boards
             SET title=$1
             WHERE id=$2`,
            [title, id]
        );

        res.json({
            ok:true
        });
    }
);


// =======================
// DELETE BOARD
// =======================
router.delete(
    '/:id',
    authMiddleware,

    async (req, res) => {

        const id =
            parseInt(req.params.id);

        if (!Number.isInteger(id)) {
            return res.status(400).json({
                error: 'Invalid board id'
            });
        }

        const check = await pool.query(
            `SELECT *
             FROM boards
             WHERE id=$1
             AND user_id=$2`,
            [id, req.user?.id]
        );

        if(check.rows.length === 0){

            return res.status(403).json({
                error:'Access denied'
            });
        }

        await pool.query(
            `DELETE FROM elements
             WHERE board_id=$1`,
            [id]
        );

        await pool.query(
            `DELETE FROM boards
             WHERE id=$1`,
            [id]
        );

        res.json({
            ok:true
        });
    }
);

module.exports = router;