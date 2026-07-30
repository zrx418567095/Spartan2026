#!/usr/bin/env node
// 种子数据：6 名成员 + 1 名管理员 + 样例大项与分摊
// 幂等：使用 INSERT OR IGNORE / 不存在才插入
// 用法：npm run db:seed 或 node scripts/seed.js

require('dotenv').config();
const path = require('node:path');
const db = require('../db');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'spartan.db');
const handle = db.open(DB_PATH);
const ts = db.now();

console.log('[seed] members ...');
const insertMember = handle.prepare(`
  INSERT OR IGNORE INTO members (id, username, display, group_name, role, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const members = [
  ['m1', 'chener',     '陈尔',   '广州组', 'member'],
  ['m2', 'zhangyi',    '张毅',   '广州组', 'member'],
  ['m3', 'panbin',     '潘斌',   '广州组', 'member'],
  ['m4', 'xuwei',      '徐伟',   '广州组', 'member'],
  ['m5', 'xuxiaoyong', '徐晓勇', '广州组', 'member'],
  ['m6', 'zhousong',   '周松',   '广州组', 'member'],
  ['a1', 'admin',      '管理员', '组织方', 'admin']
];
for (const [id, username, display, group, role] of members) {
  insertMember.run(id, username, display, group, role, ts, ts);
}

// 检查是否已经有大项，避免重复 seed
const itemCount = handle.prepare('SELECT COUNT(*) AS c FROM expense_items').get().c;
if (itemCount === 0) {
  console.log('[seed] expense items ...');
  const insertItem = handle.prepare(`
    INSERT INTO expense_items (title, category, amount_cents, status, note, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const items = [
    ['云顶大酒店拼房 2 晚', '住宿', 96000,  1, '6 人合住，标准间 3 间', 'a1'],
    ['斯巴达报名费',       '赛事', 420000, 1, '6 人 × ¥700',          'a1'],
    ['北京⇌太子城高铁',    '交通', 59400,  1, '6 人去程 × ¥99',       'a1'],
    ['庆功晚宴 USBY 餐厅', '餐饮', 18000,  1, '6 人聚餐预算',         'a1']
  ];
  const itemIds = [];
  for (const [title, cat, amt, st, note, by] of items) {
    const r = insertItem.run(title, cat, amt, st, note, by, ts, ts);
    itemIds.push(r.lastInsertRowid);
  }

  console.log('[seed] expense splits ...');
  const insertSplit = handle.prepare(`
    INSERT INTO expense_splits (expense_item_id, member_id, amount_cents, paid_status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, 0, 'a1', ?, ?)
  `);
  const memberIds = ['m1','m2','m3','m4','m5','m6'];
  const splitsPerItem = [16000, 70000, 9900, 3000];
  for (let i = 0; i < itemIds.length; i++) {
    for (const mid of memberIds) {
      insertSplit.run(itemIds[i], mid, splitsPerItem[i], ts, ts);
    }
  }
} else {
  console.log('[seed] expense items already exist, skip.');
}

// 公告：仅在 announcements 为空时插入
const annCount = handle.prepare('SELECT COUNT(*) AS c FROM announcements').get().c;
if (annCount === 0) {
  console.log('[seed] announcements ...');
  const insertAnn = handle.prepare(`
    INSERT INTO announcements (title, body, priority, scope, pinned, publish_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const announcements = [
    {
      title: '8/13 19:00 番禺广场集合',
      body: '全体队员 8 月 13 日晚 19:00 在番禺广场地铁 A 出口集合\n请准时到达，携带护照 + 身份证 + 装备清单',
      priority: 'high',
      scope: 'public',
      pinned: 1
    },
    {
      title: 'G7831 票已统一出票',
      body: '北京北 → 太子城 8/14 07:29\n6 人车票已由 admin 统一领取',
      priority: 'mid',
      scope: 'public',
      pinned: 0
    },
    {
      title: '赛事规则更新：障碍 #14 调整',
      body: '组委会最新通知，#14 障碍高度降低 0.5m，新手友好。',
      priority: 'low',
      scope: 'public',
      pinned: 0
    }
  ];
  for (const a of announcements) {
    insertAnn.run(a.title, a.body, a.priority, a.scope, a.pinned, ts, 'a1');
  }
} else {
  console.log('[seed] announcements already exist, skip.');
}

console.log('[seed] done.');
db.close();