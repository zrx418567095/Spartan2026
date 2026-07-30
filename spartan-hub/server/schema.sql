-- ============================================================
-- SpartanUltra schema (node:sqlite / SQLite 3.40+)
-- 所有金额用 INTEGER (cents), 时间戳用 INTEGER (UTC 秒)
-- 详见 docs/db-schema.md
-- ============================================================

PRAGMA foreign_keys = OFF;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;

-- ============================================================
-- members：成员 / 管理员
-- ============================================================
CREATE TABLE IF NOT EXISTS members (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE,
  display     TEXT NOT NULL,
  group_name  TEXT,
  role        TEXT NOT NULL CHECK (role IN ('member', 'admin')),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  archived_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_members_username ON members(username);
CREATE INDEX IF NOT EXISTS idx_members_archived  ON members(archived_at);

-- ============================================================
-- sessions：JWT 撤销表（jti 维度）
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  jti        TEXT PRIMARY KEY,
  member_id  TEXT NOT NULL,
  issued_at  INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  ip         TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_member   ON sessions(member_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires  ON sessions(expires_at);

-- ============================================================
-- expense_items：大项
-- ============================================================
CREATE TABLE IF NOT EXISTS expense_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  category      TEXT NOT NULL
                CHECK (category IN ('交通', '住宿', '餐饮', '赛事', '装备', '其他')),
  amount_cents  INTEGER NOT NULL CHECK (amount_cents >= 0),
  status        INTEGER NOT NULL DEFAULT 1
                CHECK (status IN (1, 2, 3)),
  paid_at       INTEGER,
  note          TEXT,
  created_by    TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  archived_at   INTEGER
);

CREATE INDEX IF NOT EXISTS idx_expense_items_status    ON expense_items(status) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expense_items_category  ON expense_items(category) WHERE archived_at IS NULL;

-- ============================================================
-- expense_splits：分摊
-- ============================================================
CREATE TABLE IF NOT EXISTS expense_splits (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_item_id INTEGER NOT NULL,
  member_id       TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL CHECK (amount_cents >= 0),
  paid_status     INTEGER NOT NULL DEFAULT 0
                  CHECK (paid_status IN (0, 1)),
  paid_at         INTEGER,
  note            TEXT,
  created_by      TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  archived_at     INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_splits_uniq
  ON expense_splits(expense_item_id, member_id)
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expense_splits_member   ON expense_splits(member_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expense_splits_paid     ON expense_splits(paid_status) WHERE archived_at IS NULL;

-- ============================================================
-- gear_status：个人装备状态
-- ============================================================
CREATE TABLE IF NOT EXISTS gear_status (
  member_id    TEXT NOT NULL,
  item_name    TEXT NOT NULL,
  level        TEXT NOT NULL CHECK (level IN ('mandatory', 'recommended', 'optional')),
  status       INTEGER NOT NULL DEFAULT 0
               CHECK (status IN (0, 1, 2, 3)),
  note         TEXT,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (member_id, item_name)
);

CREATE INDEX IF NOT EXISTS idx_gear_member_level ON gear_status(member_id, level);

-- ============================================================
-- tasks：个人任务
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id   TEXT NOT NULL,
  title       TEXT NOT NULL,
  note        TEXT,
  done        INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  due_at      INTEGER,
  created_by  TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  archived_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tasks_member_done ON tasks(member_id, done) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_due         ON tasks(due_at) WHERE archived_at IS NULL;

-- ============================================================
-- announcements：公告
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT NOT NULL,
  body             TEXT NOT NULL DEFAULT '',
  priority         TEXT NOT NULL DEFAULT 'mid'
                    CHECK (priority IN ('high', 'mid', 'low')),
  scope            TEXT NOT NULL DEFAULT 'public'
                    CHECK (scope IN ('public', 'member', 'admin')),
  target_member_id TEXT,
  pinned           INTEGER NOT NULL DEFAULT 0,
  publish_at       INTEGER NOT NULL,
  expires_at       INTEGER,
  created_by       TEXT NOT NULL,
  archived_at      INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ann_pub  ON announcements(publish_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ann_scope ON announcements(scope, target_member_id);
CREATE INDEX IF NOT EXISTS idx_ann_pinned ON announcements(pinned, publish_at) WHERE archived_at IS NULL;

-- ============================================================
-- audit_log：所有写操作留痕
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id    TEXT NOT NULL,
  action      TEXT NOT NULL,
  target      TEXT NOT NULL,
  before      TEXT,
  after       TEXT,
  ip          TEXT,
  ua          TEXT,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_log(target);
CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_log(actor_id, created_at);