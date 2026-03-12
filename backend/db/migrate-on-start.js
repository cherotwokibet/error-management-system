const { migrateDatabase } = require('./migrate');

const asBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

async function runMigrationsOnStart() {
  const enabled = asBool(process.env.RUN_MIGRATIONS_ON_START, false);
  if (!enabled) return;

  console.log('⏳ Running startup DB migrations...');
  try {
    await migrateDatabase();
    console.log('✅ Startup DB migrations complete');
  } catch (err) {
    console.error('❌ Startup DB migrations failed:', err);
    const failHard = asBool(process.env.MIGRATIONS_FAIL_HARD, true);
    if (failHard) throw err;
  }
}

module.exports = { runMigrationsOnStart };
