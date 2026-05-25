const express = require('express');

const router = express.Router();

const pool = require('../db');

const optionalAuthMiddleware =
    require('../middleware/optionalAuthMiddleware');

const {
    getBoardAccess
} = require('../utils/boardAccess');


// =======================
// GET ELEMENTS
// =======================
router.get(
    '/boards/:id/elements',
    optionalAuthMiddleware,

    async (req, res) => {

        const id =
            parseInt(req.params.id);

        if (!Number.isInteger(id)) {
            return res.status(400).json({
                error: 'Invalid board id'
            });
        }

        const shareToken =
            req.headers['x-share-token'];

        const access =
            await getBoardAccess(
                id,
                req.user?.id,
                shareToken
            );

        if(!access.access){

            return res.status(403).json({
                error:'Access denied'
            });
        }

        const result = await pool.query(
            `SELECT *
            FROM elements
            WHERE board_id=$1
            ORDER BY id`,
            [id]
        );

        res.json(result.rows);
    }
);


// =======================
// CREATE ELEMENT
// =======================
router.post(
    '/elements',
    optionalAuthMiddleware,

    async (req, res) => {

        try {

            const {
                board_id,
                x,
                y,
                text,
                color,
                type,
                rotation
            } = req.body;

            const allowedTypes = ['note', 'rect', 'line'];

            if (type && !allowedTypes.includes(type)) {
                return res.status(400).json({
                    error: 'Invalid element type'
                });
            }

            const boardId =
                Number(board_id);

            if (!Number.isInteger(boardId)) {
                return res.status(400).json({
                    error: 'Valid board_id required'
                });
            }

            const shareToken =
                req.headers['x-share-token'];

            const access =
                await getBoardAccess(
                    boardId,
                    req.user?.id,
                    shareToken
                );

            if (!access.access) {
                return res.status(403).json({
                    error: 'Access denied'
                });
            }

            if (access.mode === 'view') {
                return res.status(403).json({
                    error: 'View only access'
                });
            }

            const finalType =
                type || 'note';

            const finalX =
                Number.isFinite(Number(x))
                    ? Number(x)
                    : 100;

            const finalY =
                Number.isFinite(Number(y))
                    ? Number(y)
                    : 100;

            const finalWidth =
                Number.isFinite(Number(req.body.width))
                    ? Number(req.body.width)
                    : 160;

            const finalHeight =
                Number.isFinite(Number(req.body.height))
                    ? Number(req.body.height)
                    : 100;

            let finalColor =
                color;

            if (!finalColor && finalType === 'note') {
                finalColor = 'yellow';
            }

            if (!finalColor && finalType === 'rect') {
                finalColor = 'blue';
            }

            if (!finalColor && finalType === 'line') {
                finalColor = 'green';
            }

            const finalRotation =
                Number.isFinite(Number(rotation))
                    ? Number(rotation)
                    : 0;

            const result =
                await pool.query(
                    `INSERT INTO elements
                    (
                        board_id,
                        x,
                        y,
                        width,
                        height,
                        text,
                        color,
                        type,
                        rotation
                    )
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                    RETURNING *`,
                    [
                        boardId,
                        finalX,
                        finalY,
                        finalWidth,
                        finalHeight,
                        text || '',
                        finalColor,
                        finalType,
                        finalRotation
                    ]
                );

            res.json(result.rows[0]);

        } catch (err) {

            console.error('Create element error:', err);

            res.status(500).json({
                error: 'Create element error'
            });
        }
    }
);


// =======================
// UPDATE ELEMENT
// =======================
router.put(
    '/elements/:id',
    optionalAuthMiddleware,

    async (req, res) => {

        try {

            const id =
                Number(req.params.id);

            if (!Number.isInteger(id)) {
                return res.status(400).json({
                    error: 'Invalid element id'
                });
            }

            const shareToken =
                req.headers['x-share-token'];

            const boardResult =
                await pool.query(
                    `SELECT board_id
                     FROM elements
                     WHERE id=$1`,
                    [id]
                );

            if (boardResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Element not found'
                });
            }

            const boardId =
                boardResult.rows[0].board_id;

            const access =
                await getBoardAccess(
                    boardId,
                    req.user?.id,
                    shareToken
                );

            if (!access.access) {
                return res.status(403).json({
                    error: 'Access denied'
                });
            }

            if (access.mode === 'view') {
                return res.status(403).json({
                    error: 'View only access'
                });
            }

            const {
                x,
                y,
                text,
                width,
                height,
                color,
                type,
                rotation
            } = req.body;

            const allowedTypes = ['note', 'rect', 'line'];

            if (type && !allowedTypes.includes(type)) {
                return res.status(400).json({
                    error: 'Invalid element type'
                });
            }

            const finalX =
                Number.isFinite(Number(x))
                    ? Number(x)
                    : 100;

            const finalY =
                Number.isFinite(Number(y))
                    ? Number(y)
                    : 100;

            const finalWidth =
                Number.isFinite(Number(width))
                    ? Number(width)
                    : 160;

            const finalHeight =
                Number.isFinite(Number(height))
                    ? Number(height)
                    : 100;

            const finalRotation =
                Number.isFinite(Number(rotation))
                    ? Number(rotation)
                    : 0;

            await pool.query(
                `UPDATE elements
                SET
                    x=$1,
                    y=$2,
                    text=$3,
                    width=$4,
                    height=$5,
                    color=$6,
                    type=$7,
                    rotation=$8,
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=$9`,
                [
                    finalX,
                    finalY,
                    text || '',
                    finalWidth,
                    finalHeight,
                    color || 'yellow',
                    type || 'note',
                    finalRotation,
                    id
                ]
            );

            res.json({
                ok: true
            });

        } catch (err) {

            console.error('Update element error:', err);

            res.status(500).json({
                error: 'Update element error'
            });
        }
    }
);


// =======================
// DELETE ELEMENT
// =======================
router.delete(
    '/elements/:id',
    optionalAuthMiddleware,

    async (req, res) => {

        const id =
            parseInt(req.params.id);

        if (!Number.isInteger(id)) {
            return res.status(400).json({
                error: 'Invalid element id'
            });
        }

        const shareToken =
            req.headers['x-share-token'];

        const boardResult =
            await pool.query(
                `SELECT board_id
                 FROM elements
                 WHERE id=$1`,
                [id]
            );

        if(boardResult.rows.length === 0){

            return res.status(404).json({
                error:'Element not found'
            });
        }

        const boardId =
            boardResult.rows[0].board_id;

        const access =
            await getBoardAccess(
                boardId,
                req.user?.id,
                shareToken
            );

        if(!access.access){

            return res.status(403).json({
                error:'Access denied'
            });
        }

        if(access.mode === 'view'){

            return res.status(403).json({
                error:'View only access'
            });
        }

        await pool.query(
            `DELETE FROM elements
             WHERE id=$1`,
            [id]
        );

        res.json({
            ok:true
        });
    }
);

module.exports = router;