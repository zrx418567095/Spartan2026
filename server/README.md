# SpartanUltra 后端服务

> Node 22+ Express + 内置 `node:sqlite` (WAL) + JWT
> 接口文档：`docs/ARCHITECTURE.md`，数据模型：`docs/db-schema.md`

---

## 1. 启动

```bash
cd server
cp .env.example .env       # 编辑 JWT_SECRET（≥32 字节随机）
npm install                # 安装依赖（84 个包，~1s，无原生编译）
npm run db:init            # 应用 schema.sql，建表（幂等）
npm run db:seed            # 灌入 6 成员 + 1 管理员 + 4 大项 + 24 分摊
npm start                  # 启动监听 127.0.0.1:3000
```

可选脚本：

| 命令 | 说明 |
|---|---|
| `npm run dev` | `node --watch index.js`，文件改动自动重启 |
| `npm run db:reset` | 删除数据库文件并重建 + 重新 seed（开发用） |
| `npm run smoke` | 端到端 smoke test，需先 `npm start` 后另开终端执行 |

---

## 2. 环境变量

详见 `.env.example`。生产环境必须设置：

| 变量 | 说明 |
|---|---|
| `PORT` | 监听端口，默认 3000 |
| `HOST` | 默认 127.0.0.1（Nginx 反代前不暴露公网） |
| `JWT_SECRET` | ≥32 字节随机；生产用 `openssl rand -hex 32` 生成 |
| `SQLITE_PATH` | 数据文件路径，默认 `server/data/spartan.db` |
| `NODE_ENV` | `production` 时 cookie 自动加 `Secure` 标志 |
| `TRUSTED_PROXY` | Nginx 反代后必须 `true`，让 Express 读 X-Forwarded-* |
| `TOKEN_TTL_SECONDS` | JWT 过期秒数，默认 28800（8 小时） |

---

## 3. 目录结构

```
server/
├── index.js               # Express 入口
├── db.js                  # SQLite 连接 + withTransaction 工具
├── schema.sql             # 完整 DDL（与 docs/db-schema.md 对齐）
├── middleware/
│   └── auth.js            # JWT 签发/校验 + loadUser/requireAuth/requireAdmin
├── routes/
│   ├── auth.js            # POST /auth/login · /logout · GET /me
│   ├── public.js          # /public/event · course · cutoffs · aid-stations · obstacles · gear · announcements
│   ├── members.js         # /members · /members/:id/summary
│   ├── gear.js            # /members/:memberId/gear
│   ├── tasks.js           # /members/:memberId/tasks · /tasks/:taskId
│   ├── announcements.js   # /announcements (admin CRUD)
│   ├── expense-items.js   # /expense-items · /splits
│   └── weather.js         # /weather (open-meteo, 30min cache)
├── scripts/
│   ├── init.js            # 应用 schema.sql
│   ├── seed.js            # 灌入种子数据（幂等）
│   ├── reset.js           # 删表重建 + seed
│   └── smoke.js           # 端到端测试（39 项断言）
├── data/
│   └── spartan.db         # 运行时生成（gitignore）
└── README.md
```

---

## 4. 路由速查

> 完整版本（含字段说明）见 `docs/ARCHITECTURE.md` §3.2

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | `/healthz` | 否 | 健康检查 |
| POST | `/api/v1/auth/login` | 否 | 姓名全拼登录，返回 cookie |
| POST | `/api/v1/auth/logout` | 是 | 撤销 session |
| GET | `/api/v1/auth/me` | 是 | 当前登录成员 |
| GET | `/api/v1/public/event` | 否 | 赛事信息 |
| GET | `/api/v1/public/course` | 否 | 课程统计 |
| GET | `/api/v1/public/cutoffs` | 否 | 5 个关门点 |
| GET | `/api/v1/public/aid-stations` | 否 | 8 个水站 |
| GET | `/api/v1/public/obstacles` | 否 | 38 个障碍 |
| GET | `/api/v1/public/gear` | 否 | 公共装备清单 |
| GET | `/api/v1/public/gear` | 否 | 同上（兼容） |
| GET | `/api/v1/announcements` | 部分 | 公共/定向公告 |
| POST | `/api/v1/announcements` | admin | 发布 |
| PATCH | `/api/v1/announcements/:id` | admin | 修改/置顶 |
| DELETE | `/api/v1/announcements/:id` | admin | 删除 |
| GET | `/api/v1/members` | 是 | 6 名成员公开字段 |
| GET | `/api/v1/members/:id/summary` | 本人/admin | 个人分摊 + 汇总 |
| GET | `/api/v1/members/:memberId/gear` | 本人/admin | 个人装备状态 |
| PUT | `/api/v1/members/:memberId/gear` | 本人/admin | 整表覆盖 |
| GET | `/api/v1/members/:memberId/tasks` | 本人/admin | 任务列表 |
| POST | `/api/v1/members/:memberId/tasks` | 本人/admin | 创建任务 |
| PATCH | `/api/v1/tasks/:taskId` | 本人/admin | 完成/编辑 |
| DELETE | `/api/v1/tasks/:taskId` | 本人/admin | 删除任务 |
| GET | `/api/v1/expense-items` | admin | 大项列表 |
| POST | `/api/v1/expense-items` | admin | 新增大项 |
| PATCH | `/api/v1/expense-items/:id` | admin | 修改大项 |
| DELETE | `/api/v1/expense-items/:id` | admin | 软删除大项（含分摊） |
| GET | `/api/v1/expense-items/:id/splits` | admin | 大项下分摊 |
| POST | `/api/v1/expense-items/:id/splits` | admin | 批量写入分摊 |
| POST | `/api/v1/splits/:id/mark-paid` | 本人/admin | 标记已付 |
| DELETE | `/api/v1/splits/:id` | admin | 删除单条分摊 |
| GET | `/api/v1/splits/_/team-summary` | admin | 团队总览 |
| GET | `/api/v1/weather` | 否 | 实时天气（30 分钟缓存） |

---

## 5. 部署（Nginx + PM2）

详见 `docs/ARCHITECTURE.md` §5。这里给出最小可用片段。

```nginx
# /etc/nginx/sites-enabled/spartanultra.allenboard.cn
server {
  listen 443 ssl http2;
  server_name spartanultra.allenboard.cn;

  ssl_certificate     /etc/letsencrypt/live/.../fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/.../privkey.pem;

  # 静态前端
  root /var/www/spartan-hub;
  index index.html;
  location / { try_files $uri $uri/ /index.html; }

  # 后端 API
  location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Cookie            $http_cookie;
    proxy_pass_header Set-Cookie;
  }
}
```

PM2：

```bash
pm2 start server/index.js --name spartan-api -i 1
pm2 save
```

---

## 6. 本地开发小贴士

- `node:sqlite` 是 Node 22+ 实验特性，**不要使用 better-sqlite3**（需要 C++ 编译）
- 没有原生编译意味着 CI 友好：clone → `npm install` → `npm start`
- 调试：`NODE_ENV=development npm start`，日志直接打到 stdout
- 重置数据库：`npm run db:reset`

---

## 7. 已知限制

- 仅支持 Node 22+（依赖 `node:sqlite`）
- 没有 rate-limit 中间件（依赖 Nginx 层做限流）
- 没有审计日志写入（schema 预留，路由未实现）
- 文件上传未实现（公告目前不支持附件）