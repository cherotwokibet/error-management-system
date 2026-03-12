require('dotenv').config();
const pool = require('../config/database');

(async () => {
  await pool.query("ALTER TABLE errors ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL DEFAULT 'Untitled'");
  const { rows } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='errors' AND column_name='title'");
  console.log(rows.length ? 'title column ready' : 'title column missing');
  await pool.end();
})().catch(async (e) => {
  console.error(e);
  try { await pool.end(); } catch (_) {}
  process.exit(1);
});
