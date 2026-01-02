const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function testConnection() {
    try {
        console.log('Testing database connection...');
        console.log('Config:', {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD ? '***' : 'undefined'
        });

        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as timestamp, version() as version');
        console.log('Connection successful!');
        console.log('Timestamp:', result.rows[0].timestamp);
        console.log('Version:', result.rows[0].version);
        client.release();
        await pool.end();
    } catch (error) {
        console.error('Connection failed:', error.message);
        console.error('Error details:', error);
    }
}

testConnection();