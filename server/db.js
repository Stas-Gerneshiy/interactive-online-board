require('dotenv').config();

const { Pool } = require('pg');

let pool;

if (process.env.DATABASE_URL) {

    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

} else {

    const requiredEnv = [
        'DB_USER',
        'DB_HOST',
        'DB_NAME',
        'DB_PASSWORD',
        'DB_PORT',
        'JWT_SECRET',
        'GOOGLE_CLIENT_ID'
    ];

    for (const key of requiredEnv) {
        if (!process.env[key]) {
            throw new Error(
                `Missing environment variable: ${key}. Check your .env file.`
            );
        }
    }

    pool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT)
    });
}

module.exports = pool;