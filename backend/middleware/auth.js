const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, username, email, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );
    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

const auditLog = (action, entityType) => async (req, res, next) => {
  res.on('finish', async () => {
    if (res.statusCode < 400) {
      try {
        await pool.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            req.user?.id || null,
            action,
            entityType,
            req.params.id || null,
            req.ip,
          ]
        );
      } catch (_) {}
    }
  });
  next();
};

module.exports = { authenticate, authorize, auditLog };
