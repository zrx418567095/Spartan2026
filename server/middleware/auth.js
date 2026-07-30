// JWT 鉴权中间件
// - token 存放：HttpOnly Cookie `sp_token`
// - 撤销机制：jti 写入 sessions 表，登出时 revoked_at 设当前时间
// - 签名算法：HS256

const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const db = require('../db');

const COOKIE_NAME = 'sp_token';

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET 未设置或太短（>=32 字节）。请在 .env 中设置。');
  }
  return s;
}

function ttl() {
  return Number(process.env.TOKEN_TTL_SECONDS) || 28800; // 8h
}

// 颁发 token，写入 sessions
function issueToken({ memberId, role, ip, ua }) {
  const jti = crypto.randomUUID();
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + ttl();

  const token = jwt.sign(
    { sub: memberId, role, jti, iat: issuedAt, exp: expiresAt },
    secret(),
    { algorithm: 'HS256' }
  );

  db.get().prepare(`
    INSERT INTO sessions (jti, member_id, issued_at, expires_at, ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(jti, memberId, issuedAt, expiresAt, ip || null, ua || null);

  return { token, jti, expiresAt };
}

// 撤销（jti 写 revoked_at）
function revokeJti(jti) {
  const now = Math.floor(Date.now() / 1000);
  db.get().prepare('UPDATE sessions SET revoked_at = ? WHERE jti = ?').run(now, jti);
}

// 解析请求中的 token
function extractToken(req) {
  // 优先 Cookie
  const cookieToken = req.cookies && req.cookies[COOKIE_NAME];
  if (cookieToken) return cookieToken;
  // 兼容 Authorization: Bearer
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

// 校验 jti 是否被吊销/过期
function jtiValid(jti) {
  const row = db.get().prepare(`
    SELECT revoked_at, expires_at FROM sessions WHERE jti = ?
  `).get(jti);
  if (!row) return false;
  if (row.revoked_at) return false;
  if (row.expires_at < Math.floor(Date.now() / 1000)) return false;
  return true;
}

// 载入当前登录用户（挂到 req.user）
function loadUser(req, _res, next) {
  req.user = null;
  const token = extractToken(req);
  if (!token) return next();

  try {
    const payload = jwt.verify(token, secret(), { algorithms: ['HS256'] });
    if (!jtiValid(payload.jti)) return next();

    const member = db.get().prepare(`
      SELECT id, username, display, group_name, role
      FROM members WHERE id = ? AND archived_at IS NULL
    `).get(payload.sub);
    if (!member) return next();

    req.user = {
      id: member.id,
      username: member.username,
      display: member.display,
      group: member.group_name,
      role: member.role,
      jti: payload.jti
    };
  } catch (_e) {
    // 静默失败：当未登录处理
  }
  next();
}

// 要求登录
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  next();
}

// 要求管理员
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  next();
}

// 设置 cookie
function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ttl() * 1000,
    path: '/'
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

module.exports = {
  COOKIE_NAME,
  issueToken,
  revokeJti,
  loadUser,
  requireAuth,
  requireAdmin,
  setAuthCookie,
  clearAuthCookie
};