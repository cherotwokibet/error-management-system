const bcrypt = require('bcryptjs');
const pool = require('../config/database');

const toBool = (value) => String(value || '').trim().toLowerCase() === 'true';

async function enforceRootAdminOnStart() {
  if (!toBool(process.env.ENFORCE_ROOT_ADMIN_ON_START)) return;

  const username = (process.env.ROOT_ADMIN_USERNAME || '').trim();
  const email = (process.env.ROOT_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ROOT_ADMIN_PASSWORD || '');

  if (!username || !email || !password) {
    console.warn('Skipping root-admin enforcement: missing ROOT_ADMIN_USERNAME, ROOT_ADMIN_EMAIL, or ROOT_ADMIN_PASSWORD');
    return;
  }

  const hash = await bcrypt.hash(password, 12);

  await pool.query(
    `INSERT INTO users (username, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, 'admin', TRUE)
     ON CONFLICT (email)
     DO UPDATE SET
       username = EXCLUDED.username,
       password_hash = EXCLUDED.password_hash,
       role = 'admin',
       is_active = TRUE`,
    [username, email, hash]
  );

  await pool.query(
    `UPDATE users
     SET role = 'viewer'
     WHERE role = 'admin' AND email <> $1`,
    [email]
  );

  console.log(`Root admin enforced for ${email}`);
}

module.exports = { enforceRootAdminOnStart };
