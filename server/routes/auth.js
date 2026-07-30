// /api/v1/auth/* —— 登录、登出、当前用户
// 姓名全拼登录模型：仅校验 username 存在性，无密码。

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

const USERNAME_RE = /^[a-z]+(\.[a-z]+)?$/;

router.post('/login', (req, res) => {
  const username = String(req.body && req.body.username || '').trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'invalid_username', message: '请输入姓名全拼（小写字母，可含一个点）' });
  }

  const member = db.get().prepare(`
    SELECT id, username, display, group_name, role
    FROM members WHERE username = ? AND archived_at IS NULL
  `).get(username);
  if (!member) {
    return res.status(404).json({ error: 'user_not_found', message: '用户不存在' });
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const ua = req.headers['user-agent'] || '';

  const { token } = auth.issueToken({
    memberId: member.id,
    role: member.role,
    ip, ua
  });

  auth.setAuthCookie(res, token);

  res.json({
    user: {
      id: member.id,
      username: member.username,
      display: member.display,
      group: member.group_name,
      role: member.role
    }
  });
});

router.post('/logout', (req, res) => {
  if (req.user && req.user.jti) auth.revokeJti(req.user.jti);
  auth.clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  res.json({ user: req.user });
});

module.exports = router;