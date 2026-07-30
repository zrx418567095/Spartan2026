// /api/v1/members/* —— 成员列表 + 个人分摊汇总 + 管理员 CRUD
// 列表只对登录用户可见，返回 id/display/group/role 公开字段

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

function row(r) {
  return {
    id: r.id,
    username: r.username,
    display: r.display,
    group: r.group_name,
    role: r.role,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

router.get('/', auth.requireAuth, (req, res) => {
  const rows = db.get().prepare(`
    SELECT id, username, display, group_name, role, created_at, updated_at
    FROM members
    WHERE archived_at IS NULL
    ORDER BY id
  `).all();
  res.json({ members: rows.map(row) });
});

// 成员汇总（含个人分摊 + 总额/已付/待付）
router.get('/:id/summary', auth.requireAuth, (req, res) => {
  const memberId = req.params.id;
  if (req.user.role !== 'admin' && req.user.id !== memberId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const splits = db.get().prepare(`
    SELECT id, expense_item_id AS itemId, amount_cents AS amountCents, paid_status AS paidStatus, paid_at AS paidAt
    FROM expense_splits
    WHERE member_id = ? AND archived_at IS NULL
    ORDER BY id
  `).all(memberId);

  const items = db.get().prepare(`
    SELECT id, title, category FROM expense_items
    WHERE archived_at IS NULL ORDER BY id
  `).all();
  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));

  let totalCents = 0, paidCents = 0;
  const detailed = splits.map(s => {
    totalCents += s.amountCents;
    if (s.paidStatus === 1) paidCents += s.amountCents;
    const it = itemMap[s.itemId] || {};
    return {
      ...s,
      title: it.title || '',
      category: it.category || ''
    };
  });

  res.json({
    memberId,
    summary: {
      totalCents,
      paidCents,
      pendingCents: totalCents - paidCents,
      items: splits.length
    },
    splits: detailed
  });
});

// ====== 管理员 CRUD（增删改） ======

router.post('/', auth.requireAdmin, (req, res) => {
  const { id, username, display, group, role } = req.body || {};
  if (!id || !username || !display) {
    return res.status(400).json({ error: 'missing_fields', message: 'id / username / display 必填' });
  }
  if (!['member', 'admin'].includes(role || 'member')) {
    return res.status(400).json({ error: 'invalid_role' });
  }
  const existing = db.get().prepare('SELECT id FROM members WHERE id = ? OR username = ?').get(id, String(username).toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'conflict', message: 'ID 或登录名已存在' });
  }
  const now = db.now();
  db.get().prepare(`
    INSERT INTO members (id, username, display, group_name, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, String(username).toLowerCase(), String(display).trim(), group || '未分组', role || 'member', now, now);
  const created = db.get().prepare('SELECT * FROM members WHERE id = ?').get(id);
  res.status(201).json({ member: row(created) });
});

router.patch('/:id', auth.requireAdmin, (req, res) => {
  const id = String(req.params.id);
  const exist = db.get().prepare('SELECT * FROM members WHERE id = ? AND archived_at IS NULL').get(id);
  if (!exist) return res.status(404).json({ error: 'not_found' });
  const { username, display, group, role } = req.body || {};
  const updates = [];
  const args = [];
  if (username !== undefined) {
    const dup = db.get().prepare('SELECT id FROM members WHERE username = ? AND id != ?').get(String(username).toLowerCase(), id);
    if (dup) return res.status(409).json({ error: 'username_conflict' });
    updates.push('username = ?'); args.push(String(username).toLowerCase());
  }
  if (display !== undefined) { updates.push('display = ?'); args.push(String(display).trim()); }
  if (group !== undefined)   { updates.push('group_name = ?'); args.push(group || '未分组'); }
  if (role !== undefined) {
    if (!['member', 'admin'].includes(role)) return res.status(400).json({ error: 'invalid_role' });
    updates.push('role = ?'); args.push(role);
  }
  if (updates.length === 0) return res.json({ member: row(exist) });
  updates.push('updated_at = ?'); args.push(db.now());
  args.push(id);
  db.get().prepare(`UPDATE members SET ${updates.join(', ')} WHERE id = ?`).run(...args);
  const updated = db.get().prepare('SELECT * FROM members WHERE id = ?').get(id);
  res.json({ member: row(updated) });
});

router.delete('/:id', auth.requireAdmin, (req, res) => {
  const id = String(req.params.id);
  if (id === 'a1') return res.status(400).json({ error: 'cannot_delete_admin' });
  const exist = db.get().prepare('SELECT id FROM members WHERE id = ? AND archived_at IS NULL').get(id);
  if (!exist) return res.status(404).json({ error: 'not_found' });
  // 软删除：保留 expense_splits 历史，置 archived_at
  db.get().prepare('UPDATE members SET archived_at = ?, updated_at = ? WHERE id = ?').run(db.now(), db.now(), id);
  res.json({ ok: true });
});

module.exports = router;