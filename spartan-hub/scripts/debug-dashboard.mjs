// 真实模拟前端 refreshFromBackend 流程
import http from 'node:http';

function call(method, path, body, cookieHeader) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (cookieHeader) headers['Cookie'] = cookieHeader;
    const req = http.request({
      hostname: '127.0.0.1', port: 3000, path, method, headers
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        resolve({ status: res.statusCode, headers: res.headers, setCookie, body });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function getCookie(setCookie) {
  if (!setCookie) return null;
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of arr) {
    const m = c.match(/sp_token=([^;]+)/);
    if (m) return `sp_token=${m[1]}`;
  }
  return null;
}

console.log('='.repeat(60));
console.log('真实模拟前端：完全用 cookie（credentials: include）');
console.log('='.repeat(60));

// 1. login
const loginRes = await call('POST', '/api/v1/auth/login', { username: 'allen' });
console.log('1. login 状态:', loginRes.status, 'user:', JSON.parse(loginRes.body).user);
const cookie = getCookie(loginRes.setCookie);
console.log('   拿到 cookie:', cookie?.slice(0, 50) + '...');

// 2. refreshFromBackend 完整流程
const SPARTAN_HUB = {
  users: {}, announcements: [], expenseItems: [], expenseSplits: [],
  tasksByUser: {}, gearStatusByUser: {}
};
const state = { user: 'allen' };

// 1. 成员
const m1 = await call('GET', '/api/v1/members', null, cookie);
console.log('\n2a. GET /members 状态:', m1.status);
if (m1.status === 200) {
  const data = JSON.parse(m1.body);
  for (const x of data.members) {
    SPARTAN_HUB.users[x.username] = { id: x.id, name: x.display, display: x.display, role: x.role, group: x.group, username: x.username };
  }
  console.log('   SPARTAN_HUB.users[allen]:', SPARTAN_HUB.users.allen);
} else {
  console.log('   ❌ 失败:', m1.body);
}

// 2. 公告
const m2 = await call('GET', '/api/v1/announcements', null, cookie);
console.log('\n2b. GET /announcements 状态:', m2.status);

// 3. 费用大项
const m3 = await call('GET', '/api/v1/expense-items', null, cookie);
console.log('\n2c. GET /expense-items 状态:', m3.status);
if (m3.status === 200) {
  const data = JSON.parse(m3.body);
  SPARTAN_HUB.expenseItems = data.items.map(x => ({
    id: String(x.id), title: x.title, category: x.category,
    amountCents: x.amountCents, status: x.status, paidAt: x.paidAt,
    note: x.note || '', createdBy: x.createdBy
  }));
  console.log('   expenseItems:', SPARTAN_HUB.expenseItems.length, '个');
}

// 4. 分摊
const member = SPARTAN_HUB.users[state.user];
console.log('\n2d. 成员检查: member.id =', member?.id, 'role =', member?.role);
if (member && member.role === 'member') {
  const m4 = await call('GET', `/api/v1/members/${member.id}/summary`, null, cookie);
  console.log('   GET /members/' + member.id + '/summary 状态:', m4.status);
  if (m4.status === 200) {
    const data = JSON.parse(m4.body);
    console.log('   summary:', JSON.stringify(data.summary));
    for (const s of (data.splits || [])) {
      SPARTAN_HUB.expenseSplits.push({
        id: String(s.id), itemId: String(s.itemId), memberId: s.memberId,
        amountCents: s.amountCents, paidStatus: s.paidStatus
      });
    }
    console.log('   expenseSplits:', SPARTAN_HUB.expenseSplits.length, '个');
  } else {
    console.log('   ❌ 失败:', m4.body);
  }
}

// 3. 模拟 renderDashboard 过滤
console.log('\n' + '='.repeat(60));
console.log('renderDashboard 过滤逻辑：');
console.log('='.repeat(60));
const user = SPARTAN_HUB.users[state.user];
const mySplits = SPARTAN_HUB.expenseSplits.filter(s => s.memberId === user.id);
console.log('user.id =', user?.id);
console.log('expenseSplits.length =', SPARTAN_HUB.expenseSplits.length);
console.log('mySplits.length =', mySplits.length);
mySplits.forEach(s => {
  const item = SPARTAN_HUB.expenseItems.find(i => i.id === s.itemId);
  console.log('  - ' + (item?.title || '?') + ' | ' + s.amountCents/100 + ' 元');
});
