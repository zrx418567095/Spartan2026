// SpartanUltra 后端入口
// - Express + node:sqlite
// - 路由全部以 /api/v1 前缀挂载
// - 默认监听 127.0.0.1:3000（前置 Nginx 反代到 443）

require('dotenv').config();

const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');

const db = require('./db');
const authMw = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const memberRoutes = require('./routes/members');
const gearRoutes = require('./routes/gear');
const taskRoutes = require('./routes/tasks');
const announcementRoutes = require('./routes/announcements');
const weatherRoutes = require('./routes/weather');
const { expenseItems, splits } = require('./routes/expense-items');
const { memberTasks, taskOps } = require('./routes/tasks');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, 'data', 'spartan.db');

// ====== DB 启动 ======
console.log(`[boot] open db: ${SQLITE_PATH}`);
db.open(SQLITE_PATH);
// schema 已经由 npm run db:init 应用；这里跳过重复以免 race

// ====== 应用 ======
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUSTED_PROXY === 'true');

app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(authMw.loadUser);

// 简易 access log
app.use((req, _res, next) => {
  if (!req.url.startsWith('/api/v1')) return next();
  console.log(`[api] ${req.method} ${req.url} user=${req.user ? req.user.username : '-'}`);
  next();
});

// ====== 路由 ======
app.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/members', memberRoutes);
app.use('/api/v1/members/:memberId/tasks', memberTasks);
app.use('/api/v1/members/:memberId/gear', gearRoutes);
app.use('/api/v1/tasks', taskOps);
app.use('/api/v1/announcements', announcementRoutes);
app.use('/api/v1/weather', weatherRoutes);
app.use('/api/v1/expense-items', expenseItems);
app.use('/api/v1/splits', splits);

// 静态文件服务
const STATIC_DIR = path.join(__dirname, '..');
app.use(express.static(STATIC_DIR));

// SPA fallback - 所有未匹配路由返回 index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

// 404
app.use('/api/v1', (_req, res) => res.status(404).json({ error: 'not_found' }));

// 错误处理
app.use((err, _req, res, _next) => {
  console.error('[err]', err);
  res.status(500).json({ error: 'server_error', message: err.message });
});

// ====== 启动 ======
const server = app.listen(PORT, HOST, () => {
  console.log(`[boot] listening on http://${HOST}:${PORT}`);
});

function shutdown(sig) {
  console.log(`[boot] ${sig} received, shutting down ...`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));