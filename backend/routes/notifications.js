const router = require('express').Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET /api/notifications
router.get('/', authenticate, async (req, res) => {
  const { limit = 20, unreadOnly } = req.query;
  const conditions = ['user_id = $1'];
  const params = [req.user.id];
  if (unreadOnly === 'true') conditions.push('read_at IS NULL');

  const { rows } = await pool.query(
    `SELECT * FROM notifications WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC LIMIT $${params.length + 1}`,
    [...params, parseInt(limit)]
  );

  const unread = await pool.query(
    'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL',
    [req.user.id]
  );

  res.json({ notifications: rows, unreadCount: parseInt(unread.rows[0].count) });
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, async (req, res) => {
  await pool.query(
    'UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  res.json({ message: 'Marked as read' });
});

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, async (req, res) => {
  await pool.query(
    'UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL',
    [req.user.id]
  );
  res.json({ message: 'All marked as read' });
});

module.exports = router;
