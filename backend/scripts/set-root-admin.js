require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

async function main() {
  const email = 'bcherotwo@stima-sacco.com';
  const username = 'Boniface Cherotwo';
  const password = 'Qazwsx1212@';
  const hash = await bcrypt.hash(password, 12);

  await pool.query(
    "INSERT INTO users (username, email, password_hash, role, is_active) VALUES ($1, $2, $3, 'admin', TRUE) ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username, password_hash = EXCLUDED.password_hash, role = 'admin', is_active = TRUE",
    [username, email, hash]
  );

  const { rows } = await pool.query(
    'SELECT id, username, email, role, is_active FROM users WHERE email = $1',
    [email]
  );

  console.log(JSON.stringify(rows[0]));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
