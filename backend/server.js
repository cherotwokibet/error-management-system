require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const authRoutes        = require('./routes/auth');
const errorsRoutes      = require('./routes/errors');
const notifRoutes       = require('./routes/notifications');
const analyticsRoutes   = require('./routes/analytics');
const exportRoutes      = require('./routes/export');
const jwt               = require('jsonwebtoken');
const { runMigrationsOnStart } = require('./db/migrate-on-start');
const { enforceRootAdminOnStart } = require('./db/enforce-root-admin');

const app    = express();
const server = http.createServer(app);

const trustProxySetting = (() => {
  if (process.env.TRUST_PROXY !== undefined) {
    const value = String(process.env.TRUST_PROXY).trim().toLowerCase();
    if (value === 'true') return 1;
    if (value === 'false') return false;
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber)) return asNumber;
  }
  return process.env.NODE_ENV === 'production' ? 1 : false;
})();

app.set('trust proxy', trustProxySetting);

const normalizeOrigin = (value) => (value || '').trim().replace(/\/+$/, '');
const allowedOrigins = [
  normalizeOrigin(process.env.FRONTEND_URL || 'http://localhost:5173'),
  ...String(process.env.FRONTEND_URLS || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean),
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  return allowedOrigins.includes(normalizeOrigin(origin));
};

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication error'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  socket.join(`user_${socket.userId}`);
  socket.on('disconnect', () => {});
});

app.set('io', io);

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ─── Static files for uploads ─────────────────────────────────────────────────
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || './uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/errors',        errorsRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/analytics',     analyticsRoutes);
app.use('/api/export',        exportRoutes);

// ─── Root info ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name: 'Error Management API',
    status: 'running',
    health: '/api/health',
  });
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large (max 10MB)' });
  }
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function start() {
  await runMigrationsOnStart();
  await enforceRootAdminOnStart();
  server.listen(PORT, () => {
    console.log(`\n🚀 Error Management API running on port ${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Frontend:    ${process.env.FRONTEND_URL || 'http://localhost:5173'}\n`);
    console.log(`   Trust proxy: ${String(trustProxySetting)}`);
  });
}

start().catch((err) => {
  console.error('❌ Server startup failed:', err);
  process.exit(1);
});
