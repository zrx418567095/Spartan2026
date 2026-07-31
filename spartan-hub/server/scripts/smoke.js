#!/usr/bin/env node
// 端到端 smoke test：覆盖所有公共接口 + 登录 + 成员 CRUD + 管理员 CRUD
// 用法：npm run smoke
// 需要先启动服务（PORT=3001）：

require('dotenv').config();

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:3001';
const FETCH_TIMEOUT_MS = 6000;

let pass = 0, fail = 0;
const failures = [];

function ok(label, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; failures.push({ label, detail }); console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); }
}

async function call(method, path, { token, body, jar } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `sp_token=${token}`;
  const init = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  if (jar && method === 'POST' && path === '/api/v1/auth/login') {
    // 让 fetch 自动管理 cookie
  }
  const res = await fetch(BASE + path, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  return res;
}

async function login(username) {
  const res = await call('POST', '/api/v1/auth/login', { body: { username } });
  const setCookie = res.headers.get('set-cookie') || '';
  const m = setCookie.match(/sp_token=([^;]+)/);
  const token = m ? m[1] : null;
  const data = await res.json().catch(() => ({}));
  return { token, user: data.user, status: res.status };
}

async function run() {
  console.log(`Smoke test against ${BASE}\n`);

  // ====== 健康检查 ======
  console.log('【健康检查】');
  let r = await call('GET', '/healthz');
  ok('GET /healthz', r.status === 200);
  r = await call('GET', '/api/v1/public/event');
  const ev = await r.json();
  ok('GET /api/v1/public/event', r.status === 200 && ev.name === 'SPARTAN SUPER BEAST 2026');

  r = await call('GET', '/api/v1/public/course');
  ok('GET /api/v1/public/course', r.status === 200 && (await r.json()).distanceKm === 49.6);

  r = await call('GET', '/api/v1/public/cutoffs');
  const cutoffs = await r.json();
  ok('GET /api/v1/public/cutoffs', r.status === 200 && cutoffs.length === 5);

  r = await call('GET', '/api/v1/public/aid-stations');
  ok('GET /api/v1/public/aid-stations', r.status === 200 && (await r.json()).length === 8);

  r = await call('GET', '/api/v1/public/obstacles');
  ok('GET /api/v1/public/obstacles', r.status === 200 && (await r.json()).length === 38);

  r = await call('GET', '/api/v1/public/gear');
  ok('GET /api/v1/public/gear', r.status === 200 && (await r.json()).gear.length >= 6);

  // ====== 公告公共读 ======
  console.log('\n【公共读 · 公告】');
  r = await call('GET', '/api/v1/announcements');
  ok('GET /api/v1/announcements (no auth)', r.status === 200);

  // ====== 鉴权失败 ======
  console.log('\n【鉴权】');
  r = await call('GET', '/api/v1/auth/me');
  ok('GET /me without token -> 401', r.status === 401);

  r = await call('POST', '/api/v1/auth/login', { body: { username: 'nosuchuser' } });
  ok('login with unknown user -> 404', r.status === 404);

  r = await call('POST', '/api/v1/auth/login', { body: { username: 'BAD!!NAME' } });
  ok('login with invalid format -> 400', r.status === 400);

  // ====== 登录管理员 ======
  console.log('\n【管理员登录】');
  const adm = await login('admin');
  ok('admin login', adm.status === 200 && adm.user.role === 'admin' && adm.token);
  const ADMIN = adm.token;

  r = await call('GET', '/api/v1/auth/me', { token: ADMIN });
  const meAdmin = await r.json();
  ok('GET /me as admin', r.status === 200 && meAdmin.user.role === 'admin');

  // ====== 登录成员 ======
  // 来源：CSV members_202607311916.csv — m2 = allen（用户本人账号）
  const member = await login('allen');
  ok('allen login (m2)', member.status === 200 && member.user.id === 'm2' && member.token);
  const MEMBER = member.token;

  r = await call('GET', '/api/v1/members', { token: MEMBER });
  const mlist = await r.json();
  ok('GET /members', r.status === 200 && mlist.members.length >= 6);

  // ====== 个人分摊 ======
  console.log('\n【成员分摊】');
  r = await call('GET', '/api/v1/members/m2/summary', { token: MEMBER });
  const ms = await r.json();
  ok('GET /members/m2/summary', r.status === 200 && ms.summary.totalCents === 98900);

  r = await call('GET', '/api/v1/members/m1/summary', { token: MEMBER });
  ok('GET other member summary (m2→m1) -> 403', r.status === 403);

  r = await call('GET', '/api/v1/members/m1/summary', { token: ADMIN });
  ok('GET other member summary as admin', r.status === 200);

  // ====== 标记已付 ======
  console.log('\n【标记已付】');
  r = await call('GET', '/api/v1/members/m2/summary', { token: MEMBER });
  const msBefore = await r.json();
  const splitToPay = msBefore.splits.find(s => s.paidStatus === 'unpaid');
  if (splitToPay) {
    r = await call('POST', `/api/v1/splits/${splitToPay.id}/mark-paid`, { token: MEMBER });
    ok(`POST /splits/${splitToPay.id}/mark-paid (member)`, r.status === 200);
    r = await call('GET', '/api/v1/members/m2/summary', { token: MEMBER });
    const msAfter = await r.json();
    ok('paidCents increased after mark-paid',
       msAfter.summary.paidCents === msBefore.summary.paidCents + splitToPay.amountCents);
  } else {
    ok('mark-paid smoke (no unpaid split available, skipped)', true);
  }

  // ====== 任务 CRUD ======
  console.log('\n【任务 CRUD】');
  r = await call('GET', '/api/v1/members/m2/tasks', { token: MEMBER });
  ok('GET /members/m2/tasks', r.status === 200);

  r = await call('POST', '/api/v1/members/m2/tasks', { token: MEMBER, body: { title: 'smoke-test task' } });
  ok('POST create task', r.status === 201);
  const newTask = await r.json();

  r = await call('PATCH', `/api/v1/tasks/${newTask.task.id}`, { token: MEMBER, body: { done: true } });
  ok('PATCH mark task done', r.status === 200 && (await r.json()).task.done === 1);

  r = await call('DELETE', `/api/v1/tasks/${newTask.task.id}`, { token: MEMBER });
  ok('DELETE task', r.status === 200);

  // ====== 装备读写 ======
  console.log('\n【装备】');
  r = await call('GET', '/api/v1/members/m2/gear', { token: MEMBER });
  ok('GET /members/m2/gear', r.status === 200);

  r = await call('PUT', '/api/v1/members/m2/gear', {
    token: MEMBER,
    body: { items: [{ itemName: '水袋背包 2L', level: 'mandatory', status: 1 }] }
  });
  ok('PUT gear (member)', r.status === 200);

  // ====== 管理员费用 CRUD ======
  console.log('\n【管理员 · 费用大项】');
  r = await call('GET', '/api/v1/expense-items', { token: ADMIN });
  const itemsList = await r.json();
  ok('GET /expense-items as admin', r.status === 200 && itemsList.items.length >= 4);

  r = await call('POST', '/api/v1/expense-items', {
    token: ADMIN,
    body: { title: 'Smoke 大项', category: '装备', amountCents: 36000, status: 'unpaid' }
  });
  ok('POST new expense item', r.status === 201);
  const newItem = (await r.json()).item;

  r = await call('POST', `/api/v1/expense-items/${newItem.id}/splits`, {
    token: ADMIN,
    body: { splits: [
      { memberId: 'm1', amountCents: 6000 },
      { memberId: 'm2', amountCents: 6000 },
      { memberId: 'm3', amountCents: 6000 },
      { memberId: 'm4', amountCents: 6000 },
      { memberId: 'm5', amountCents: 6000 },
      { memberId: 'm6', amountCents: 6000 }
    ]}
  });
  ok('POST 6 splits', r.status === 201 && (await r.json()).splits.length === 6);

  r = await call('GET', `/api/v1/expense-items/${newItem.id}/splits`, { token: ADMIN });
  ok('GET item splits', r.status === 200);

  r = await call('PATCH', `/api/v1/expense-items/${newItem.id}`, {
    token: ADMIN,
    body: { status: 'paid' }
  });
  ok('PATCH mark item paid', r.status === 200);

  r = await call('DELETE', `/api/v1/expense-items/${newItem.id}`, { token: ADMIN });
  ok('DELETE item (soft)', r.status === 200);

  r = await call('GET', '/api/v1/splits/_/team-summary', { token: ADMIN });
  ok('GET team summary', r.status === 200);

  // ====== 成员不能改大项 ======
  console.log('\n【权限边界】');
  r = await call('POST', '/api/v1/expense-items', {
    token: MEMBER,
    body: { title: 'x', category: '装备', amountCents: 100 }
  });
  ok('POST expense-items as member -> 403', r.status === 403);

  r = await call('POST', '/api/v1/announcements', { token: MEMBER, body: { title: 'x' } });
  ok('POST announcements as member -> 403', r.status === 403);

  // ====== 公告 CRUD ======
  console.log('\n【公告】');
  r = await call('POST', '/api/v1/announcements', {
    token: ADMIN, body: { title: 'Smoke 公告', body: 'test', priority: 'mid' }
  });
  ok('POST announcement', r.status === 201);
  const ann = (await r.json()).announcement;

  r = await call('PATCH', `/api/v1/announcements/${ann.id}`, {
    token: ADMIN, body: { pinned: true }
  });
  ok('PATCH pin announcement', r.status === 200);

  r = await call('DELETE', `/api/v1/announcements/${ann.id}`, { token: ADMIN });
  ok('DELETE announcement', r.status === 200);

  // ====== 登出 ======
  console.log('\n【登出】');
  r = await call('POST', '/api/v1/auth/logout', { token: ADMIN });
  ok('logout', r.status === 200);

  r = await call('GET', '/api/v1/auth/me', { token: ADMIN });
  ok('GET /me after logout -> 401', r.status === 401);

  // ====== 总结 ======
  console.log(`\n【总结】 pass=${pass}, fail=${fail}`);
  if (fail > 0) {
    console.log('\n失败项:');
    failures.forEach(f => console.log(`  - ${f.label}${f.detail ? ' (' + f.detail + ')' : ''}`));
    process.exit(1);
  }
}

run().catch(e => {
  console.error('smoke test crashed:', e);
  process.exit(2);
});