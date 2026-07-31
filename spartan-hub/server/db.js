// SQLite 连接封装（基于 Node 22+ 内置 node:sqlite）
// WAL 模式 + busy_timeout 5s，规避多读单写场景下的 BUSY。
// 详见 docs/ARCHITECTURE.md §3.3 与 docs/db-schema.md。

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

let _db = null;

function open(dbPath) {
  if (_db) return _db;
  const dir = path.dirname(dbPath);
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(dbPath);
  // WAL + 防御性 PRAGMA
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  _db = db;
  return db;
}

function close() {
  if (_db) { try { _db.close(); } catch (_) {} _db = null; }
}

function get() {
  if (!_db) throw new Error('DB not opened. Call open() first.');
  return _db;
}

// 应用 schema.sql 中的所有 DDL
function applySchema(db, schemaPath) {
  const sql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(sql);
}

// 简易事务包装：node:sqlite 没有内置 transaction helper
function withTransaction(fn) {
  const db = get();
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    throw e;
  }
}

// 工具：时间戳
const now = () => Math.floor(Date.now() / 1000);

// 写审计日志（成员、费用、公告等关键写操作调用）
function auditLog(actorId, action, target, before, after, req) {
  try {
    const ip = (req && (req.headers['x-forwarded-for'] || req.socket.remoteAddress)) || '';
    const ua = (req && req.headers['user-agent']) || '';
    const ts = now();
    get().prepare(`
      INSERT INTO audit_log (actor_id, action, target, before, after, ip, ua, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      actorId || null,
      action,
      target || null,
      before != null ? JSON.stringify(before) : null,
      after != null ? JSON.stringify(after) : null,
      ip,
      ua,
      ts
    );
  } catch (e) {
    // audit 失败不应阻塞主流程
    console.warn('[audit]', e.message);
  }
}

module.exports = { open, close, get, applySchema, withTransaction, now, auditLog };