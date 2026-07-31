# 成员与权限设计

> 文档版本：v0.2
> 与 `ARCHITECTURE.md` §3 / `db-schema.md` 配合使用

本文回答三个问题：

1. **谁可以登录？** —— 任何姓名全拼命中 `members.username` 的人
2. **登录后能做什么？** —— 取决于 `role`，成员只能动自己的记录；管理员可以动所有
3. **数据怎么隔离？** —— 由路由中间件强制，不依赖客户端

---

## 1. 成员名单（首版种子）

| 业务 ID | 姓名 | 全拼（username） | 角色 | 备注 |
|---|---|---|---|---|
| m1 | 张一 | zhangyi   | member | |
| m2 | 陈二 | chener   | member | |
| m3 | 王三 | wangsan  | member | |
| m4 | 李四 | lisi     | member | |
| m5 | 赵五 | zhaowu   | member | |
| m6 | 孙六 | sunliu   | member | |
| a1 | 管理员 | admin  | admin  | 团队组织方 |

> 全拼规则：复姓连写（`ouyangfei` / `liyunlong`），多音字用最常用音。种子脚本会按上表生成。

> 后续若有人姓名无法拼音化（如外籍成员），再加 `members.username` 别名映射表，当前不预留。

---

## 2. 登录流程（v0.2）

```
浏览器
  │ 1. POST /api/v1/auth/login { username }
  │    (仅做正则：^[a-z]+(\.[a-z]+)?$)
  │    速率：5 r/m  / IP
  ▼
Nginx (TermTLS 终止)  →  Node API
  │ 2. 查 members.username 是否存在
  │    - 不存在：返回 401，不区分"用户不存在/密码错"
  │    - 存在且 archived_at NULL：签发 JWT
  │ 3. 写 sessions 行（jti / issued_at / expires_at）
  │ 4. 写 audit_log（action=auth.login）
  │ 5. 返回 Set-Cookie + { id, display, role }
  ▼
浏览器
  Set-Cookie: sp_token=...; HttpOnly; Secure; SameSite=Strict; Max-Age=28800
```

### 2.1 客户端要求

- `fetch` 始终带 `credentials: 'include'`（同源）
- 不写 `Authorization` header；让浏览器自动发 Cookie
- 前端删除 `js/data.js` 中硬编码账户，改读 `/api/v1/auth/me`

### 2.2 服务端要求

- TLS only：HSTS 头 + 仅服务 HTTPS
- Cookie：`Secure; HttpOnly; SameSite=Strict; Path=/`
- 单实例 PM2 + Node 20 LTS
- 速率限制：`/api/v1/auth/login` `5r/m/IP`，其余 `/api/v1/*` `20r/s/IP`
- 失败 5 次锁定账号 10 分钟（`members.pin_locked`）

### 2.3 速率限制（Nginx 配置片段）

```nginx
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=20r/s;

location = /api/v1/auth/login {
  limit_req zone=login burst=10 nodelay;
  limit_req_status 429;
  proxy_pass http://127.0.0.1:3000;
}

location /api/v1/ {
  limit_req zone=api burst=40 nodelay;
  limit_req_status 429;
  proxy_pass http://127.0.0.1:3000;
}
```

---

## 3. 权限矩阵

### 3.1 谁能做什么（摘要）

| 操作 | 成员 | 管理员 |
|---|---|---|
| 读公共行程 / 比赛攻略 | ✅ | ✅ |
| 读他人费用明细 | ❌ | ✅ |
| 读自己的费用 | ✅ | ✅ |
| 创建费用 | ❌ | ✅ |
| 修改费用（金额 / 状态 / 类别 / 删除） | ❌ | ✅ |
| 追加"我已付款"记录 | ✅ | ✅ |
| 读自己的装备状态 | ✅ | ✅ |
| 修改自己的装备状态 | ✅ | ✅ |
| 读他人装备 | ❌ | ✅ |
| 修改他人装备 | ❌ | ✅ |
| 读自己的任务 | ✅ | ✅ |
| 改自己的任务 | ✅ | ✅ |
| 创建公共公告 | ❌ | ✅ |
| 查看审计日志 | ❌ | ✅ |

### 3.2 中间件实现

```ts
// server/middleware/auth.ts (示意)
export function requireAuth(req, res, next) {
  const token = parseCookie(req.headers.cookie, 'sp_token');
  if (!token) return res.status(401).json({ error: 'login_required' });
  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    if (sessionIsRevoked(req.auth.jti))
      return res.status(401).json({ error: 'revoked' });
    next();
  } catch (e) {
    res.status(401).json({ error: 'invalid_token' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.auth?.role !== 'admin')
    return res.status(403).json({ error: 'admin_only' });
  next();
}

export function requireSelfOrAdmin(getOwnerId) {
  return (req, res, next) => {
    const ownerId = getOwnerId(req);
    if (req.auth?.role === 'admin' || req.auth?.member_id === ownerId) return next();
    res.status(403).json({ error: 'forbidden' });
  };
}
```

### 3.3 路由示例

```ts
router.post(
  '/members/:id/expenses',
  requireAuth,
  requireAdmin,
  jsonBody(createExpenseSchema),
  expensesController.create
);

router.post(
  '/expenses/:id/payments',
  requireAuth,
  jsonBody(createPaymentSchema),
  expensesController.appendPayment   // 服务端再校验 expense.member_id === req.auth.member_id
);

router.put(
  '/members/:id/gear',
  requireAuth,
  requireSelfOrAdmin(req => req.params.id),
  jsonBody(gearStatusSchema),
  gearController.replace
);
```

### 3.4 字段可见性

- 列表接口 `/members` 只暴露公共字段：`id / display / group_name / role`
- `/members/:id/expenses` 返回费用时，`payer` 信息仅 admin 可见，成员端只显示"已结清 / 待支付"汇总

---

## 4. 成员端可见/可改的数据

### 4.1 成员自己能看到

| 字段 | 来源 |
|---|---|
| `display` 姓名 | members.display |
| `group_name` 组别 | members.group_name |
| 我的费用（4 张表：expenses + payments 合计） | 服务端聚合 |
| 我的装备状态（21 项） | gear_status |
| 我的任务 | tasks |
| 公共行程 / 比赛 / 公告 | 公共只读 |

### 4.2 成员自己可以修改

| 表 | 字段 | 约束 |
|---|---|---|
| `payments` | amount_cents / paid_at / note | 只能挂在 `member_id === self` 的 expense 上 |
| `gear_status` | status / note | PUT 整表覆盖 |
| `tasks` | done / note | 仅自身任务 |

### 4.3 管理员可以修改（**全权**）

| 表 | 字段 |
|---|---|
| `members` | 全部（除 `id` 与 `created_at`） |
| `expenses` | 全部字段，包括删除 |
| `gear_status` | 任何成员任何项 |
| `tasks` | 任何成员任何任务 |
| `announcements` | 全部 |
| `audit_log` | 只读 |

---

## 5. "成员追加已付款" 设计

成员不能直接修改 `paid_cents`，但应允许成员上报"我已付 ¥300"。

新增 `payments` 表：

```sql
CREATE TABLE payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id    INTEGER NOT NULL,
  member_id     TEXT NOT NULL,            -- 谁报的（必须 = expense.member_id）
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  paid_at       INTEGER NOT NULL,
  note          TEXT,
  confirmed_at  INTEGER,                  -- admin 审核通过时间；NULL=待审核
  confirmed_by  TEXT,
  archived_at   INTEGER
);

CREATE INDEX idx_payment_expense ON payments(expense_id);
CREATE INDEX idx_payment_member  ON payments(member_id, paid_at);
```

接口：

- 成员 POST `/api/v1/expenses/:id/payments`，提交金额 + 备注
- admin PATCH `/api/v1/payments/:id { confirmed_at }`，标记已确认
- `expenses.paid_cents` = `SUM(payments.amount_cents WHERE confirmed_at IS NOT NULL)`

这保证：
- 成员只能报自己的账单
- 任何支付金额仍需 admin 确认才计入"已结清"汇总
- admin 在金额字段上的直接修改权被审计日志盯住

---

## 6. 与原型的字段兼容

| 原型 | 服务端字段 |
|---|---|
| `users[username]` | `members.username`（全拼） |
| `users[].name` | `members.display` |
| `users[].group` | `members.group_name` |
| `users[].role` | `members.role` |
| `expensesByUser[m1]` | `SELECT * FROM expenses WHERE member_id='m1'` + `JOIN payments` |

迁移阶段，前端把 "输入 member01" 改成 "输入全拼"，后端 `username` 同样支持历史 `member01` 一段时间。

---

## 7. 种子账号对照表

| 业务 ID | 全拼（登录用） | 显示名 |
|---|---|---|
| m1 | `zhangyi`  | 张一 |
| m2 | `chener`   | 陈二 |
| m3 | `wangsan`  | 王三 |
| m4 | `lisi`     | 李四 |
| m5 | `zhaowu`   | 赵五 |
| m6 | `sunliu`   | 孙六 |
| a1 | `admin`    | 管理员（组织方） |

种子脚本 `server/scripts/seed.js` 输出以上 7 行，并写一条 admin 公告"欢迎使用本平台"。

---

## 8. 后续要新增账号怎么办？（v0.3 架构级修复后）

- admin 登录后 → 进入"管理后台" → 点击"成员管理"卡片 → 打开 `admin-members` 视图
- 点击"+ 新增成员"按钮，填写：
  - 登录名（拼音全拼小写，**新增后不可修改**）
  - 姓名（中文）
  - 组别（可选）
  - 角色（成员/管理员）
- 提交后：
  - 前端调 `POST /api/v1/members`（admin-only）→ 服务端插入 `members` 行（`role='member'`、`archived_at=NULL`），写 `audit_log`（`action='member.create'`）
  - 服务端成功才更新前端内存；**失败弹 alert，不静默吞错**
  - 成功后前端调 `refreshFromBackend()` 拉最新数据
- 编辑：点击行内"编辑"按钮 → `PATCH /api/v1/members/:id`（写 `audit_log` `action='member.update'`，含 before/after）
- 删除（软删除 + 级联归档）：点击行内"删除"按钮（带确认）→ `DELETE /api/v1/members/:id`
  - 弹窗文案："确认将成员"XX"标记为归档？"
  - 提示："· 成员账号将被禁用，任务/装备数据一并归档 · 费用分摊记录保留（便于历史查询）"
  - 后端行为：
    1. `UPDATE members SET archived_at = ?, updated_at = ? WHERE id = ?`
    2. `UPDATE tasks SET archived_at = ?, updated_at = ? WHERE member_id = ? AND archived_at IS NULL`（级联归档任务）
    3. `UPDATE gear_status SET updated_at = ? WHERE member_id = ?`（标记装备最后变更）
    4. `expense_splits` 不归档（保留历史审计）
    5. 写 `audit_log` `action='member.archive'`
  - 前端收到 200 后调 `refreshFromBackend()`，从服务端拉最新数据
- **不允许前端自由注册**：所有 `members` 写接口都是 admin-only

> **架构原则（v0.3+）**：后端 SQLite 是唯一真源，前端只缓存登录态。`localStorage` 不再保存任何业务数据（启动时自动清旧缓存）。所有写操作必须经 API，失败一律 alert。

---

## 9. 后续要替换鉴权方式时

- 新增 `auth_methods(member_id, method, secret_hash, enabled, created_at)` 表
- 把 `/api/v1/auth/login` 改造为 `POST /api/v1/auth/start { username }` 返回 challenge
- 再 `POST /api/v1/auth/verify { challenge_id, code }`
- 旧"全拼"作为 `method='pinyin'` 保留一段时间

数据库 schema 不需要迁移，只是多一个表。
