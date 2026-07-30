// /api/v1/members/* —— 成员列表 + 个人分摊汇总
// 列表只对登录用户可见，返回 id/display/group/role 公开字段

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth.requireAuth, (req, res) => {
  const rows = db.get().prepare(`
    SELECT id, display, group_name AS "group", role
    FROM members
    WHERE archived_at IS NULL AND id != 'a1'
    ORDER BY id
  `).all();
  res.json({ members: rows });
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

module.exports = router;