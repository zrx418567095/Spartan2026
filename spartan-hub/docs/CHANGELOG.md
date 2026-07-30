# 变更日志

> 自第一次打包部署（提交 `29223b8`）之后的所有改动
> 部署版本对照：`v0.1.x` → `v0.2.x`

---

## v0.2 · 2026-07-30 · 第一次打包后增量

### 功能特性（5 项）

#### 1. 三 Bug 一并修复（`0087785`）

| Bug | 修复 |
|-----|------|
| 手机端导航按钮 | `bindNavToggle` 增加 stopPropagation、外部点击关闭、图标切换 |
| 登录入口引导 | nav 上"登录"直接 `scrollIntoView` 到 #login，hero 加 CTA 按钮 |
| 成员管理数据重置 | `persistData()` 增加保存 users；后端新增 `POST/PATCH/DELETE /members[/:id]` |

#### 2. 公告/费用详情可点击 + 全量 CRUD 后端化（`8ccbcf0`）

- 公告列表项可点击 → 弹窗显示完整正文
- 费用大项表格行可点击 → 详情弹窗（含分摊明细 + 标记已付）
- 所有 CRUD 操作调用后端 API，失败时 fallback 到 localStorage
- 新增样式：`.announce-clickable / .ann-detail-* / .item-detail-*`

#### 3. 移除 nav 中"管理后台"（`7ff2ecf`）

- 解决管理员点击"管理后台"无响应的 bug
- 入口迁移到"我的 → 管理员操作"的第一张卡片（紫色高亮）

#### 4. 个人物资二态切换（`ade8ff6`）

- 由三态循环（0→1→2→0）改为二态切换（未确认 ↔ 已确认）
- 已确认状态：绿色边框 + 勾选图标 + 弹出动画
- 持久化：`PUT /api/v1/members/:id/gear` + localStorage fallback

#### 5. 物资管理页增加能量补给模块（`47c7e61`）

新增 `SPARTAN_HUB.nutrition` 数组，含 3 种补给品：

| 补给品 | 数量 | 关键参数 | 节奏 |
|--------|------|---------|------|
| 迈胜黑胶 | 8 条 | 碳水 40g/条 | 双数钟吃一条 |
| SIS 等渗水果胶 | 15 条 | 碳水 20g/条 | 单数钟吃 1-2 条 |
| 迈胜电解质浓缩液 | 10 条 | 电解质 800mg/条 | 1.5 小时一条 |

实物图存于 `assets/`，每张卡片含图片 + 数量徽章 + 双数据块 + 说明。

### 移动端 Bug 修复（6 项）

| Bug | 修复提交 | 关键改动 |
|-----|---------|---------|
| 手机菜单黑屏 | `ad82875` | nav-mobile 加关闭按钮 + Esc 关闭 |
| 菜单 stacking context 残缺 | `7709c6f` | nav-mobile 移到 body 直接子元素 |
| 汉堡按钮"两个叉" | `10f7daa` | 改用单图标 + class toggle |
| 菜单打开后不能滚动 | `0587c16` | 用 `.no-scroll` class 而非 inline style |
| 跳转其他页不能滚动 | `cc620d1` | `closeMobileNav` 清理 no-scroll |
| 滚动后 nav 不能点击 | `46c7cb3` | 移动端关闭 `backdrop-filter` |

### 数据调整（1 项）

装备级别调整（`be2a865`）：

| 装备 | 调整 |
|------|------|
| 防水冲锋衣 | 可选 → 强制 |
| 手机防水袋 | 可选 → 强制 |
| 盐丸 × 10 | 建议 → 可选 |
| 对讲机 | 新增（建议） |

合计：**强制 8 / 建议 8 / 可选 6 / 总计 22 项**

---

## 关于 `gear_status.status` 二态化的 DB 处理（决策记录）

### 现状
- 前端 UI/逻辑：二态 `0 ↔ 1`（`ade8ff6` 提交）
- DB schema：`status INTEGER CHECK (status IN (0, 1, 2, 3))`
- 后端 API：接受任意数字写入（仅做 `Number(it.status) || 0`）

### 决策：保持 schema 不变

**原因**：
1. **零风险**：原 CHECK 包含 0/1，向后兼容，不需要 ALTER
2. **可扩展**：将来想恢复多态（待购买/已装包），schema 不需要再次变更
3. **数据无损**：0/1 现有数据继续工作

**影响**：
- 现有 SQLite 数据库：**零迁移**
- 新建数据库：使用当前 `schema.sql`，CHECK 仍接受 0/1/2/3
- 前端永远只产生 0/1，2/3 路径已废弃但 CHECK 不删

**为什么不在 schema 同步收紧为 `(0, 1)`？**
- 收紧后现有数据无需迁移（本来就是 0/1），但需要 `ALTER TABLE` 重写 CHECK（SQLite 实现限制较多）
- 收益小、风险非零
- schema 是"合法值集合"，不是"已用值集合"——保留扩展空间更合理

### 文档同步

- `db-schema.md` 字典表已更新：`status 0 = 未确认 / 1 = 已确认`（之前的 2/3 字典行已删除）
- 前端 `Summary.gearStatusLabel` 现在只对 0/1 有定义，其他值 fallback 到 `'未确认'`

---

## 同步更新的文档

| 文档 | 主要变更 |
|------|---------|
| `docs/ARCHITECTURE.md` | 补全 API 路由表（members 增 POST/PATCH/DELETE；announcements 整组；tasks 增 POST/DELETE；gear 状态说明改为二态） |
| `docs/MEMBERS_AND_AUTH.md` | §8 新增/编辑/删除成员的流程更新（含 API 路径与软删除） |
| `docs/db-schema.md` | `gear_status.status` 字典改为二态（0 未确认 / 1 已确认） |
| `docs/PRD.md` | §4.2.4 物资管理改为二态；§4.3.2 成员管理补充增删改 |
| `docs/test-cases.md` | 第六章新增 v0.2 增量测试用例（TC-09 ~ TC-19） |

---

## 不变的部分

- `docs/PRD.md` 主体（角色定义、功能模块总览）
- `docs/db-schema.md` 表结构（除 status 字典）
- `docs/MEMBERS_AND_AUTH.md` §1-7（鉴权、权限矩阵）
- `docs/DEPLOY.md`（部署文档不受前端改动影响）

---

## 部署影响

| 改动 | 部署动作 |
|------|---------|
| 前端 CSS/JS/HTML | `git pull` + 浏览器刷新即可 |
| 后端 routes/members.js 新增 CRUD | `git pull` + `systemctl restart spartan-hub` |
| 数据库 schema | **无需迁移**（仅文档字典更新，DB 结构不变） |

---

## 提交记录（v0.2）

```text
be2a865  fix: 调整装备级别分类
47c7e61  feat: 物资管理页增加能量补给模块
46c7cb3  fix: 修复滚动后手机端 nav 无法点击
cc620d1  fix: 修复跳转其他页面后手机不能滚动
0587c16  fix: 修复手机端无法滚动页面
10f7daa  fix: 修复手机端汉堡按钮'两个叉'的视图 bug
7709c6f  fix: 修复手机端菜单 stacking context 导致的菜单残缺
ad82875  fix: 修复手机端导航菜单黑屏看不见导航项
ade8ff6  feat: 个人物资改为二态切换（未确认/已确认）+ 持久化
7ff2ecf  fix: 去掉 nav 中无响应的'管理后台'项，迁移到 dashboard
8ccbcf0  feat: 公告/费用详情可点击查看 + 全部 CRUD 调用后端 API
0087785  fix: 修复 3 个 bug — 导航按钮 / 登录引导 / 成员数据重置
```

（`2564599` 修复硬编码成员列表、`d8850be` 完成成员管理增删改也属 v0.2 之前的打包前迭代，已包含在 v0.1 部署包里）