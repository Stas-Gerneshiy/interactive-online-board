require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const path = require('path');
const pool = require('./db');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');

const authMiddleware =
    require('./middleware/authMiddleware');

const adminRoutes =
    require('./routes/admin');

const authRoutes =
    require('./routes/auth');

const boardsRoutes =
    require('./routes/boards');

const elementsRoutes =
    require('./routes/elements');

const app = express();

app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginOpenerPolicy: false,
        crossOriginEmbedderPolicy: false
    })
);

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/boards', boardsRoutes);

app.use('/api', elementsRoutes);

// API STATUS
app.get('/api', (req, res) => {

    res.json({
        name:'Collab Board API',
        version:'1.0',
        status:'working',

        endpoints:{
            auth:'/api/auth',
            boards:'/api/boards',
            elements:'/api/elements',
            admin:'/api/admin',
            share:'/api/share'
        }
    });
});

app.use(express.static(path.join(__dirname, '../public')));

app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
});

// =======================
// SHARE PAGE
// =======================

app.get('/share/:token', (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            '../public/index.html'
        )
    );
});

// =======================
// SHARE BOARD
// =======================

app.post(
    '/api/boards/:id/share',
    authMiddleware,

    async (req, res) => {

        try {

            const boardId =
                parseInt(req.params.id);

            if (!Number.isInteger(boardId)) {
                return res.status(400).json({
                    error: 'Invalid board id'
                });
            }

            const { mode } = req.body;

            // only view/edit
            if(
                mode !== 'view' &&
                mode !== 'edit'
            ){
                return res.status(400).json({
                    error:'Invalid mode'
                });
            }

            // check owner
            const check = await pool.query(
                `SELECT *
                FROM boards
                WHERE id=$1
                AND user_id=$2`,
                [boardId, req.user?.id]
            );

            if(check.rows.length === 0){

                return res.status(403).json({
                    error:'Access denied'
                });
            }

            // перевірка чи вже існує share
            const existingShare = await pool.query(
                `SELECT *
                FROM board_shares
                WHERE board_id=$1
                AND mode=$2`,
                [boardId, mode]
            );

            if(existingShare.rows.length > 0){

                return res.json(
                    existingShare.rows[0]
                );
            }

            // generate token
            const token =
                crypto.randomBytes(16)
                .toString('hex');

            // save share
            const result = await pool.query(
                `INSERT INTO board_shares
                (board_id, token, mode)
                VALUES ($1, $2, $3)
                RETURNING *`,
                [
                    boardId,
                    token,
                    mode
                ]
            );

            res.json(result.rows[0]);

        } catch (err) {

            console.error('Share create error:', err);

            res.status(500).json({
                error: 'Share create error'
            });
        }
    }
);

// =======================
// GET SHARE ACCESS
// =======================

app.get(
    '/api/share/:token',

    async (req, res) => {

        try {

            const token = req.params.token;

            if(!token){

                return res.status(400).json({
                    error:'Token required'
                });
            }

            const result = await pool.query(
                `SELECT
                    board_shares.*,
                    boards.title
                FROM board_shares
                JOIN boards
                ON board_shares.board_id = boards.id
                WHERE token=$1`,
                [token]
            );

            if(result.rows.length === 0){

                return res.status(404).json({
                    error:'Share not found'
                });
            }

            res.json(result.rows[0]);

        } catch (err) {

            console.error('Share load error:', err);

            res.status(500).json({
                error: 'Share load error'
            });
        }
    }
);

// =======================

io.on('connection', (socket) => {

    console.log('USER CONNECTED');

    // JOIN BOARD
    socket.on('join-board', (boardId) => {

        // leave previous
        if (socket.boardId) {
            socket.leave('board-' + socket.boardId);
        }

        // save current
        socket.boardId = boardId;

        // join new
        socket.join('board-' + boardId);

        console.log('JOIN BOARD', boardId);
    });

    // ELEMENT UPDATED
    socket.on('element-update', (data) => {

        socket.to('board-' + data.boardId)
            .emit('element-updated', data);
    });

    // ELEMENT CREATED
    socket.on('element-create', (data) => {

        socket.to('board-' + data.boardId)
            .emit('element-created', data);
    });

    // ELEMENT DELETED
    socket.on('element-delete', (data) => {

        socket.to('board-' + data.boardId)
            .emit('element-deleted', data);
    });

    socket.on('disconnect', () => {
        console.log('USER DISCONNECTED');
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});