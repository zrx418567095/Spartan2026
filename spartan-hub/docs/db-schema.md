# 数据库 Schema（SQLite）

> 版本：v0.1
> 适用代码：`server/db.js`（下一轮即将实现）
> 引擎：SQLite 3.40+
> 字符：UTF-8
> 时区：所有 `INTEGER` 时间戳为 UTC 秒；客户端按 `Asia/Shanghai` 渲染

本文是 `docs/ARCHITECTURE.md` §3 数据模型一节的细化，提供可直接执行的 DDL。

---

## 0. 设计要点

- **金额一律用 `INTEGER` 的分（cents）**，避免浮点误差
- **时间戳一律用 `INTEGER` 保存 UTC 秒**，跨时区无歧义
- **主键策略**：业务表用业务 ID（`m1` / `m2`），避免自增 ID 暴露
- **状态码用 `INTEGER` + 注释**，避免 `ENUM`
- **不建外键约束**：依赖应用层事务保证一致性；SQLite 外键限制反而易踩坑
- **不写关联删除**：数据软保留（`archived_at`），便于审计

---

## 1. ER 关系

```
members 1───* sessions         1 个成员可有多次登录态
members 1───* expense_splits   成员 1:N 分摊记录
expense_items 1───* expense_splits  大项 1:N 分摊
members 1───* gear_status      个人装备状态 1:N
members 1───* tasks            个人任务 1:N
announcements                    1───* announcement_targets 公告 × 目标成员
audit_log                        记录所有写操作
```

> **费用数据模型**：管理员在大项（`expense_items`）中录入总费用，再为指定成员挂分摊（`expense_splits`）。成员不直接录入费用，只能确认自己的分摊已支付。

---

## 2. 命名规范

- 表名：小写 + 下划线（`snake_case`），复数
- 主键：`id`（业务 ID）或 `*_id`（外键）
- 时间字段：`*_at` 后缀（`created_at`、`updated_at`、`expires_at`、`archived_at`）
- 布尔：使用 `INTEGER` (0/1)
- 金额：`amount_cents`
- 枚举：用 `CHECK` 约束或注释说明

---

## 3. DDL（直接执行）

```sql
PRAGMA foreign_keys = OFF;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;

-- ============================================================
-- members：成员 / 管理员
-- ============================================================
CREATE TABLE members (
  id          TEXT PRIMARY KEY,                  -- 'm1'、'm2' ...；admin 为 'a1'
  username    TEXT NOT NULL UNIQUE,              -- 'member01'、'admin'，登录用
  display     TEXT NOT NULL,                     -- 显示名 '张一'
  group_name  TEXT,                              -- '广州组' / '北京汇合' / '组织方'
  role        TEXT NOT NULL CHECK (role IN ('member', 'admin')),
  -- 团队内"账号名登录"的过渡字段；首次部署后由种子写一次
  pin         TEXT,                              -- 仅 6 位本地 PIN（弱加密），不存明文
  pin_locked  INTEGER NOT NULL DEFAULT 0,        -- 是否锁定（连续错误 5 次）
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  archived_at INTEGER                            -- NULL=正常；非 NULL=软删
);

CREATE INDEX idx_members_username ON members(username);
CREATE INDEX idx_members_archived  ON members(archived_at);

-- ============================================================
-- sessions：JWT 撤销表（可选）
-- 当改为 JWT 后，下发 JWT；登出或重置密码时把 jti 加入黑名单
-- 第一阶段先不启用此表，仅保留结构
-- ============================================================
CREATE TABLE sessions (
  jti        TEXT PRIMARY KEY,                    -- JWT ID
  member_id  TEXT NOT NULL,
  issued_at  INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,                            -- NULL=有效；非 NULL=吊销
  ip         TEXT,
  user_agent TEXT,
  FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE INDEX idx_sessions_member   ON sessions(member_id);
CREATE INDEX idx_sessions_expires  ON sessions(expires_at);

-- ============================================================
-- expense_items：大项（由管理员录入，如机票、酒店、报名费等）
-- status: 1=待支付 / 2=已付清 / 3=已取消
-- ============================================================
CREATE TABLE expense_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,                    -- '上海–香港机票'
  category      TEXT NOT NULL
                CHECK (category IN ('交通', '住宿', '餐饮', '赛事', '装备', '其他')),
  amount_cents  INTEGER NOT NULL CHECK (amount_cents >= 0),  -- 大项总金额
  status        INTEGER NOT NULL DEFAULT 1
                CHECK (status IN (1, 2, 3)),
  paid_at       INTEGER,                          -- 管理员确认已付时间
  note          TEXT,
  created_by    TEXT NOT NULL,                    -- admin id
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  archived_at   INTEGER
);

CREATE INDEX idx_expense_items_status    ON expense_items(status) WHERE archived_at IS NULL;
CREATE INDEX idx_expense_items_category  ON expense_items(category) WHERE archived_at IS NULL;

-- ============================================================
-- expense_splits：分摊（从属于大项，指定成员及分摊金额）
-- paid_status: 0=待付 / 1=已付（成员线下自结，管理员确认核销）
-- ============================================================
CREATE TABLE expense_splits (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_item_id INTEGER NOT NULL,
  member_id       TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL CHECK (amount_cents >= 0),  -- 该成员分摊金额
  paid_status     INTEGER NOT NULL DEFAULT 0
                  CHECK (paid_status IN (0, 1)),
  paid_at         INTEGER,                                    -- 成员确认已付时间
  note            TEXT,
  created_by      TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  archived_at     INTEGER,
  FOREIGN KEY (expense_item_id) REFERENCES expense_items(id),
  FOREIGN KEY (member_id)       REFERENCES members(id)
);

CREATE UNIQUE INDEX idx_expense_splits_uniq
  ON expense_splits(expense_item_id, member_id)
  WHERE archived_at IS NULL;
CREATE INDEX idx_expense_splits_member   ON expense_splits(member_id) WHERE archived_at IS NULL;
CREATE INDEX idx_expense_splits_paid     ON expense_splits(paid_status) WHERE archived_at IS NULL;

-- ============================================================
-- gear_status：个人装备状态
-- status: 0=未确认 / 1=已有 / 2=待购买 / 3=已装包
-- level : mandatory / recommended / optional（决定是否必带）
-- ============================================================
CREATE TABLE gear_status (
  member_id    TEXT NOT NULL,
  item_name    TEXT NOT NULL,                     -- 与 publicGear[].name 对应
  level        TEXT NOT NULL CHECK (level IN ('mandatory', 'recommended', 'optional')),
  status       INTEGER NOT NULL DEFAULT 0
               CHECK (status IN (0, 1, 2, 3)),
  note         TEXT,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (member_id, item_name)
);

CREATE INDEX idx_gear_member_level ON gear_status(member_id, level);

-- ============================================================
-- tasks：个人任务
-- done: 0/1；due_at: UTC 秒
-- ============================================================
CREATE TABLE tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id   TEXT NOT NULL,
  title       TEXT NOT NULL,
  note        TEXT,
  done        INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  due_at      INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  archived_at INTEGER
);

CREATE INDEX idx_tasks_member_done ON tasks(member_id, done) WHERE archived_at IS NULL;
CREATE INDEX idx_tasks_due         ON tasks(due_at) WHERE archived_at IS NULL;

-- ============================================================
-- announcements：公告（公共与个人）
-- priority: high / mid / low；scope: public / member / admin
-- target_member_id IS NULL 表示公共公告
-- ============================================================
CREATE TABLE announcements (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  priority         TEXT NOT NULL DEFAULT 'mid'
                    CHECK (priority IN ('high', 'mid', 'low')),
  scope            TEXT NOT NULL DEFAULT 'public'
                    CHECK (scope IN ('public', 'member', 'admin')),
  target_member_id TEXT,
  publish_at       INTEGER NOT NULL,
  expires_at       INTEGER,
  created_by       TEXT NOT NULL,
  archived_at      INTEGER,
  FOREIGN KEY (target_member_id) REFERENCES members(id)
);

CREATE INDEX idx_ann_pub  ON announcements(publish_at) WHERE archived_at IS NULL;
CREATE INDEX idx_ann_scope ON announcements(scope, target_member_id);

-- ============================================================
-- audit_log：所有写操作都留痕
-- 关键场景：管理员改费用、成员改装备状态、成员完成任务
-- 第一阶段先不强制写入，应用层主动调用
-- ============================================================
CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id    TEXT NOT NULL,                      -- 谁操作
  action      TEXT NOT NULL,                      -- 'expense.update' / 'gear.put' ...
  target      TEXT NOT NULL,                      -- 'expense:32'
  before      TEXT,                               -- JSON before
  after       TEXT,                               -- JSON after
  ip          TEXT,
  ua          TEXT,
  created_at  INTEGER NOT NULL
);

CREATE INDEX idx_audit_target ON audit_log(target);
CREATE INDEX idx_audit_actor  ON audit_log(actor_id, created_at);
```

---

## 4. 种子数据示例

```sql
-- 6 名成员 + 1 个管理员
INSERT INTO members (id, username, display, group_name, role, created_at, updated_at) VALUES
  ('m1', 'chener',      '陈尔',   '广州组',  'member', strftime('%s','now'), strftime('%s','now')),
  ('m2', 'zhangyi',     '张毅',   '广州组',  'member', strftime('%s','now'), strftime('%s','now')),
  ('m3', 'panbin',      '潘斌',   '广州组',  'member', strftime('%s','now'), strftime('%s','now')),
  ('m4', 'xuwei',       '徐伟',   '广州组',  'member', strftime('%s','now'), strftime('%s','now')),
  ('m5', 'xuxiaoyong',  '徐晓勇', '广州组',  'member', strftime('%s','now'), strftime('%s','now')),
  ('m6', 'zhousong',    '周松',   '广州组',  'member', strftime('%s','now'), strftime('%s','now')),
  ('a1', 'admin',       '管理员', '组织方',  'admin',  strftime('%s','now'), strftime('%s','now'));

-- 大项样例
INSERT INTO expense_items (title, category, amount_cents, status, note, created_by, created_at, updated_at) VALUES
  ('香港云顶酒店拼房 2 晚', '住宿', 96000, 1, '每人 ¥16000，共 6 人；m1 垫付', 'a1', strftime('%s','now'), strftime('%s','now')),
  ('斯巴达报名费',         '赛事', 420000, 1, '每人 ¥700，共 6 人',             'a1', strftime('%s','now'), strftime('%s','now'));

-- 分摊样例（机票大项均摊给 6 名成员，每人 ¥50000）
INSERT INTO expense_splits (expense_item_id, member_id, amount_cents, paid_status, created_by, created_at, updated_at) VALUES
  (1, 'm1', 16000, 0, 'a1', strftime('%s','now'), strftime('%s','now')),
  (1, 'm2', 16000, 0, 'a1', strftime('%s','now'), strftime('%s','now')),
  (1, 'm3', 16000, 0, 'a1', strftime('%s','now'), strftime('%s','now')),
  (1, 'm4', 16000, 0, 'a1', strftime('%s','now'), strftime('%s','now')),
  (1, 'm5', 16000, 0, 'a1', strftime('%s','now'), strftime('%s','now')),
  (1, 'm6', 16000, 0, 'a1', strftime('%s','now'), strftime('%s','now')),
  (2, 'm1', 70000, 0, 'a1', strftime('%s','now'), strftime('%s','now')),
  (2, 'm2', 70000, 0, 'a1', strftime('%s','now'), strftime('%s','now')),
  (2, 'm3', 70000, 0, 'a1', strftime('%s','now'), strftime('%s','now')),
  (2, 'm4', 70000, 0, 'a1', strftime('%s','now'), strftime('%s','now')),
  (2, 'm5', 70000, 0, 'a1', strftime('%s','now'), strftime('%s','now')),
  (2, 'm6', 70000, 0, 'a1', strftime('%s','now'), strftime('%s','now'));

-- 每位成员的待办任务样例
INSERT INTO tasks (member_id, title, note, done, due_at, created_at, updated_at) VALUES
  ('m1', '8/12 完成装备检查',           NULL, 1, strftime('%s','2026-08-12 12:00'), strftime('%s','now'), strftime('%s','now')),
  ('m1', '8/13 19:00 番禺广场集合',    NULL, 0, strftime('%s','2026-08-13 11:00'), strftime('%s','now'), strftime('%s','now')),
  ('m4', '支付云顶酒店拼房 ¥800',      NULL, 0, strftime('%s','2026-08-10 23:59'), strftime('%s','now'), strftime('%s','now')),
  ('m6', '8/13 前确认北京汇合航班',    NULL, 1, strftime('%s','2026-08-13 00:00'), strftime('%s','now'), strftime('%s','now'));

-- 公共公告样例
INSERT INTO announcements (title, body, priority, scope, publish_at, created_by) VALUES
  ('8/13 19:00 番禺广场集合', '广州组在番禺广场地铁站集合，预计 19:10 出发。', 'high', 'public',
   strftime('%s','now'), 'a1'),
  ('G7831 票已统一出票',       '8/14 07:29 北京北 → 太子城，二等座。',            'mid',  'public',
   strftime('%s','now'), 'a1'),
  ('赛事规则更新',              '障碍 #14 调整，详细变更见规则页。',               'low',  'public',
   strftime('%s','now'), 'a1');
```

---

## 5. 视图（可选）

```sql
-- 成员个人费用汇总（来自分摊）
CREATE VIEW v_member_expense_summary AS
SELECT
  es.member_id,
  COUNT(*)                                    AS items,
  SUM(es.amount_cents)                        AS total_cents,
  SUM(CASE WHEN es.paid_status = 1 THEN es.amount_cents ELSE 0 END) AS paid_cents,
  SUM(CASE WHEN es.paid_status = 0 THEN es.amount_cents ELSE 0 END) AS pending_cents
FROM expense_splits es
JOIN expense_items ei ON ei.id = es.expense_item_id
WHERE es.archived_at IS NULL AND ei.archived_at IS NULL
GROUP BY es.member_id;

-- 大项汇总（含未分配金额）
CREATE VIEW v_expense_items_with_balance AS
SELECT
  ei.id,
  ei.title,
  ei.category,
  ei.amount_cents AS total_cents,
  COALESCE(SUM(es.amount_cents), 0)           AS split_cents,
  ei.amount_cents - COALESCE(SUM(es.amount_cents), 0) AS unassigned_cents
FROM expense_items ei
LEFT JOIN expense_splits es
    ON es.expense_item_id = ei.id AND es.archived_at IS NULL
WHERE ei.archived_at IS NULL
GROUP BY ei.id;

-- 团队总览
CREATE VIEW v_team_overview AS
SELECT
  COUNT(*)                                        AS members,
  SUM(CASE WHEN role='member' THEN 1 ELSE 0 END)  AS athletes,
  SUM(CASE WHEN role='admin' THEN 1 ELSE 0 END)   AS admins
FROM members
WHERE archived_at IS NULL;
```

---

## 6. 与原型的字段映射

原型 (`js/data.js`) 是客户端硬编码数据；切换到后端后，字段含义保持不变。

| 原型字段 | 数据库字段 | 备注 |
|---|---|---|
| `event.*` | 不入表 | 静态常量，前后端同源（如 `data.json`） |
| `itinerary[]` | 不入表 | 静态常量 |
| `itinerary[].items[].highlight` | 不入表 | 属于渲染层 |
| `users[username]` | `members` | username 是登录名，id 是内部主键 |
| `users[].id` (`m1`/`m2`) | `members.id` | 直接对齐 |
| `users[].name` | `members.display` | |
| `users[].group` | `members.group_name` | |
| `users[].role` | `members.role` | |
| `expensesByUser[m1][*]` | `expense_splits.member_id='m1'` + `expense_items` | 大项+分摊模型 |
| `expenses[].amount` | `expense_splits.amount_cents` | 客户端渲染时 ÷100 |
| `expenses[].paid` | `expense_splits.paid_status` (0/1) | |
| `expenses[].category` | `expense_items.category` | |
| `expenses[].title` | `expense_items.title` | 大项名称 |
| `gearStatusByUser[m1][item]` | `gear_status` | key 拆成 `(member_id, item_name)` |
| `gearStatus[].status` (0/1/2/3) | `gear_status.status` | 一致 |
| `tasksByUser[m1][*]` | `tasks.member_id='m1'` | 一行对应一条 task |
| `tasks[].title` / `.done` | `tasks.title` / `tasks.done` | |
| `announcements[]` | `announcements` | 公共 + 定向 |

---

## 7. 金额与时间约定

### 7.1 金额

- 数据库全部 `INTEGER`（分）
- API 返回时一律返回 `amount_cents` 和 `paid_cents` 整数
- 客户端拿到后做 `value / 100` 与 `Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })` 渲染

### 7.2 时间

- 数据库 `INTEGER` 是 Unix 秒（UTC）
- API 返回时同时给：

```json
{
  "due_at": 1723324800,
  "due_at_iso": "2026-08-10T00:00:00+08:00",
  "due_date": "2026-08-10"
}
```

- `due_date` 是纯文本 `YYYY-MM-DD`，客户端原样展示
- `due_at_iso` 已按 `Asia/Shanghai` 渲染

### 7.3 状态枚举速查

| 字段 | 值 | 含义 |
|---|---|---|
| `expense_items.status` | 1 | 待支付 |
| | 2 | 已付清 |
| | 3 | 已取消 |
| `expense_splits.paid_status` | 0 | 待付 |
| | 1 | 已付（成员线下自结，管理员核销） |
| `gear_status.status` | 0 | 未确认（前端点击切换为 1） |
| | 1 | 已确认 |
| `gear_status.level` | mandatory / recommended / optional |
| `tasks.done` | 0 / 1 |
| `announcements.priority` | high / mid / low |
| `announcements.scope` | public / member / admin |
| `members.role` | member / admin |

---

## 8. 索引与查询模式

| 表 | 高频查询 | 索引 |
|---|---|---|
| `members` | 登录：`WHERE username = ? AND archived_at IS NULL` | `idx_members_username` 唯一索引已覆盖 |
| `expense_items` | 按分类/状态筛选 | `idx_expense_items_status` + `idx_expense_items_category` |
| `expense_splits` | 成员分摊列表：`WHERE member_id = ? AND archived_at IS NULL` | `idx_expense_splits_member` |
| | 成员待付/已付筛选 | `idx_expense_splits_paid` |
| `gear_status` | 个人装备面板：`WHERE member_id = ?` | 主键覆盖 |
| | 强制装备全员进度：`WHERE level = 'mandatory'` | 复合索引 `(member_id, level)` |
| `tasks` | 个人待办：`WHERE member_id = ? AND done = 0` | 主键覆盖 + `idx_tasks_member_done` |

---

## 9. 索引健康

上线后每月跑一次：

```sql
ANALYZE;
SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name NOT LIKE 'sqlite_%';
```

每月用 `sqlite3 spartan.db 'PRAGMA integrity_check;'` 校验文件。

---

## 10. WAL 与并发

- 启动脚本加 `PRAGMA journal_mode = WAL;`，允许多读 + 单写并发
- 同时最多 1 个 writer；reader 不阻塞
- PM2 多 worker 部署必须谨慎：

  - 方案 A（推荐）：`pm2 start server/index.js -i 1`，单进程 + Node 自带异步 I/O
  - 方案 B（高并发）：前置负载均衡 + 多个 1-worker 实例
  - SQLite 单文件 + WAL 在多进程并发写时会出现 `SQLITE_BUSY`，务必加 `busy_timeout = 5000` 与重试

---

## 11. 数据保留与归档

- 业务数据**不硬删除**，统一 `archived_at`
- 软删 90 天后由 admin 一键物理清理由脚本完成：

```sql
DELETE FROM expenses WHERE archived_at IS NOT NULL AND archived_at < strftime('%s','now','-90 days');
DELETE FROM tasks    WHERE archived_at IS NOT NULL AND archived_at < strftime('%s','now','-90 days');
```

- 清表前生成 SQL 备份到 `/var/lib/spartan/backups/`

---

## 12. 兼容性矩阵

| 客户端版本 | 服务端 schema 版本 | 说明 |
|---|---|---|
| v0.1.0 (原型) | — | 客户端走 `localStorage`；服务端 API 不启用 |
| v0.2.0 (登录+费用后端化) | v1.0 | 新增 `expense_items` + `expense_splits` 分摊模型；`expenses` 表废弃 |

每次 `js/data.js` 字段调整，先升 schema 再升 API 再升前端，避免数据迁移断档。

---

## 13. 完整 DDL 脚本

把 §3 与 §5 合并成单一 `server/scripts/init.sql`，由 `npm run db:init` 触发：

```bash
# server/package.json
{
  "scripts": {
    "db:init": "node scripts/init.js",
    "db:seed": "node scripts/seed.js",
    "start": "node index.js"
  }
}
```

`scripts/init.js` 用 `better-sqlite3` 读取 `init.sql`，启用 WAL 后逐条 `exec()`，所有 `CREATE TABLE IF NOT EXISTS` 幂等。

---

## 14. 演进要点

1. 当团队规模扩大、需要多人协作时，迁移到 PostgreSQL：
   - `INTEGER` → `BIGINT`
   - `TEXT` → `TEXT`（一致）
   - `strftime('%s','now')` → `EXTRACT(EPOCH FROM NOW())::BIGINT`
2. 增加 `wechat_openid` 字段，登录走微信扫码
3. 增加 `event_id` 字段以支持多赛事（数据库 schema v0.2）

具体演进时间在 `docs/ARCHITECTURE.md` §14 演进路线 给出。

