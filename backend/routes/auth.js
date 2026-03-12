const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
const ROOT_ADMIN_EMAIL = process.env.ROOT_ADMIN_EMAIL || 'bcherotwo@stima-sacco.com';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

// POST /api/auth/login
router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    try {
      const { rows } = await pool.query(
        'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
        [email]
      );
      if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

      const user = rows[0];
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      });

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /api/auth/register  (admin only after first user)
router.post(
  '/register',
  authenticate,
  authorize('admin'),
  [
    body('username').trim().isLength({ min: 3, max: 50 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).matches(PASSWORD_RULE),
    body('role').isIn(['admin', 'editor', 'viewer']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, email, password, role } = req.body;
    try {
      const hash = await bcrypt.hash(password, 12);
      const { rows } = await pool.query(
        `INSERT INTO users (username, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, email, role, created_at`,
        [username, email, hash, role]
      );
      res.status(201).json({ user: rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Username or email already exists' });
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/auth/users  (admin)
router.get('/users', authenticate, authorize('admin'), async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, username, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
  );
  res.json({ users: rows });
});

// PUT /api/auth/users/:id  (admin)
router.put(
  '/users/:id',
  authenticate,
  authorize('admin'),
  [
    body('username').optional().trim().isLength({ min: 3, max: 50 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('role').optional().isIn(['admin', 'editor', 'viewer']),
    body('is_active').optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, email, role, is_active } = req.body;
    const hasAnyUpdate = [username, email, role, is_active].some(v => v !== undefined);
    if (!hasAnyUpdate) return res.status(400).json({ error: 'No fields to update' });

    try {
      const { rows } = await pool.query(
        `UPDATE users
         SET username = COALESCE($1, username),
             email = COALESCE($2, email),
             role = COALESCE($3, role),
             is_active = COALESCE($4, is_active)
         WHERE id = $5
         RETURNING id, username, email, role, is_active, created_at`,
        [username, email, role, is_active, req.params.id]
      );

      if (!rows.length) return res.status(404).json({ error: 'User not found' });
      res.json({ user: rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Username or email already exists' });
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /api/auth/users/:id/password-reset  (admin)
router.put(
  '/users/:id/password-reset',
  authenticate,
  authorize('admin'),
  [body('newPassword').isLength({ min: 8 }).matches(PASSWORD_RULE)],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { newPassword } = req.body;

    try {
      const hash = await bcrypt.hash(newPassword, 12);
      const { rows } = await pool.query(
        `UPDATE users
         SET password_hash = $1
         WHERE id = $2
         RETURNING id, username, email, role, is_active`,
        [hash, req.params.id]
      );

      if (!rows.length) return res.status(404).json({ error: 'User not found' });
      res.json({ message: 'Password reset successfully', user: rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /api/auth/users/:id  (root admin only)
router.delete('/users/:id', authenticate, authorize('admin'), async (req, res) => {
  if (req.user.email !== ROOT_ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Only root admin can delete users' });
  }

  if (req.user.id === req.params.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  try {
    const target = await pool.query('SELECT id, email FROM users WHERE id = $1', [req.params.id]);
    if (!target.rows.length) return res.status(404).json({ error: 'User not found' });

    if (target.rows[0].email === ROOT_ADMIN_EMAIL) {
      return res.status(400).json({ error: 'Root admin account cannot be deleted' });
    }

    const { rows } = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, username, email, role, is_active',
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted successfully', user: rows[0] });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({
        error: 'Cannot delete this user because they are linked to existing records',
      });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/auth/me/password
router.put(
  '/me/password',
  authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }).matches(PASSWORD_RULE),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { currentPassword, newPassword } = req.body;
    try {
      const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
      const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
      if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

      const hash = await bcrypt.hash(newPassword, 12);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
      res.json({ message: 'Password updated successfully' });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;
