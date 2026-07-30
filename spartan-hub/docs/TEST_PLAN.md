# 系统全面测试计划 · v0.2

> 基于第一轮打包后用户实测发现的 12 个 bug 经验
> 涵盖：功能完整性 + CRUD 持久化 + UI/UX + 移动端专项 + 数据一致性
> 测试时间：2026-07-30

---

## 一、测试方法论

第一轮发现的 bug 暴露了以下系统性问题，特此设计针对性测试：

| 发现的问题类别 | 占比 | 测试策略 |
|----------------|------|---------|
| 数据联动（前端↔后端↔DB） | ~30% | 每个 CRUD 都验证三端一致性 |
| 移动端兼容（响应式/堆叠/触控） | ~50% | 强制覆盖 viewport 切换测试 |
| UI/UX（点击/滚动/导航） | ~20% | 用户路径全流程手动走查 |

**测试分级**：
- **A 级（自动）**：Node 模拟、grep、语法检查
- **B 级（半自动）**：API 端到端（curl + 启动本地服务）
- **C 级（人工）**：浏览器/移动设备手动验证

---

## 二、需求测试矩阵（对照 PRD）

### 2.1 公开信息（无需登录）

| ID | 功能点 | PRD § | 自动化 | 状态 |
|----|--------|-------|--------|------|
| FN-01 | 首页 Hero（赛事信息） | 4.1.1 | A | ✅ |
| FN-02 | 公告列表（首页） | 4.1.1 | A | ✅ |
| FN-03 | 公告点击查看详情 | 4.1.1 | A | ✅ |
| FN-04 | 行程预览 | 4.1.2 | A | ✅ |
| FN-05 | 障碍一览 | 4.1.3 | A | ✅ |
| FN-06 | 水站/补给站 | 4.1.4 | A | ✅ |
| FN-07 | 比赛攻略 | 4.1.5 | A | ✅ |
| FN-08 | 实时天气 | 4.1.5 | A | ✅ |
| FN-09 | 能量补给展示 | - | A | ✅（v0.2 新增） |
| FN-10 | 登录入口可访问 | 4.2.1 | A | ✅ |

### 2.2 成员功能（需登录）

| ID | 功能点 | PRD § | 自动化 | 状态 |
|----|--------|-------|--------|------|
| FN-11 | 登录（拼音全拼） | 4.2.1 | A | ✅ |
| FN-12 | Dashboard 概览 | 4.2.2 | A | ✅ |
| FN-13 | 我的费用清单 | 4.2.3 | A | ✅ |
| FN-14 | 标记已付 | 4.2.3 | A | ✅ |
| FN-15 | 个人物资二态切换 | 4.2.4 | A | ✅ |
| FN-16 | 个人任务勾选 | 4.2.2 | A | ✅ |

### 2.3 管理员功能（admin 角色）

| ID | 功能点 | PRD § | 自动化 | 状态 |
|----|--------|-------|--------|------|
| FN-17 | 管理后台首页 | 4.3 | A | ✅ |
| FN-18 | 公告管理（增/改/删） | 4.3.1 | A | ✅ |
| FN-19 | 成员管理（增/改/删） | 4.3.2 | A | ✅ |
| FN-20 | 费用管理（增/改/删/分摊） | 4.3.3 | A | ✅ |
| FN-21 | 费用详情查看 | 4.3.3 | A | ✅ |
| FN-22 | 费用汇总 CSV 导出 | 4.3.3 | A | ✅ |

---

## 三、CRUD 持久化测试（核心）

### 3.1 三端一致性

每个 CRUD 操作都必须验证：**前端操作 → 后端 API → SQLite DB → 跨刷新保留**

| 操作 | 前端代码 | 后端 API | DB 表 | 测试 |
|------|---------|---------|-------|------|
| 公告新增 | `openAnnModal` save | `POST /announcements` | `announcements` | A+B |
| 公告编辑 | `openAnnModal` save(edit) | `PATCH /announcements/:id` | `announcements` | A+B |
| 公告删除 | `bindAdminAnnouncements` | `DELETE /announcements/:id` | `announcements.archived_at` | A+B |
| 费用大项新增 | `openItemModal` save | `POST /expense-items` | `expense_items` | A+B |
| 费用大项编辑 | `openItemModal` save(edit) | `PATCH /expense-items/:id` | `expense_items` | A+B |
| 费用大项删除 | `bindAdminExpense` | `DELETE /expense-items/:id` | `expense_items.archived_at` | A+B |
| 分摊写入 | `openItemModal` save | `POST /expense-items/:id/splits` | `expense_splits` | A+B |
| 标记已付 | `bindMarkPaid` / `markSplitPaid` | `POST /splits/:id/mark-paid` | `expense_splits.paid_status` | A+B |
| 任务勾选 | `bindTasks` | `PATCH /tasks/:id` | `tasks.done` | A+B |
| 物资切换 | `bindGearClicks` | `PUT /members/:id/gear` | `gear_status.status` | A+B |
| 成员新增 | `openMemberModal` save | `POST /members` | `members` | A+B |
| 成员编辑 | `openMemberModal` save(edit) | `PATCH /members/:id` | `members` | A+B |
| 成员删除 | `bindAdminMembers` | `DELETE /members/:id` | `members.archived_at` | A+B |

**13 项 CRUD × 3 层一致性 = 39 个验证点**

### 3.2 Fallback 测试

| 场景 | 预期行为 |
|------|---------|
| 后端服务未启动 | 前端 fallback 到 localStorage，UI 正常 |
| API 500 | console.warn，不报错到用户 |
| 网络断开 | 同上 |
| localStorage 满（5MB+） | try/catch 不阻塞 UI |

---

## 四、UI/UX 可用性测试

### 4.1 链接/按钮可点击性

| ID | 元素 | 验证 |
|----|------|------|
| UX-01 | nav 链接 | 点击切换视图 + 滚动到顶 |
| UX-02 | 首页公告列表项 | 点击弹窗查看详情 |
| UX-03 | 费用大项表格行 | 点击弹窗查看详情 |
| UX-04 | 公告管理列表项 | 点击查看详情 / 行内编辑 |
| UX-05 | 物资卡片 | 点击切换状态 |
| UX-06 | 任务勾选框 | 点击切换完成状态 |
| UX-07 | 标记已付按钮 | 提交并刷新 |
| UX-08 | "新增"按钮 | 弹出表单 |
| UX-09 | "删除"按钮 | 二次确认 |
| UX-10 | 模态框遮罩点击 | 关闭弹窗 |
| UX-11 | 模态框 Esc 键 | 关闭弹窗 |

### 4.2 滚动行为

| ID | 场景 | 验证 |
|----|------|------|
| SC-01 | 首页整页滚动 | 流畅，sticky nav 不抖动 |
| SC-02 | 其他视图整页滚动 | 流畅（与 SC-01 一致） |
| SC-03 | 菜单打开时 body 滚动 | 禁止（避免背景穿透） |
| SC-04 | 菜单关闭后 body 滚动 | 恢复（无残留 overflow:hidden） |
| SC-05 | 跳转页面后 body 滚动 | 恢复（closeMobileNav 清理） |
| SC-06 | 长表格滚动 | 横向不溢出 |

### 4.3 导航正确性

| ID | 场景 | 验证 |
|----|------|------|
| NV-01 | nav 当前视图高亮 | active class 正确 |
| NV-02 | 未登录看不到"我的" | hideWhenGuest 生效 |
| NV-03 | 已登录看不到"登录" | hideWhenAuth 生效 |
| NV-04 | 普通成员看不到"公告/费用/成员" | adminOnly 生效 |
| NV-05 | 管理员从 dashboard 进"管理后台" | 路径可用 |
| NV-06 | 退出登录后回到首页 | 视图重置 |

---

## 五、移动端专项测试（v0.2 重点）

### 5.1 响应式断点

| 视口 | 验证项 |
|------|--------|
| ≤ 720px | 汉堡菜单出现、链接垂直排列、统计网格单列 |
| ≤ 900px | grid-3/grid-4 变 2 列 |
| 平板（768-1024px） | 布局合理，无横向滚动 |

### 5.2 触控交互

| ID | 场景 | 验证 |
|----|------|------|
| TC-01 | 点击汉堡按钮 | 菜单打开，按钮图标旋转 |
| TC-02 | 点击菜单内链接 | 关闭菜单 + 切换视图 |
| TC-03 | 点击菜单内关闭按钮 | 关闭菜单 |
| TC-04 | 点击菜单外区域 | 关闭菜单 |
| TC-05 | 按 Esc | 关闭菜单 |
| TC-06 | 菜单打开时滚动 | body 不能滚 |
| TC-07 | 菜单关闭后滚动 | 流畅 |
| TC-08 | 跳转后滚动 | 流畅（无残留 overflow:hidden） |
| TC-09 | 滚动后点 nav | 响应正常 |
| TC-10 | 滚动后点 nav 内链接 | 响应正常 |
| TC-11 | 模态框内点击 | 不会触发 nav 误操作 |
| TC-12 | 长时间页面打开 | 无内存泄漏（菜单 DOM 干净） |

### 5.3 stacking context 检查

| 元素 | z-index | 验证 |
|------|---------|------|
| top-bar | 1000 | 在最顶层（小型固定条） |
| nav | 998 | 中间层 |
| nav-mobile | 2000 | 菜单打开时盖所有元素 |
| 模态框 | - | 默认 absolute |

**关键点**：nav-mobile 必须是 `<body>` 直接子元素，**不能**嵌套在 `.nav` 内（否则会被 nav 的 stacking context 困住）

### 5.4 backdrop-filter 兼容性

- 桌面端：保留 `backdrop-filter: blur(6px)` 视觉模糊
- 移动端：必须关闭（`backdrop-filter: none`），否则滚动后 nav 不可点击

---

## 六、数据一致性测试

### 6.1 单设备多标签页

| 场景 | 验证 |
|------|------|
| A 标签页修改成员 → B 标签页刷新 | B 看到新成员（来自 SQLite） |
| A 标签页标记已付 → B 标签页刷新 | B 看到已付 |
| A 标签页物资切换 → B 标签页刷新 | B 看到新状态 |

### 6.2 多设备

- A 设备操作 → B 设备刷新 → 一致

### 6.3 数据恢复

| 场景 | 验证 |
|------|------|
| 刷新页面（F5） | 用户登录态保留、数据从 DB 恢复 |
| 关闭浏览器再开 | 同上 |
| localStorage 被清空 | 从 DB 恢复（如果 API 可用） |
| DB 被清空 | 从 seed.js 重新初始化 |

---

## 七、性能 / 安全测试（基础）

| ID | 项 | 验证 |
|----|-----|------|
| PERF-01 | 首页加载时间 | < 2s |
| PERF-02 | API 响应时间 | < 200ms |
| PERF-03 | 公告/费用详情弹窗渲染 | < 100ms |
| SEC-01 | admin 路由需 requireAdmin | 401/403 |
| SEC-02 | JWT_SECRET 必须配置 | 否则服务拒绝启动 |
| SEC-03 | SQL 注入 | 全部用 prepared statements |
| SEC-04 | XSS | 公告/费用内容用 textContent（无 innerHTML 拼接） |

---

## 八、可达性（A11y）基础测试

| ID | 项 | 验证 |
|----|-----|------|
| A11Y-01 | 按钮 aria-label | 菜单按钮含 `aria-label="菜单"` |
| A11Y-02 | aria-expanded | 汉堡按钮状态同步 |
| A11Y-03 | aria-hidden | 关闭菜单时 nav-mobile hidden |
| A11Y-04 | 键盘 Tab 焦点 | 所有交互元素可达 |
| A11Y-05 | 键盘 Enter/Space | 卡片/按钮可触发 |
| A11Y-06 | focus outline | 自定义 outline 可见 |

---

## 九、测试执行流程

```
1. 静态扫描（grep / lint）         — A 级
2. Node 逻辑模拟                  — A 级
3. 启动服务 + curl API            — B 级
4. 浏览器手动测试                  — C 级（人工）
5. 移动设备手动测试                — C 级（人工）
6. 编写报告 docs/TEST_REPORT.md
```

---

## 十、回归策略

每次新功能/修复后，至少跑：
- TC-03（核心 CRUD）
- SC-01~SC-08（滚动）
- NV-01~NV-06（导航）
- TC-01~TC-12（移动端）

新增功能必须扩展本测试矩阵。