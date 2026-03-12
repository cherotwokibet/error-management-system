const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function migrateDatabase() {
  const sqlPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
}

async function migrateAndClose() {
  try {
    await migrateDatabase();
    console.log('✅ Database migration completed');
  } catch (err) {
    console.error('❌ Database migration failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrateAndClose();
}

module.exports = { migrateDatabase };
