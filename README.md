# Spartan Hub · Super Beast 2026

部署域名：**`https://spartanultra.allenboard.cn/`**

斯巴达勇士超级野兽赛（崇礼云顶站）6 人团队的轻量团队管理网页原型。

## 功能特性

- **公共内容**：赛事概览、行程预览、物资管理、比赛攻略、实时天气、赛道高清图下载
- **账号登录（演示模式）**：账号名 + localStorage，无需密码
- **个人工作台**：登录后查看个人费用、装备进度、个人任务
- **比赛卡片**：
  - 49.6 km / 38 障碍 × 2 圈 / 8 个水站 / 9 个补给点 / 5 个关门点
  - 第二圈涉水 4 项（#17 #18 #20 #23）免挑战
  - 08:15 出发，关门时间 14:15 / 15:45 / 18:15 / 19:30 / 21:15
- **实时天气**：Open-Meteo（无需 API key），缓存 30 分钟
- **响应式**：手机 / 桌面均适配

## 目录结构

```
spartan-hub/
├── index.html
├── css/main.css
├── js/
│   ├── data.js       # 全部原型数据（赛事、用户、费用、障碍、关门点）
│   ├── summary.js    # 费用 / 物资汇总工具
│   ├── weather.js    # Open-Meteo 实时天气
│   └── app.js        # 路由与渲染
└── assets/           # 官方图片、海报、赛道高清图等
```

## 本地运行

由于使用了 `localStorage` 等 Web API，建议通过 HTTP 服务器访问，避免 `file://` 模式下浏览器限制：

```bash
cd J:/kimi-test/spartan-hub
python -m http.server 8000
# 或者
npx http-server . -p 8000
```

然后浏览器访问 `http://localhost:8000`。

## 演示账号

```
member01  张一
member02  陈二
member03  王三
member04  李四
member05  赵五
member06  孙六
admin     管理员
```

只输入账号名即可进入个人工作台，不构成真实安全认证。

## 已知限制

- 不存储任何持久化数据，使用浏览器 `localStorage`
- 障碍 1–38 已对齐高清图，剩余编号（39–72）暂未单独列项，因两圈实际复用 1–38
- 实时天气依赖外网；Open-Meteo 在国内偶有不稳
- 仅作为团队内部流程验证工具

## 日常推送脚本

仓库根目录下的 `push.sh` 是一键推送到 `https://github.com/zrx418567095/Spartan2026` 的封装脚本。
脚本会隔离 `HOME` 与全局 gitconfig，强制走 `127.0.0.1:7890` 代理，并通过 `http.<url>.extraHeader` 注入 GitHub Token，**避免把 token 写入任何本地配置**。

```bash
cd "J:/kimi-test/spartan-hub"
bash ./push.sh                 # 推送 main
bash ./push.sh --tags          # 同时推送所有 tag
bash ./push.sh --force-with-lease  # 任意 git push 参数都可透传
```

参数可通过环境变量覆盖（也可以直接编辑脚本顶部）：

| 变量 | 用途 | 默认值 |
|---|---|---|
| `SPARTAN_TOKEN` | GitHub PAT（必填） | 脚本内置默认值 |
| `SPARTAN_USER`   | GitHub 用户名 | `zrx418567095` |
| `SPARTAN_REMOTE` | 远端 URL | `https://github.com/zrx418567095/Spartan2026.git` |
| `SPARTAN_PROXY`  | HTTP 代理 | `http://127.0.0.1:7890` |

例如：

```bash
SPARTAN_TOKEN=ghp_xxx... bash ./push.sh --tags
```

### 为什么需要这种脚本？

本机全局 gitconfig 同时设置了 `http.proxy=127.0.0.1:7890`（工作中可用）与 `remote.origin.proxy=127.0.0.1:2802`（已废弃），且直连 443 被防火墙拦截，`push.sh` 通过：

1. 隔离 `HOME=/tmp/empty-home` 绕过全局 `.gitconfig` 的失效 proxy 转发；
2. 显式 `-c http.proxy=7890` 走工作中的代理；
3. 通过 `git -c http.https://github.com.extraHeader=Authorization: Basic <token>` 注入凭证，不写盘；
4. `GIT_TERMINAL_PROMPT=0` 防止任何 TTY 询问导致脚本卡住。



## 数据源

- 障碍与赛道图：官方公众号文章（`https://mp.weixin.qq.com/s/I_OLuaRZYkg9CCd2RkdIaQ`）附图
- 补给站与关门时间：官方赛事图
- 天气：[Open-Meteo](https://open-meteo.com/)

## 关联文档

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) —— 总体架构、部署、运维
- [`docs/MEMBERS_AND_AUTH.md`](./docs/MEMBERS_AND_AUTH.md) —— 成员、登录、权限矩阵
- [`docs/db-schema.md`](./docs/db-schema.md) —— SQLite DDL、ER、字段映射
