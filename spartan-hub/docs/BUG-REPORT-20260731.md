# Bug 报告 · Spartan Hub 数据持久化全链路问题

| 字段 | 值 |
|---|---|
| **报告版本** | 2026-07-31 v1 |
| **生成时间** | 2026-07-31 13:04 GMT+8 |
| **报告人** | 小虾（AI） |
| **报告依据** | 代码审计（`/var/lib/spartan/{js,server}` 全部前端 + 后端代码）+ 接口实测 + 数据库直查 |
| **适用部署** | `spartan-hub-20260731-0016.tar.gz`（部署于 `https://spartanultra.allenboard.cn/`） |
| **环境边界** | **开发环境 = 本地**（按用户 2026-07-31 13:04 确认）；**生产环境 = 服务器 `/var/lib/spartan/`**。本文档描述的问题仅在生产环境观察，修复应在开发环境完成、推 GitHub、再部署到生产。 |

---

## 0. 待用户确认事项（开发前必答）

| # | 事项 | 选项 |
|---|---|---|
| **Q1** | "自定义数据"是否需要抢救进数据库？ | (A) **要** → 告诉我具体改了什么，先 SQL 写进生产 DB；(B) **否** → 直接清库重灌种子 |
| **Q2** | 是否接受 BUG-06 的修复方向（删除成员时级联归档 tasks / gear_status）？ | (A) **接受**（推荐，保留费用分摊、归档任务/装备）；(B) **物理删除**（清空所有引用，破坏历史）；(C) **不动**（保持孤儿数据） |
| **Q3** | admin-members 列表是否需要显示 admin 账号？ | (A) **要**（让管理员能在 UI 管理 admin）；(B) **保持现状**（admin 永远不在列表） |
| **Q4** | 是否接受删除按钮文案改为"标记归档，费用分摊保留"？ | (A) **接受**；(B) 保留旧文案 |
| **Q5** | 是否同意彻底禁用 localStorage 的数据缓存（仅保留登录态 `state.user`）？ | (A) **同意**（推荐，架构级修复）；(B) **保留**（仅修表层 bug） |

> **开发与生产边界声明**：本报告所有修复都先在开发环境（本地）实施 → 推 `zrx418567095/Spartan2026` GitHub → 生产服务器通过 `git pull` + Node 服务重启拉新版本。**绝不直接在生产 `/var/lib/spartan/` 改代码**。

---

## 1. 问题总览（按严重程度排序）

| 优先级 | 编号 | 标题 | 影响面 |
|---|---|---|---|
| **P0** | BUG-01 | 成员写操作静默吞错 | 全平台 |
| **P0** | BUG-02 | 成员数据跨浏览器不同步 | 全平台 |
| **P0** | BUG-03 | 除 admin-members 外，其他 view 全读内存缓存 | 6 个 view |
| **P0** | BUG-04 | localStorage 启动时覆盖后端数据 | 启动流程 |
| **P1** | BUG-05 | expense / splits / tasks / gear / announcements 全是"前端伪实时" | 5 类资源 |
| **P1** | BUG-06 | 删除成员不级联清理 tasks / gear | members DELETE 路径 |
| **P1** | BUG-07 | syncMembersFromApi 不删除后端已删成员 | admin-members 同步 |
| **P2** | BUG-08 | state.user 持久化与后端脱钩 | 登录态校验 |
| **P2** | BUG-09 | admin-members 列表过滤 `role !== 'admin'`，admin 不可见 | UI 完整性 |
| **P3** | BUG-10 | 删除按钮 confirm 文案与实际行为不符 | 文案 |
| **P3** | BUG-11 | 登录校验依赖内存 users | 登录流程 |

---

## 2. 详细描述

### BUG-01【P0】成员写操作静默吞错

**现象**：成员编辑 / 新增 / 删除 时，后端 API 失败（401 / 409 / 500 等）被 catch 吞掉，前端继续修改内存对象并写 localStorage。用户以为成功了，实际数据库无变化。

**根因**：`try/catch` 模式下 catch 直接吞错并继续走"假装成功"分支。

**证据代码**：

```js
// /var/lib/spartan/js/app.js:962-995（编辑 / 新增成员保存）
try {
  if (existing) {
    await apiCall('PATCH', `/members/${existing.id}`, {...});
  } else {
    await apiCall('POST', `/members`, {...});
  }
} catch (e) {
  // 后端失败时退回本地存储（保证可用性）
  console.warn('[members] api failed, fallback to local:', e.message);
}

// 无论成功失败，都更新前端
SPARTAN_HUB.users[uname] = { id, name, role, ... };
persistData();    // 只写 localStorage
render();
```

```js
// /var/lib/spartan/js/app.js:1018-1032（删除成员）
try {
  await apiCall('DELETE', `/members/${u.id}`);
} catch (e) {
  console.warn('[members] delete api failed, fallback to local:', e.message);
}

delete SPARTAN_HUB.users[uname];     // 永远执行
if (SPARTAN_HUB.tasksByUser[u.id]) delete SPARTAN_HUB.tasksByUser[u.id];
if (SPARTAN_HUB.gearStatusByUser[u.id]) delete SPARTAN_HUB.gearStatusByUser[u.id];
persistData();
render();
```

**复现**：
1. 退出登录（或换无痕窗口）
2. 进 admin-members → 新增成员 → 填表 → 保存
3. 看到成员加入列表（以为成功）
4. **真实结果**：数据库 `members` 表无变化
5. 其他浏览器 / 手机访问：看不到这个"新增"

**已验证**：
- 生产 DB `members` 表 `updated_at` 自 2026-07-30 12:02 后再未变化（7 行 active，全是 1785412944）
- 生产日志显示今天下午 `POST / DELETE /api/v1/members` 触发了十几次 → **全部没落库**

---

### BUG-02【P0】成员数据跨浏览器不同步

**现象**：电脑浏览器能看到自定义数据，无痕窗口 / 手机端看不到。

**根因**：数据真源不是后端，是 localStorage。每个浏览器 / 设备的 localStorage 是独立沙箱。

**事实链**：

| 数据来源 | 时机 | 内容 |
|---|---|---|
| `js/data.js` 硬编码 | 页面首次加载 | 7 个种子成员 |
| localStorage `spartan-hub-data` | 用户编辑后 | 用户的"自定义数据" |
| `GET /api/v1/members` | 进入 admin-members 才调 | 7 个种子（用户从未成功写进去） |

**复现**：电脑浏览器编辑某成员 → 同一域名无痕打开 → admin-members 看不到刚才的改动。

---

### BUG-03【P0】其他 view 全读内存缓存，不调 API

**根因**：只有 `syncMembersFromApi`（在 `renderAdminMembers` 开头 await）会从 API 拉数据；其他 view 直接读 `SPARTAN_HUB.users`（内存对象）。

**证据**：

| 行号 | view | 怎么读 members |
|---|---|---|
| 820 | `syncMembersFromApi`（仅 admin-members 用） | ✅ `GET /members` |
| 863 | `renderAdminMembers` | `Object.entries(SPARTAN_HUB.users)` ❌ |
| 594 | `renderDashboard` | `Object.entries(SPARTAN_HUB.users)` ❌ |
| 714 | `renderAdminHub` | `Object.values(SPARTAN_HUB.users).filter(...)` ❌ |
| 736 | `renderAdminExpense` | `Object.entries(SPARTAN_HUB.users)` ❌ |
| 74 | `login(username)` 校验 | `SPARTAN_HUB.users[username]` ❌ |
| 1838 | `init()` 启动时 | `if (saved && SPARTAN_HUB.users[saved]) state.user = saved;` ❌ |

**影响**：登录态校验（行 74）用内存 users → 后端删除的账号还能"假登录"。

---

### BUG-04【P0】localStorage 启动时覆盖后端数据

**根因**：`init()` 第一步就是 `restoreData()` → 用 localStorage 旧数据覆盖 `SPARTAN_HUB.users`。

**证据代码**：

```js
// /var/lib/spartan/js/app.js:14-36
function persistData() {
  localStorage.setItem(DATA_KEY, JSON.stringify({
    expenseItems: SPARTAN_HUB.expenseItems,
    expenseSplits: SPARTAN_HUB.expenseSplits,
    tasksByUser: SPARTAN_HUB.tasksByUser,
    gearStatusByUser: SPARTAN_HUB.gearStatusByUser,
    announcements: SPARTAN_HUB.announcements,
    users: SPARTAN_HUB.users
  }));
}

function restoreData() {
  const saved = localStorage.getItem(DATA_KEY);
  if (!saved) return;
  try {
    const obj = JSON.parse(saved);
    if (obj.users) SPARTAN_HUB.users = obj.users;   // ← 旧 users 覆盖内存
    ...
  } catch (e) { /* ignore */ }
}
```

```js
// /var/lib/spartan/js/app.js:1835-1840
function init() {
  restoreData();    // ← 先用 localStorage 覆盖
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && SPARTAN_HUB.users[saved]) state.user = saved;
  bindDelegatedClicks();
  bindNavToggle();
  render();
  ...
}
```

**影响**：即使 A 设备修改了数据库，B 设备刷新后看到的还是 B 设备 localStorage 里的旧数据。

---

### BUG-05【P1】expense / splits / tasks / gear / announcements 全是"前端伪实时"

**根因**：所有写操作都是"调 API → 改本地内存数组 → `persistData()`"，从不 `GET` 刷新后端回来。

**证据**：

| 资源 | 前端代码行 | 行为 |
|---|---|---|
| expense-items 增删改 | 1462-1471、1606-1630 | 调 API → 改本地数组 → `persistData()`，**不 GET 刷后端** |
| splits | 1316-1332 | 调 API → 改本地 splits → `persistData()`，**不 GET 刷后端** |
| tasks | 1380-1387 | 调 API → 改本地 tasks → `persistData()`，**不 GET 刷后端** |
| gear | 1346-1358 | 调 API → 改本地 gearStatusByUser → `persistData()`，**不 GET 刷后端** |
| announcements | 1700-1715、1780-1798 | 调 API → 改本地 announcements → `persistData()`，**不 GET 刷后端** |

**后端现状**：每个资源都有完整的 `GET / POST / PATCH / DELETE` 路由（见 `/var/lib/spartan/server/routes/{expense-items,tasks,gear,announcements}.js`）。**后端没被用满**。

**复现**：电脑浏览器编辑某个 expense → 无痕打开 → 看不到刚才的编辑。

---

### BUG-06【P1】删除成员不级联清理 tasks / gear

**根因**：后端 `/api/v1/members/:id` DELETE 路由只置成员的 `archived_at`，不联动 tasks / gear_status / expense_splits。

**证据代码**：

```js
// /var/lib/spartan/server/routes/members.js:124-131
router.delete('/:id', auth.requireAdmin, (req, res) => {
  const id = String(req.params.id);
  if (id === 'a1') return res.status(400).json({ error: 'cannot_delete_admin' });
  const exist = db.get().prepare('SELECT id FROM members WHERE id = ? AND archived_at IS NULL').get(id);
  if (!exist) return res.status(404).json({ error: 'not_found' });
  // 软删除：保留 expense_splits 历史，置 archived_at
  db.get().prepare('UPDATE members SET archived_at = ?, updated_at = ? WHERE id = ?').run(db.now(), db.now(), id);
  res.json({ ok: true });
});
```

**当前生产 DB 验证**：

```
SELECT t.member_id, COUNT(*) AS cnt FROM tasks t LEFT JOIN members m ON t.member_id = m.id WHERE m.archived_at IS NOT NULL AND t.archived_at IS NULL GROUP BY t.member_id;
→ （空，无孤儿任务）

SELECT g.member_id, COUNT(*) AS cnt FROM gear_status g LEFT JOIN members m ON g.member_id = m.id WHERE m.archived_at IS NOT NULL GROUP BY g.member_id;
→ （空，无孤儿装备）

SELECT s.member_id, COUNT(*) AS cnt FROM expense_splits s LEFT JOIN members m ON s.member_id = m.id WHERE m.archived_at IS NOT NULL AND s.archived_at IS NULL GROUP BY s.member_id;
→ （空，无孤儿分摊）
```

**注**：当前生产 DB 暂无孤儿数据（m9 / m99 是测试账号，没跟着 tasks / gear / splits）。但代码层面确实存在隐患，未来一旦真有成员被删除，孤儿数据会出现。

---

### BUG-07【P1】syncMembersFromApi 不删除后端已删成员

**根因**：同步循环体里**只有注释，没有删除逻辑**。

**证据代码**：

```js
// /var/lib/spartan/js/app.js:840-846
// 删除本地有但 API 没有的"已删除"成员（仅清掉后端已删除的，不动其他本地临时数据）
for (const uname of Object.keys(SPARTAN_HUB.users)) {
  if (!apiByUsername[uname] && SPARTAN_HUB.users[uname].role !== 'admin') {
    // 不直接 delete，避免误删用户临时状态；仅当本地已"标记已删除"才清
  }
}
```

**复现**：A 设备管理员删了某成员 → B 设备进入 admin-members → B 设备的本地 users 仍保留被删成员。

---

### BUG-08【P2】state.user 持久化与后端脱钩

**根因**：localStorage `spartan-hub-user` 保存登录名，`init()` 取出后用 `SPARTAN_HUB.users[saved]` 验证存在性（内存中）→ 设为 `state.user`。**从未调 `GET /api/v1/auth/me` 验证 token 是否还有效**。

**证据代码**：

```js
// /var/lib/spartan/js/app.js:1838
if (saved && SPARTAN_HUB.users[saved]) state.user = saved;
```

**复现**：用 admin 登录 → 后端 `revokeJti` 撤销 token → 刷新页面 → 仍显示"已登录" → 第一次实际 API 调用才 401。

---

### BUG-09【P2】admin-members 列表不显示 admin 角色

**根因**：硬编码过滤。

**证据代码**：

```js
// app.js:863
const members = Object.entries(SPARTAN_HUB.users)
  .filter(([_, u]) => u.role !== 'admin')   // ← 硬编码隐藏 admin
  .map(...)
```

**影响**：表格永远不显示 admin 行（即使想管理 admin 账号也无法）。

---

### BUG-10【P3】删除按钮 confirm 文案与实际行为不符

**证据代码**：

```js
// app.js:1016-1018
if (!confirm(`确认删除成员"${u.name}"？\n\n注意：
· 费用分摊记录不会被自动删除
· 成员的任务和物资数据将被移除`)) return;
```

**问题**：
- 文案说"任务和物资数据将被移除"——**只在 localStorage 被移除**
- 数据库里实际**不会被移除**（参见 BUG-06）

---

### BUG-11【P3】登录校验依赖内存 users

**证据代码**：

```js
// app.js:73-79
function login(username) {
  const user = SPARTAN_HUB.users[username];
  if (!user) return false;
  state.user = username;
  persist();
  return true;
}
```

**问题**：
- 登录走的是**前端内存校验**，不调 `POST /api/v1/auth/login`
- 真正的后端登录路由 `/api/v1/auth/login` 存在但前端不调
- 这是 demo 模式快捷方式，但和真实登录态混在一起导致行为不可预期

---

## 3. 数据库当前状态（与 BUG-01 互证）

| 表 | 状态 |
|---|---|
| `members` | 9 行（7 active + 2 archived: m9 testpersist、m99 synctest）；所有 active 行 `updated_at = 1785412944`（2026-07-30 12:02）→ 之后无任何真实写入 |
| `sessions` | 22 行 → 今天有 5+ 次登录尝试 |
| `expense_items`、`expense_splits`、`tasks`、`gear_status`、`announcements` | 全部种子数据 |

**结论**：后端表从未被前端"假成功"的写操作污染过。这反而说明 OpenClaw 那次"持久化修复"也是失败的。

---

## 4. 建议的修复方向

按"**真源 = 后端 SQLite，前端只是视图**"原则重构。

### A. 数据流改造（架构级）
1. **删除 `persistData()` 和 `restoreData()`**（除登录态外的所有 localStorage 数据）
2. `init()` 启动时按需调 API 拉数据填内存缓存
3. `render()` 渲染前 await 一次核心数据刷新
4. 所有写操作 await API → 用返回的最新值更新本地缓存
5. **写失败一律 alert，不静默吞**

### B. 后端加固
6. `DELETE /api/v1/members/:id` 级联 `UPDATE tasks/gear_status SET archived_at = ? WHERE member_id = ?`（保留 expense_splits 历史，符合现有"软删除成员"语义）
7. `GET /api/v1/auth/me` 已有（auth.js:54）→ 启动时调用验证 token（修 BUG-08）
8. `syncMembersFromApi` 补齐删除逻辑（修 BUG-07）

### C. 前端一致性
9. admin-members 渲染改为强制 GET（与 BUG-03 一并修）
10. 删除按钮文案改成真实情况（"标记为归档，费用分摊保留"，修 BUG-10）
11. admin 角色是否在列表显示，按 Q3 决定（修 BUG-09）

### D. 测试与回归
12. 写一个 `scripts/smoke.js` 覆盖所有 CRUD 路径：登录 → 拉成员 → 新增 → 改 → 删 → 验证数据库
13. 每个 view 跨浏览器打开验证一致性

---

## 5. 修复顺序（风险递增）

| 步骤 | 改动 | 风险 |
|---|---|---|
| 1 | 先抢救"自定义数据"进数据库（如果你要保留，Q1 = A） | 低（只是 SQL） |
| 2 | 修 BUG-06（后端级联清理） | 中（影响删除语义） |
| 3 | 修 BUG-07（syncMembersFromApi 补删除） | 低 |
| 4 | 修 BUG-10（删除文案） | 低 |
| 5 | 修 BUG-09（admin 可见性，按 Q3） | 低 |
| 6 | 修 BUG-08 / BUG-11（启动时验证 + 登录走 API） | 中 |
| 7 | **修 BUG-01 / 04 / 05 / 02 / 03（A 大改造：禁 localStorage + 全 GET 刷新 + 写失败 alert）** | **高（架构级改动）** |
| 8 | 写回归测试 scripts/smoke.js | 低 |
| 9 | 部署到生产（按 DEPLOY.md 流程） | 中（灰度上线） |

---

## 6. 开发与生产边界提醒

按 2026-07-31 13:04 用户明确指示：

- **开发环境 = 本地**（推测路径 `J:/kimi-test/spartan-hub`，参见 README.md）
- **生产环境 = 服务器 `/var/lib/spartan/`**

**修复原则**：
1. 所有代码改动都在本地开发，**严禁直接在生产服务器 `/var/lib/spartan/` 改文件**
2. 本地完成 + 自测通过 → 推 `zrx418567095/Spartan2026`（用项目自带 `push.sh`）
3. 生产服务器通过 `git pull` + Node 服务重启拉新版本（参见 `DEPLOY.md`）
4. 数据库 schema 变更需同步更新 `docs/db-schema.md`
5. 每次发版前在 `docs/CHANGELOG.md` 追加条目
6. 每次发版后跑 `docs/TEST_PLAN.md` 验收

---

## 7. 参考文档

| 文档 | 路径 |
|---|---|
| 架构总览 | `/var/lib/spartan/docs/ARCHITECTURE.md` |
| 数据库 schema | `/var/lib/spartan/docs/db-schema.md` |
| 成员与认证 | `/var/lib/spartan/docs/MEMBERS_AND_AUTH.md` |
| 部署流程 | `/var/lib/spartan/docs/DEPLOY.md` |
| 测试计划 | `/var/lib/spartan/docs/TEST_PLAN.md` |
| 既有测试报告 | `/var/lib/spartan/docs/TEST_REPORT.md` |
| 变更日志 | `/var/lib/spartan/docs/CHANGELOG.md` |

---

**报告完。** 待用户回答 Q1~Q5 后开始按修复顺序执行。