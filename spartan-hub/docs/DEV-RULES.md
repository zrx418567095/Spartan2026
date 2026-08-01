# 开发环境规则 · v0.3.4+

> 制定时间：2026-08-01
> 触发事件：用户在测试期间积累了真实数据，但 kimi-code 多次修 bug 时直接 `rm -f spartan.db` 重置数据库，导致用户数据**全部丢失**。这是严重失误，本文档明确禁止此类操作。

## 核心原则

**用户的数据库数据是神圣的，除非用户明确要求，否则不得重置、不得清空、不得覆盖。**

---

## ❌ 禁止行为

1. **不得擅自重置数据库**：
   ```bash
   rm -f data/spartan.db          # 绝对禁止
   rm -f data/spartan.db-wal      # 绝对禁止
   rm -f data/spartan.db-shm      # 绝对禁止
   npm run db:reset               # 必须先问用户
   bash start.sh reset --force    # 必须先问用户
   ```

2. **不得擅自修改测试数据**：
   - 不得用 `UPDATE expense_splits SET ...` 清理"测试"数据
   - 不得 `DELETE FROM ...` 任何表
   - 不得"为了方便测试"而调整用户数据

3. **不得擅自用 `data/.initialized` 触发 reset**：
   ```bash
   rm -f data/.initialized  # 这会触发 ensure_db 重新 init + seed
   ```

4. **不得用 reset 来"快速验证修复"**：
   - reset 是**破坏性**的
   - 即使为了"清理状态"也不行
   - 改用：smoke 测试 / 浏览器手动 / 模拟数据

## ✅ 推荐做法

### 1. 修 bug 时验证数据流

用 `scripts/debug-dashboard.mjs`（v0.3.2 引入）或类似模拟脚本：
```bash
# Node 模拟前端完整流程（不动 db）
node scripts/debug-dashboard.mjs
```

### 2. 验证后端 API

用 curl + 现有数据，不要 reset：
```bash
# 用现有 token 测 API
TOKEN=$(grep "set-cookie" /tmp/h.txt | ...)
curl -H "Cookie: sp_token=$TOKEN" http://127.0.0.1:3000/api/v1/members/m2/summary
```

### 3. 想"重置"时先备份

如果确实需要 reset（比如 schema 变更），**先备份**：
```bash
# 1. 备份当前 db
bash scripts/restore.sh backup
# 输出：data/backup/spartan.db.YYYY-MM-DD_HH-mm-ss.bak

# 2. 然后才 reset
npm run db:reset -- --force
# 输入 DELETE 确认

# 3. 如需恢复
bash scripts/restore.sh list
bash scripts/restore.sh restore <timestamp>
```

### 4. 调试时用临时测试数据

不要改真实数据，而是**新建测试用户**：
```sql
INSERT INTO members (id, username, display, group_name, role, created_at, updated_at)
VALUES ('test-debug', 'testdebug', '测试用户', '测试组', 'member', strftime('%s','now'), strftime('%s','now'));
```

---

## 自动化防护（v0.3.4+）

### 1. `reset.js` 强制自动备份

每次 `npm run db:reset` 前**自动备份**到：
```
data/backup/spartan.db.YYYY-MM-DD_HH-mm-ss.bak
```

如果备份失败（IO 错误），等待 3 秒让用户决定是否继续。

### 2. `restore.sh` 备份管理工具

```bash
bash scripts/restore.sh backup       # 立即备份
bash scripts/restore.sh list         # 列出所有备份（按时间倒序）
bash scripts/restore.sh restore <ts> # 恢复（ts 支持部分匹配）
bash scripts/restore.sh clean 5      # 只保留最近 5 个备份
```

### 3. 默认保留 10 个备份

`data/backup/` 目录自动保留最近 10 个备份，更早的自动清理（`clean 10`）。

---

## 用户数据丢失后的恢复流程

如果**已经发生数据丢失**（无论原因）：

1. **不要慌** — 检查 `data/backup/` 目录是否有备份
2. 用 `bash scripts/restore.sh list` 看最近备份时间
3. 最近的备份可能不是最新的，但比"完全干净"好
4. 如果连备份都没有：与用户沟通，确认是否需要从生产服务器拉一份

---

## 何时**应该** reset db？

只有以下场景：

| 场景 | 原因 | 流程 |
|------|------|------|
| 首次部署到新服务器 | db 不存在 | ensure_db 自动 init + seed |
| schema 变更（DDL） | 必须重建表结构 | 备份 → reset → 验证 |
| 重大版本升级（v0.x → v1.0） | 兼容性问题 | 备份 → reset → 数据迁移脚本 |
| 损坏恢复 | db 文件 corrupt | 备份 → 评估 → reset 或恢复 |

**绝不**用于：
- "清理状态"重测
- "快速验证修复"
- "测试新代码"
- "看着乱就 reset"

---

## 责任承诺

> kimi-code 承诺：除非用户明确说"重置数据库"或"清空数据"，**绝不**调用任何 reset / delete / 覆盖真实数据 的命令。
>
> 任何"为了测试方便"的数据操作都应**询问用户**或**用临时数据**（如新建 test- 前缀的成员）。

---

## 相关文件

- `server/scripts/reset.js`：v0.3.4+ 强制自动备份
- `server/scripts/restore.sh`：备份管理工具（v0.3.4 新增）
- `docs/TEST_PLAN.md`：smoke 测试计划
- `docs/TEST_REPORT.md`：测试报告
- `docs/CHANGELOG.md`：v0.3.4 变更记录