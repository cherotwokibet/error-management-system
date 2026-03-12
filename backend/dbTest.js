require('dotenv').config();
const { Pool } = require('pg');

// Create a new connection pool using your .env variables
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Connection Successful!');
    console.log('Current Server Time:', res.rows[0].now);
    await pool.end();
  } catch (err) {
    console.error('❌ Connection Error:', err.stack);
  }
}

testConnection();