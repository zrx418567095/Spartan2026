// /api/v1/members/:memberId/gear —— 个人装备状态（成员本人或管理员）
// 公共装备清单（与前端原型 publicGear 对齐）由 public.js 暴露为 /api/v1/public/gear

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.get('/', auth.requireAuth, (req, res) => {
  const memberId = req.params.memberId;
  if (req.user.role !== 'admin' && req.user.id !== memberId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const rows = db.get().prepare(`
    SELECT item_name AS itemName, level, status, note, updated_at AS updatedAt
    FROM gear_status WHERE member_id = ?
  `).all(memberId);
  res.json({ items: rows });
});

// 整表覆盖式 PUT
router.put('/', auth.requireAuth, (req, res) => {
  const memberId = req.params.memberId;
  if (req.user.role !== 'admin' && req.user.id !== memberId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const items = Array.isArray(req.body && req.body.items) ? req.body.items : [];
  const now = db.now();

  const stmt = db.get().prepare(`
    INSERT INTO gear_status (member_id, item_name, level, status, note, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(member_id, item_name) DO UPDATE SET
      level = excluded.level,
      status = excluded.status,
      note = excluded.note,
      updated_at = excluded.updated_at
  `);
  db.withTransaction(() => {
    for (const it of items) {
      if (!it.itemName || !['mandatory', 'recommended', 'optional'].includes(it.level)) continue;
      const status = Number(it.status) || 0;
      stmt.run(memberId, it.itemName, it.level, status, it.note || null, now);
    }
  });

  const rows = db.get().prepare(`
    SELECT item_name AS itemName, level, status, note, updated_at AS updatedAt
    FROM gear_status WHERE member_id = ?
  `).all(memberId);
  res.json({ items: rows });
});

module.exports = router;