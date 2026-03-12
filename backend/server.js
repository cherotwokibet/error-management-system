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

const app    = express();
const server = http.createServer(app);

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
server.listen(PORT, () => {
  console.log(`\n🚀 Error Management API running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Frontend:    ${process.env.FRONTEND_URL || 'http://localhost:5173'}\n`);
});
