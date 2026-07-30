// /api/v1/members/:memberId/tasks —— 个人任务 CRUD
// 成员本人可读/勾选完成；管理员可代为分配任务（创建/删除/勾选）
//
// 同时在 /api/v1/tasks/:taskId 暴露单条任务的 PATCH/DELETE，
// 便于前端按任务 ID 操作（无需先知道 member_id）

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const memberTasks = express.Router({ mergeParams: true });
const taskOps = express.Router();

// /api/v1/members/:memberId/tasks
memberTasks.get('/', auth.requireAuth, (req, res) => {
  const memberId = req.params.memberId;
  if (req.user.role !== 'admin' && req.user.id !== memberId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const rows = db.get().prepare(`
    SELECT id, title, note, done, due_at AS dueAt, created_at AS createdAt, updated_at AS updatedAt
    FROM tasks WHERE member_id = ? AND archived_at IS NULL
    ORDER BY done ASC, id DESC
  `).all(memberId);
  res.json({ tasks: rows });
});

memberTasks.post('/', auth.requireAuth, (req, res) => {
  const memberId = req.params.memberId;
  if (req.user.role !== 'admin' && req.user.id !== memberId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const { title, note, dueAt } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title_required' });
  const now = db.now();
  const r = db.get().prepare(`
    INSERT INTO tasks (member_id, title, note, done, due_at, created_by, created_at, updated_at)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?)
  `).run(memberId, String(title).trim(), note || null, dueAt || null, req.user.id, now, now);
  const created = db.get().prepare('SELECT * FROM tasks WHERE id = ?').get(r.lastInsertRowid);
  res.status(201).json({ task: created });
});

// /api/v1/tasks/:taskId
function loadTask(req, res, next) {
  const id = Number(req.params.taskId);
  const task = db.get().prepare('SELECT * FROM tasks WHERE id = ? AND archived_at IS NULL').get(id);
  if (!task) return res.status(404).json({ error: 'not_found' });
  req.taskRow = task;
  if (req.user.role === 'admin' || req.user.id === task.member_id) return next();
  return res.status(403).json({ error: 'forbidden' });
}

taskOps.patch('/:taskId', auth.requireAuth, loadTask, (req, res) => {
  const { title, note, done, dueAt } = req.body || {};
  const updates = [];
  const args = [];
  if (title !== undefined) { updates.push('title = ?'); args.push(String(title).trim()); }
  if (note !== undefined) { updates.push('note = ?'); args.push(note || null); }
  if (done !== undefined) { updates.push('done = ?'); args.push(done ? 1 : 0); }
  if (dueAt !== undefined) { updates.push('due_at = ?'); args.push(dueAt || null); }
  if (updates.length === 0) return res.json({ task: req.taskRow });
  updates.push('updated_at = ?'); args.push(db.now());
  args.push(req.taskRow.id);
  db.get().prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...args);
  const updated = db.get().prepare('SELECT * FROM tasks WHERE id = ?').get(req.taskRow.id);
  res.json({ task: updated });
});

taskOps.delete('/:taskId', auth.requireAuth, loadTask, (req, res) => {
  const now = db.now();
  db.get().prepare('UPDATE tasks SET archived_at = ?, updated_at = ? WHERE id = ?').run(now, now, req.taskRow.id);
  res.json({ ok: true });
});

module.exports = { memberTasks, taskOps };