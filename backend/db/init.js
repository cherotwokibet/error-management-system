require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'error_management',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function init() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('✅ Database initialized successfully');
    console.log('📧 Default admin: admin@errormanagement.app / Admin@123');
  } catch (err) {
    console.error('❌ DB init error:', err.message);
  } finally {
    await pool.end();
  }
}

init();
