// /api/v1/announcements —— 公共读 + 管理员 CRUD

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

function row(r) {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    priority: r.priority,
    scope: r.scope,
    pinned: !!r.pinned,
    publishAt: r.publish_at,
    expiresAt: r.expires_at,
    createdBy: r.created_by,
    time: new Date(r.publish_at * 1000).toISOString().slice(0, 10)
  };
}

// 公共列表（无需登录）；管理员额外可看定向公告
router.get('/', (req, res) => {
  const isAdmin = req.user && req.user.role === 'admin';
  const sql = isAdmin
    ? `SELECT * FROM announcements WHERE archived_at IS NULL
         AND (scope = 'public'
           OR (scope = 'member' AND (target_member_id IS NULL OR target_member_id = ?))
           OR scope = 'admin')
       ORDER BY pinned DESC, publish_at DESC LIMIT 50`
    : `SELECT * FROM announcements WHERE archived_at IS NULL AND scope = 'public'
       ORDER BY pinned DESC, publish_at DESC LIMIT 50`;
  const rows = isAdmin
    ? db.get().prepare(sql).all(req.user.id)
    : db.get().prepare(sql).all();
  res.json({ announcements: rows.map(row) });
});

router.post('/', auth.requireAdmin, (req, res) => {
  const { title, body, priority, scope, targetMemberId, pinned } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title_required' });
  if (!['high', 'mid', 'low'].includes(priority || 'mid')) return res.status(400).json({ error: 'invalid_priority' });
  if (!['public', 'member', 'admin'].includes(scope || 'public')) return res.status(400).json({ error: 'invalid_scope' });

  const now = db.now();
  const r = db.get().prepare(`
    INSERT INTO announcements (title, body, priority, scope, target_member_id, pinned, publish_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(title).trim(),
    String(body || '').trim(),
    priority || 'mid',
    scope || 'public',
    targetMemberId || null,
    pinned ? 1 : 0,
    now,
    req.user.id
  );
  const created = db.get().prepare('SELECT * FROM announcements WHERE id = ?').get(r.lastInsertRowid);
  res.status(201).json({ announcement: row(created) });
});

router.patch('/:id', auth.requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const exist = db.get().prepare('SELECT * FROM announcements WHERE id = ? AND archived_at IS NULL').get(id);
  if (!exist) return res.status(404).json({ error: 'not_found' });
  const { title, body, priority, scope, targetMemberId, pinned } = req.body || {};
  const updates = [];
  const args = [];
  if (title !== undefined) { updates.push('title = ?'); args.push(String(title).trim()); }
  if (body !== undefined) { updates.push('body = ?'); args.push(String(body).trim()); }
  if (priority !== undefined) {
    if (!['high', 'mid', 'low'].includes(priority)) return res.status(400).json({ error: 'invalid_priority' });
    updates.push('priority = ?'); args.push(priority);
  }
  if (scope !== undefined) {
    if (!['public', 'member', 'admin'].includes(scope)) return res.status(400).json({ error: 'invalid_scope' });
    updates.push('scope = ?'); args.push(scope);
  }
  if (targetMemberId !== undefined) { updates.push('target_member_id = ?'); args.push(targetMemberId || null); }
  if (pinned !== undefined) { updates.push('pinned = ?'); args.push(pinned ? 1 : 0); }
  if (updates.length === 0) return res.json({ announcement: row(exist) });
  args.push(id);
  db.get().prepare(`UPDATE announcements SET ${updates.join(', ')} WHERE id = ?`).run(...args);
  const updated = db.get().prepare('SELECT * FROM announcements WHERE id = ?').get(id);
  res.json({ announcement: row(updated) });
});

router.delete('/:id', auth.requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const exist = db.get().prepare('SELECT id FROM announcements WHERE id = ? AND archived_at IS NULL').get(id);
  if (!exist) return res.status(404).json({ error: 'not_found' });
  db.get().prepare('UPDATE announcements SET archived_at = ? WHERE id = ?').run(db.now(), id);
  res.json({ ok: true });
});

module.exports = router;