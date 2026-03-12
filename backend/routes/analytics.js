const router = require('express').Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET /api/analytics/overview
router.get('/overview', authenticate, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE resolution = 'Open')        AS open,
        COUNT(*) FILTER (WHERE resolution = 'In Progress') AS in_progress,
        COUNT(*) FILTER (WHERE resolution = 'Resolved')    AS resolved,
        COUNT(*) FILTER (WHERE resolution = 'Closed')      AS closed,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')  AS last_7_days,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS last_30_days
      FROM errors
    `);
    const mttr = await pool.query(`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600)::numeric, 1) AS avg_hours
      FROM errors WHERE resolution IN ('Resolved','Closed')
    `);
    res.json({ stats: stats.rows[0], mttr: mttr.rows[0].avg_hours });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/over-time
router.get('/over-time', authenticate, async (req, res) => {
  const { period = 'daily', days = 30, channel, category } = req.query;

  let trunc;
  if (period === 'weekly')  trunc = 'week';
  else if (period === 'monthly') trunc = 'month';
  else trunc = 'day';

  const conditions = [`created_at >= NOW() - INTERVAL '${parseInt(days)} days'`];
  const params = [];
  if (channel)  { params.push(channel);  conditions.push(`channel = $${params.length}`); }
  if (category) { params.push(category); conditions.push(`category = $${params.length}`); }

  const where = 'WHERE ' + conditions.join(' AND ');

  try {
    const { rows } = await pool.query(
      `SELECT DATE_TRUNC('${trunc}', created_at) AS period, COUNT(*) AS count
       FROM errors ${where}
       GROUP BY 1 ORDER BY 1`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/by-category
router.get('/by-category', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT category, COUNT(*) AS count,
         COUNT(*) FILTER (WHERE resolution='Open') AS open,
         COUNT(*) FILTER (WHERE resolution='In Progress') AS in_progress,
         COUNT(*) FILTER (WHERE resolution IN ('Resolved','Closed')) AS resolved
       FROM errors GROUP BY category ORDER BY count DESC`
    );
    res.json({ data: rows });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/by-channel
router.get('/by-channel', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT channel, COUNT(*) AS count,
         COUNT(*) FILTER (WHERE resolution='Open') AS open,
         COUNT(*) FILTER (WHERE resolution IN ('Resolved','Closed')) AS resolved
       FROM errors GROUP BY channel ORDER BY count DESC`
    );
    res.json({ data: rows });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/by-resolution
router.get('/by-resolution', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT resolution, COUNT(*) AS count FROM errors GROUP BY resolution ORDER BY count DESC`
    );
    res.json({ data: rows });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
