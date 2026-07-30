// /api/v1/expense-items —— 大项 + 分摊 CRUD（仅管理员）
// /api/v1/splits —— 单条分摊标记已付 / 删除

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
const splitsRouter = express.Router();

const CATEGORIES = ['交通', '住宿', '餐饮', '赛事', '装备', '其他'];
const STATUS = { 1: 'unpaid', 2: 'partial', 3: 'paid' };

function itemRow(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    amountCents: row.amount_cents,
    status: STATUS[row.status] || 'unpaid',
    paidAt: row.paid_at,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function splitRow(row) {
  return {
    id: row.id,
    itemId: row.expense_item_id,
    memberId: row.member_id,
    amountCents: row.amount_cents,
    paidStatus: row.paid_status === 1 ? 'paid' : (row.paid_status === 2 ? 'partial' : 'unpaid'),
    paidAt: row.paid_at,
    note: row.note
  };
}

// ====== 大项 ======

router.get('/', auth.requireAuth, (req, res) => {
  const items = db.get().prepare(`
    SELECT * FROM expense_items
    WHERE archived_at IS NULL
    ORDER BY id DESC
  `).all();

  // 计算每项的已分摊 / 已付 / 未分配
  const stmt = db.get().prepare(`
    SELECT
      COALESCE(SUM(amount_cents), 0) AS split_total,
      COALESCE(SUM(CASE WHEN paid_status = 1 THEN amount_cents ELSE 0 END), 0) AS paid_total,
      COUNT(*) AS member_count
    FROM expense_splits
    WHERE expense_item_id = ? AND archived_at IS NULL
  `);
  const result = items.map(it => {
    const agg = stmt.get(it.id);
    return {
      ...itemRow(it),
      splitCents: agg.split_total,
      paidCents: agg.paid_total,
      memberCount: agg.member_count,
      unassignedCents: it.amount_cents - agg.split_total
    };
  });
  res.json({ items: result });
});

router.post('/', auth.requireAdmin, (req, res) => {
  const { title, category, amountCents, status, note } = req.body || {};
  if (!title || typeof amountCents !== 'number' || amountCents < 0) {
    return res.status(400).json({ error: 'invalid_input', message: 'title 与 amountCents 必填' });
  }
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'invalid_category' });
  }
  const st = ({ unpaid: 1, partial: 2, paid: 3 })[status] || 1;
  const now = db.now();

  const r = db.get().prepare(`
    INSERT INTO expense_items (title, category, amount_cents, status, note, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, category, Math.round(amountCents), st, note || null, req.user.id, now, now);

  const created = db.get().prepare('SELECT * FROM expense_items WHERE id = ?').get(r.lastInsertRowid);
  res.status(201).json({ item: itemRow(created) });
});

router.patch('/:id', auth.requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const exist = db.get().prepare('SELECT * FROM expense_items WHERE id = ? AND archived_at IS NULL').get(id);
  if (!exist) return res.status(404).json({ error: 'not_found' });

  const { title, category, amountCents, status, note } = req.body || {};
  const updates = [];
  const args = [];
  if (title !== undefined) { updates.push('title = ?'); args.push(title); }
  if (category !== undefined) {
    if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'invalid_category' });
    updates.push('category = ?'); args.push(category);
  }
  if (amountCents !== undefined) {
    if (typeof amountCents !== 'number' || amountCents < 0) return res.status(400).json({ error: 'invalid_amount' });
    updates.push('amount_cents = ?'); args.push(Math.round(amountCents));
  }
  if (status !== undefined) {
    const st = ({ unpaid: 1, partial: 2, paid: 3 })[status];
    if (!st) return res.status(400).json({ error: 'invalid_status' });
    updates.push('status = ?'); args.push(st);
    if (st === 3) updates.push('paid_at = ?'), args.push(db.now());
  }
  if (note !== undefined) { updates.push('note = ?'); args.push(note || null); }
  if (updates.length === 0) return res.json({ item: itemRow(exist) });

  updates.push('updated_at = ?'); args.push(db.now());
  args.push(id);
  db.get().prepare(`UPDATE expense_items SET ${updates.join(', ')} WHERE id = ?`).run(...args);

  const updated = db.get().prepare('SELECT * FROM expense_items WHERE id = ?').get(id);
  res.json({ item: itemRow(updated) });
});

router.delete('/:id', auth.requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const exist = db.get().prepare('SELECT id FROM expense_items WHERE id = ? AND archived_at IS NULL').get(id);
  if (!exist) return res.status(404).json({ error: 'not_found' });

  const now = db.now();
  db.withTransaction(() => {
    db.get().prepare('UPDATE expense_items SET archived_at = ?, updated_at = ? WHERE id = ?').run(now, now, id);
    db.get().prepare('UPDATE expense_splits SET archived_at = ?, updated_at = ? WHERE expense_item_id = ?').run(now, now, id);
  });
  res.json({ ok: true });
});

// ====== 大项下的分摊 ======

router.get('/:id/splits', auth.requireAdmin, (req, res) => {
  const itemId = Number(req.params.id);
  const rows = db.get().prepare(`
    SELECT * FROM expense_splits
    WHERE expense_item_id = ? AND archived_at IS NULL
    ORDER BY member_id
  `).all(itemId);
  res.json({ splits: rows.map(splitRow) });
});

router.post('/:id/splits', auth.requireAdmin, (req, res) => {
  const itemId = Number(req.params.id);
  const item = db.get().prepare('SELECT id FROM expense_items WHERE id = ? AND archived_at IS NULL').get(itemId);
  if (!item) return res.status(404).json({ error: 'item_not_found' });

  const splits = Array.isArray(req.body && req.body.splits) ? req.body.splits : [];
  if (splits.length === 0) return res.status(400).json({ error: 'no_splits' });

  const now = db.now();
  const insertStmt = db.get().prepare(`
    INSERT OR REPLACE INTO expense_splits
      (expense_item_id, member_id, amount_cents, paid_status, note, created_by, created_at, updated_at, archived_at)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?, NULL)
  `);
  const updateStmt = db.get().prepare(`
    UPDATE expense_splits SET amount_cents = ?, updated_at = ? WHERE id = ?
  `);
  const lookupStmt = db.get().prepare(`
    SELECT id FROM expense_splits WHERE expense_item_id = ? AND member_id = ? AND archived_at IS NULL
  `);

  db.withTransaction(() => {
    for (const s of splits) {
      if (!s.memberId || typeof s.amountCents !== 'number' || s.amountCents < 0) continue;
      const cents = Math.round(s.amountCents);
      const existing = lookupStmt.get(itemId, s.memberId);
      if (existing) {
        updateStmt.run(cents, now, existing.id);
      } else {
        insertStmt.run(itemId, s.memberId, cents, s.note || null, req.user.id, now, now);
      }
    }
  });

  const rows = db.get().prepare('SELECT * FROM expense_splits WHERE expense_item_id = ? AND archived_at IS NULL').all(itemId);
  res.status(201).json({ splits: rows.map(splitRow) });
});

// ====== 单条分摊 ======

splitsRouter.delete('/:id', auth.requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const exist = db.get().prepare('SELECT id FROM expense_splits WHERE id = ? AND archived_at IS NULL').get(id);
  if (!exist) return res.status(404).json({ error: 'not_found' });
  const now = db.now();
  db.get().prepare('UPDATE expense_splits SET archived_at = ?, updated_at = ? WHERE id = ?').run(now, now, id);
  res.json({ ok: true });
});

// 标记已付：成员本人或管理员
splitsRouter.post('/:id/mark-paid', auth.requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const split = db.get().prepare('SELECT * FROM expense_splits WHERE id = ? AND archived_at IS NULL').get(id);
  if (!split) return res.status(404).json({ error: 'not_found' });

  const isOwner = req.user.id === split.member_id;
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'forbidden' });

  const now = db.now();
  db.get().prepare(`
    UPDATE expense_splits SET paid_status = 1, paid_at = ?, updated_at = ? WHERE id = ?
  `).run(now, now, id);

  const updated = db.get().prepare('SELECT * FROM expense_splits WHERE id = ?').get(id);
  res.json({ split: splitRow(updated) });
});

// 团队汇总
splitsRouter.get('/_/team-summary', auth.requireAdmin, (req, res) => {
  const itemRow = db.get().prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) AS total FROM expense_items WHERE archived_at IS NULL
  `).get();
  const splitRow = db.get().prepare(`
    SELECT
      COALESCE(SUM(amount_cents), 0) AS total,
      COALESCE(SUM(CASE WHEN paid_status = 1 THEN amount_cents ELSE 0 END), 0) AS paid
    FROM expense_splits WHERE archived_at IS NULL
  `).get();
  res.json({
    itemTotalCents: itemRow.total,
    splitTotalCents: splitRow.total,
    unassignedCents: itemRow.total - splitRow.total,
    paidCents: splitRow.paid,
    pendingCents: splitRow.total - splitRow.paid
  });
});

module.exports = { expenseItems: router, splits: splitsRouter };