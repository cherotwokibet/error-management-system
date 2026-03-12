require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

async function main() {
  const name = process.env.ROOT_ADMIN_NAME || 'Boniface Kibet';
  const username = process.env.ROOT_ADMIN_USERNAME || 'bcherotwo';
  const email = process.env.ROOT_ADMIN_EMAIL || 'bcherotwo@stima-sacco.com';
  const password = process.env.ROOT_ADMIN_PASSWORD || 'Qazwsx1212@';
  const hash = await bcrypt.hash(password, 12);

  // Ensure the designated root admin account exists and is active.
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

  // Enforce a single root admin by demoting every other admin account.
  await pool.query(
    `UPDATE users
     SET role = 'viewer'
     WHERE role = 'admin' AND email <> $1`,
    [email]
  );

  const { rows } = await pool.query(
    `SELECT id, username, email, role, is_active
     FROM users
     ORDER BY CASE WHEN email = $1 THEN 0 ELSE 1 END, created_at DESC`,
    [email]
  );

  console.log(
    JSON.stringify(
      {
        message: 'Root admin enforced successfully',
        rootAdmin: {
          name,
          username,
          email,
        },
        users: rows,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
