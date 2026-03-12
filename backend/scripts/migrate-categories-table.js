require('dotenv').config();
const pool = require('../config/database');

const defaults = ['UI Bug', 'Server Error', 'Database', 'Performance', 'Security', 'Logic', 'Other'];

(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(50) UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const name of defaults) {
    await pool.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  }

  const { rows } = await pool.query('SELECT id, name FROM categories ORDER BY name ASC');
  console.log(`categories ready: ${rows.length}`);
  await pool.end();
})().catch(async (err) => {
  console.error(err);
  try { await pool.end(); } catch (_) {}
  process.exit(1);
});
