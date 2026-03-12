const router = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const { upload, generateThumbnail } = require('../middleware/upload');

const RESOLUTIONS = ['Open', 'In Progress', 'Resolved', 'Closed'];

const DEFAULT_CHANNELS = ['Web', 'Mobile', 'API', 'Backend', 'Email', 'Other'];
const DEFAULT_CATEGORIES = ['UI Bug', 'Server Error', 'Database', 'Performance', 'Security', 'Logic', 'Other'];

const getChannelNames = async () => {
  const { rows } = await pool.query('SELECT name FROM channels ORDER BY name ASC');
  return rows.map(r => r.name);
};

const getCategoryNames = async () => {
  const { rows } = await pool.query('SELECT name FROM categories ORDER BY name ASC');
  return rows.map(r => r.name);
};

const isActiveUser = async (userId) => {
  const { rows } = await pool.query(
    'SELECT id FROM users WHERE id = $1 AND is_active = TRUE',
    [userId]
  );
  return rows.length > 0;
};

// ─── Helper: emit socket notification ─────────────────────────────────────────
const notifyUser = async (io, pool, userId, type, refId, message) => {
  if (!userId) return;
  try {
    const { rows } = await pool.query(
      `INSERT INTO notifications (user_id, type, reference_id, message)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, type, refId, message]
    );
    if (io) io.to(`user_${userId}`).emit('notification', rows[0]);
  } catch (_) {}
};

// ─── GET /api/errors ──────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  const {
    page = 1, limit = 20, search = '',
    channel, category, resolution,
    sortBy = 'created_at', sortDir = 'DESC',
    dateFrom, dateTo, assignedTo,
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const conditions = [];
  const params = [];

  if (search) {
    params.push(search);
    conditions.push(`e.search_vector @@ plainto_tsquery('english', $${params.length})`);
  }
  if (channel)    { params.push(channel);    conditions.push(`e.channel = $${params.length}`); }
  if (category)   { params.push(category);   conditions.push(`e.category = $${params.length}`); }
  if (resolution) { params.push(resolution); conditions.push(`e.resolution = $${params.length}`); }
  if (assignedTo) { params.push(assignedTo); conditions.push(`e.assigned_to = $${params.length}`); }
  if (dateFrom)   { params.push(dateFrom);   conditions.push(`e.created_at >= $${params.length}`); }
  if (dateTo)     { params.push(dateTo);     conditions.push(`e.created_at <= $${params.length}`); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const validSorts = ['created_at', 'updated_at', 'channel', 'category', 'resolution'];
  const safeSort = validSorts.includes(sortBy) ? sortBy : 'created_at';
  const safeDir  = sortDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  try {
    const countRes = await pool.query(`SELECT COUNT(*) FROM errors e ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(parseInt(limit), offset);
    const dataRes = await pool.query(
      `SELECT
         e.*,
         u.username AS created_by_name,
         a.username AS assigned_to_name,
         (SELECT COUNT(*) FROM comments c WHERE c.error_id = e.id) AS comment_count,
         (SELECT json_agg(json_build_object('id', s.id, 'file_name', s.file_name, 'thumb_path', s.thumb_path, 'file_path', s.file_path))
          FROM screenshots s WHERE s.error_id = e.id) AS screenshots
       FROM errors e
       LEFT JOIN users u ON u.id = e.created_by
       LEFT JOIN users a ON a.id = e.assigned_to
       ${where}
       ORDER BY e.${safeSort} ${safeDir}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      errors: dataRes.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/errors/search-suggestions ───────────────────────────────────────
router.get('/search-suggestions', authenticate, async (req, res) => {
  const { q = '' } = req.query;
  if (q.length < 2) return res.json({ suggestions: [] });
  try {
    const { rows } = await pool.query(
      `SELECT id, left(error_details, 100) AS suggestion, resolution
       FROM errors
       WHERE error_details ILIKE $1
       LIMIT 8`,
      [`%${q}%`]
    );
    res.json({ suggestions: rows });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/errors/meta ──────────────────────────────────────────────────────
router.get('/meta', authenticate, async (req, res) => {
  try {
    let channels = await getChannelNames();
    let categories = await getCategoryNames();
    if (!channels.length) {
      await Promise.all(
        DEFAULT_CHANNELS.map((name) =>
          pool.query('INSERT INTO channels (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name])
        )
      );
      channels = await getChannelNames();
    }

    if (!categories.length) {
      await Promise.all(
        DEFAULT_CATEGORIES.map((name) =>
          pool.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name])
        )
      );
      categories = await getCategoryNames();
    }

    res.json({ channels, categories, resolutions: RESOLUTIONS });
  } catch {
    res.json({ channels: DEFAULT_CHANNELS, categories: DEFAULT_CATEGORIES, resolutions: RESOLUTIONS });
  }
});

// ─── GET /api/errors/channels ───────────────────────────────────────────────
router.get('/channels', authenticate, authorize('admin'), async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name FROM channels ORDER BY name ASC');
    res.json({ channels: rows });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/errors/channels ──────────────────────────────────────────────
router.post(
  '/channels',
  authenticate,
  authorize('admin'),
  [body('name').trim().isLength({ min: 2, max: 50 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { rows } = await pool.query(
        'INSERT INTO channels (name) VALUES ($1) RETURNING id, name',
        [req.body.name.trim()]
      );
      res.status(201).json({ channel: rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Channel already exists' });
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ─── DELETE /api/errors/channels/:channelId ────────────────────────────────
router.delete('/channels/:channelId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const channelRes = await pool.query('SELECT id, name FROM channels WHERE id = $1', [req.params.channelId]);
    if (!channelRes.rows.length) return res.status(404).json({ error: 'Channel not found' });

    const name = channelRes.rows[0].name;
    const inUseRes = await pool.query('SELECT COUNT(*) FROM errors WHERE channel = $1', [name]);
    if (parseInt(inUseRes.rows[0].count, 10) > 0) {
      return res.status(409).json({ error: 'Cannot delete a channel that is already used by errors' });
    }

    const totalRes = await pool.query('SELECT COUNT(*) FROM channels');
    if (parseInt(totalRes.rows[0].count, 10) <= 1) {
      return res.status(400).json({ error: 'At least one channel must remain' });
    }

    await pool.query('DELETE FROM channels WHERE id = $1', [req.params.channelId]);
    res.json({ message: 'Channel deleted successfully' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/errors/categories ─────────────────────────────────────────────
router.get('/categories', authenticate, authorize('admin', 'editor'), async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name FROM categories ORDER BY name ASC');
    res.json({ categories: rows });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/errors/categories ────────────────────────────────────────────
router.post(
  '/categories',
  authenticate,
  authorize('admin', 'editor'),
  [body('name').trim().isLength({ min: 2, max: 50 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { rows } = await pool.query(
        'INSERT INTO categories (name) VALUES ($1) RETURNING id, name',
        [req.body.name.trim()]
      );
      res.status(201).json({ category: rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Category already exists' });
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ─── DELETE /api/errors/categories/:categoryId ─────────────────────────────
router.delete('/categories/:categoryId', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const catRes = await pool.query('SELECT id, name FROM categories WHERE id = $1', [req.params.categoryId]);
    if (!catRes.rows.length) return res.status(404).json({ error: 'Category not found' });

    const name = catRes.rows[0].name;
    const inUseRes = await pool.query('SELECT COUNT(*) FROM errors WHERE category = $1', [name]);
    if (parseInt(inUseRes.rows[0].count, 10) > 0) {
      return res.status(409).json({ error: 'Cannot delete a category that is already used by errors' });
    }

    const totalRes = await pool.query('SELECT COUNT(*) FROM categories');
    if (parseInt(totalRes.rows[0].count, 10) <= 1) {
      return res.status(400).json({ error: 'At least one category must remain' });
    }

    await pool.query('DELETE FROM categories WHERE id = $1', [req.params.categoryId]);
    res.json({ message: 'Category deleted successfully' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/errors/:id ──────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*,
         u.username AS created_by_name, u.email AS created_by_email,
         a.username AS assigned_to_name,
         (SELECT json_agg(
           json_build_object('id', s.id, 'file_name', s.file_name,
             'file_path', s.file_path, 'thumb_path', s.thumb_path,
             'mime_type', s.mime_type, 'uploaded_at', s.uploaded_at)
           ORDER BY s.uploaded_at
         ) FROM screenshots s WHERE s.error_id = e.id) AS screenshots,
         (SELECT json_agg(
           json_build_object('id', c.id, 'comment', c.comment,
             'user_id', c.user_id, 'username', cu.username, 'created_at', c.created_at)
           ORDER BY c.created_at
         ) FROM comments c JOIN users cu ON cu.id = c.user_id WHERE c.error_id = e.id) AS comments
       FROM errors e
       LEFT JOIN users u ON u.id = e.created_by
       LEFT JOIN users a ON a.id = e.assigned_to
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Error not found' });
    res.json({ error: rows[0] });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/errors ─────────────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  authorize('admin', 'editor'),
  auditLog('create_error', 'error'),
  [
    body('title').trim().notEmpty().isLength({ max: 255 }),
    body('error_details').trim().notEmpty().isLength({ max: 10000 }),
    body('channel').trim().notEmpty().isLength({ max: 50 }),
    body('category').trim().notEmpty().isLength({ max: 50 }),
    body('assigned_to').notEmpty().isUUID(),
    body('resolution').optional().isIn(RESOLUTIONS),
    body('ticket').optional().trim().isLength({ max: 255 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, error_details, channel, category, resolution = 'Open', ticket, assigned_to, comments: initialComment } = req.body;
    const io = req.app.get('io');

    try {
      const channels = await getChannelNames();
      if (!channels.includes(channel)) {
        return res.status(400).json({ error: 'Invalid channel' });
      }

      const categories = await getCategoryNames();
      if (!categories.includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
      }

      if (!(await isActiveUser(assigned_to))) {
        return res.status(400).json({ error: 'Assigned user is invalid or inactive' });
      }

      if (req.user.role === 'editor' && assigned_to && assigned_to !== req.user.id) {
        return res.status(403).json({ error: 'Editors can only assign errors to themselves' });
      }

      const { rows } = await pool.query(
        `INSERT INTO errors (title, error_details, channel, category, resolution, ticket, created_by, assigned_to)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [title, error_details, channel, category, resolution, ticket || null, req.user.id, assigned_to || null]
      );
      const newError = rows[0];

      if (initialComment) {
        await pool.query(
          'INSERT INTO comments (error_id, user_id, comment) VALUES ($1, $2, $3)',
          [newError.id, req.user.id, initialComment]
        );
      }

      if (assigned_to && assigned_to !== req.user.id) {
        await notifyUser(io, pool, assigned_to, 'assignment', newError.id,
          `You were assigned error: "${error_details.substring(0, 60)}..."`);
      }

      res.status(201).json({ error: newError });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ─── PUT /api/errors/:id ──────────────────────────────────────────────────────
router.put(
  '/:id',
  authenticate,
  authorize('admin', 'editor'),
  auditLog('update_error', 'error'),
  async (req, res) => {
    const { title, error_details, channel, category, resolution, ticket, assigned_to } = req.body;
    const io = req.app.get('io');

    try {
      if (channel) {
        const channels = await getChannelNames();
        if (!channels.includes(channel)) {
          return res.status(400).json({ error: 'Invalid channel' });
        }
      }

      if (category) {
        const categories = await getCategoryNames();
        if (!categories.includes(category)) {
          return res.status(400).json({ error: 'Invalid category' });
        }
      }

      if (assigned_to !== undefined) {
        if (!assigned_to) {
          return res.status(400).json({ error: 'Assigned user is required' });
        }
        if (!(await isActiveUser(assigned_to))) {
          return res.status(400).json({ error: 'Assigned user is invalid or inactive' });
        }
      }

      const prev = await pool.query('SELECT * FROM errors WHERE id = $1', [req.params.id]);
      if (!prev.rows.length) return res.status(404).json({ error: 'Error not found' });
      const old = prev.rows[0];

      const nextAssignedTo = assigned_to === undefined ? old.assigned_to : assigned_to;
      if (!nextAssignedTo) {
        return res.status(400).json({ error: 'Assigned user is required' });
      }
      if (
        req.user.role === 'editor' &&
        nextAssignedTo &&
        nextAssignedTo !== req.user.id &&
        nextAssignedTo !== old.assigned_to
      ) {
        return res.status(403).json({ error: 'Editors can only assign errors to themselves' });
      }

      const { rows } = await pool.query(
        `UPDATE errors SET
           title         = COALESCE($1, title),
           error_details = COALESCE($2, error_details),
           channel       = COALESCE($3, channel),
           category      = COALESCE($4, category),
           resolution    = COALESCE($5, resolution),
           ticket        = COALESCE($6, ticket),
           assigned_to   = $7
         WHERE id = $8 RETURNING *`,
        [title, error_details, channel, category, resolution, ticket, assigned_to ?? old.assigned_to, req.params.id]
      );

      const updated = rows[0];

      // Notify on resolution change
      if (resolution && resolution !== old.resolution && old.created_by !== req.user.id) {
        await notifyUser(io, pool, old.created_by, 'resolution_change', updated.id,
          `Error status changed to "${resolution}"`);
      }

      // Notify on new assignment
      if (assigned_to && assigned_to !== old.assigned_to && assigned_to !== req.user.id) {
        await notifyUser(io, pool, assigned_to, 'assignment', updated.id,
          `You were assigned error: "${updated.error_details.substring(0, 60)}"`);
      }

      res.json({ error: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ─── DELETE /api/errors/:id ───────────────────────────────────────────────────
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  auditLog('delete_error', 'error'),
  async (req, res) => {
    try {
      // Delete associated screenshot files
      const shots = await pool.query('SELECT file_path, thumb_path FROM screenshots WHERE error_id = $1', [req.params.id]);
      shots.rows.forEach(s => {
        [s.file_path, s.thumb_path].forEach(p => {
          if (p && fs.existsSync(p)) fs.unlinkSync(p);
        });
      });

      const { rowCount } = await pool.query('DELETE FROM errors WHERE id = $1', [req.params.id]);
      if (!rowCount) return res.status(404).json({ error: 'Error not found' });
      res.json({ message: 'Error deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ─── POST /api/errors/:id/screenshots ─────────────────────────────────────────
router.post(
  '/:id/screenshots',
  authenticate,
  authorize('admin', 'editor'),
  upload.array('screenshots', 10),
  async (req, res) => {
    if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });

    try {
      const errorCheck = await pool.query('SELECT id FROM errors WHERE id = $1', [req.params.id]);
      if (!errorCheck.rows.length) return res.status(404).json({ error: 'Error not found' });

      const inserted = [];
      for (const file of req.files) {
        const thumbPath = await generateThumbnail(file.path, file.filename);
        const { rows } = await pool.query(
          `INSERT INTO screenshots (error_id, file_name, file_path, thumb_path, mime_type, file_size, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [req.params.id, file.originalname, file.path, thumbPath, file.mimetype, file.size, req.user.id]
        );
        inserted.push(rows[0]);
      }
      res.status(201).json({ screenshots: inserted });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ─── DELETE /api/errors/:id/screenshots/:sid ──────────────────────────────────
router.delete('/:id/screenshots/:sid', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM screenshots WHERE id = $1 AND error_id = $2',
      [req.params.sid, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Screenshot not found' });

    [rows[0].file_path, rows[0].thumb_path].forEach(p => {
      if (p && fs.existsSync(p)) fs.unlinkSync(p);
    });

    await pool.query('DELETE FROM screenshots WHERE id = $1', [req.params.sid]);
    res.json({ message: 'Screenshot deleted' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/errors/:id/comments ────────────────────────────────────────────
router.post('/:id/comments', authenticate, authorize('admin', 'editor'), async (req, res) => {
  const { comment } = req.body;
  if (!comment?.trim()) return res.status(400).json({ error: 'Comment is required' });
  const io = req.app.get('io');

  try {
    const error = await pool.query('SELECT * FROM errors WHERE id = $1', [req.params.id]);
    if (!error.rows.length) return res.status(404).json({ error: 'Error not found' });

    const { rows } = await pool.query(
      `INSERT INTO comments (error_id, user_id, comment) VALUES ($1, $2, $3)
       RETURNING *, (SELECT username FROM users WHERE id = $2) AS username`,
      [req.params.id, req.user.id, comment.trim()]
    );

    const errRow = error.rows[0];
    if (errRow.created_by !== req.user.id) {
      await notifyUser(io, pool, errRow.created_by, 'comment', req.params.id,
        `${req.user.username} commented on your error`);
    }
    if (errRow.assigned_to && errRow.assigned_to !== req.user.id && errRow.assigned_to !== errRow.created_by) {
      await notifyUser(io, pool, errRow.assigned_to, 'comment', req.params.id,
        `${req.user.username} commented on an error you're assigned to`);
    }

    res.status(201).json({ comment: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── DELETE /api/errors/:id/comments/:cid ─────────────────────────────────────
router.delete('/:id/comments/:cid', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM comments WHERE id = $1', [req.params.cid]);
    if (!rows.length) return res.status(404).json({ error: 'Comment not found' });
    if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Cannot delete another user\'s comment' });
    }
    await pool.query('DELETE FROM comments WHERE id = $1', [req.params.cid]);
    res.json({ message: 'Comment deleted' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
