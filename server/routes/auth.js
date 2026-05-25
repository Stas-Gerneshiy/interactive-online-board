const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const jwt = require('jsonwebtoken');
const router = express.Router();

const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID
);

// REGISTER
router.post('/register', async (req, res) => {

    try {

        const { email, password } = req.body;

        // 1. перевірка
        if (!email || !password) {
            return res.status(400).json({
                error: 'Missing fields'
            });
        }

        if(password.length < 6){
            return res.status(400).json({
                error: 'Password too short'
            });
        }

        // 2. чи існує користувач
        const existing = await pool.query(
            'SELECT * FROM users WHERE email=$1',
            [email]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({
                error: 'User already exists'
            });
        }

        // 3. hash password
        const hashedPassword =
            await bcrypt.hash(password, 10);

        // 4. save user
        const result = await pool.query(
            `INSERT INTO users (email, password)
             VALUES ($1, $2)
             RETURNING id, email, role`,
            [email, hashedPassword]
        );

        // 5. response
        res.json(result.rows[0]);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: 'Server error'
        });
    }
});

// LOGIN
router.post('/login', async (req, res) => {

    try {

        const { email, password } = req.body;

        // 1. знайти юзера
        const result = await pool.query(
            'SELECT * FROM users WHERE email=$1',
            [email]
        );

        // 2. якщо нема
        if (result.rows.length === 0) {
            return res.status(400).json({
                error: 'User not found'
            });
        }

        const user = result.rows[0];

        if (!user.password && user.auth_provider === 'google') {
            return res.status(400).json({
                error: 'Use Google login'
            });
        }

        // BLOCK CHECK
        if(user.blocked){

            return res.status(403).json({
                error:'Account blocked'
            });
        }

        // 3. перевірка пароля
        const validPassword =
            await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(400).json({
                error: 'Wrong password'
            });
        }

        // 4. створити token
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '7d'
            }
        );

        // 5. response
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: 'Server error'
        });
    }
});

// GOOGLE AUTH
router.post('/google', async (req, res) => {

    try {

        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({
                error: 'Google credential required'
            });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        const email = payload.email;
        const googleId = payload.sub;

        if (!email || !googleId) {
            return res.status(400).json({
                error: 'Invalid Google account'
            });
        }

        let result = await pool.query(
            'SELECT * FROM users WHERE email=$1',
            [email]
        );

        let user;

        if (result.rows.length === 0) {

            const created = await pool.query(
                `INSERT INTO users
                 (email, password, auth_provider, google_id)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [
                    email,
                    null,
                    'google',
                    googleId
                ]
            );

            user = created.rows[0];

        } else {

            user = result.rows[0];

            if (!user.google_id) {
                await pool.query(
                    `UPDATE users
                     SET google_id=$1,
                         auth_provider=$2
                     WHERE id=$3`,
                    [
                        googleId,
                        'google',
                        user.id
                    ]
                );
            }
        }

        if (user.blocked) {
            return res.status(403).json({
                error: 'Account blocked'
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '7d'
            }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: 'Google auth error'
        });
    }
});

module.exports = router;