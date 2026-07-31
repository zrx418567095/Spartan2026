# 技术架构与部署手册

> Spartan Hub · Super Beast 2026
> **部署目标：腾讯云轻量应用服务器 2C2G，已具备**
> **域名：`spartanultra.allenboard.cn`，TLS 证书已具备**
> 文档版本：v0.2
> 适用代码版本：`v0.1.x`

本文对应**当前实情的部署形态**：

- **第一段**：纯静态前端（已部署）+ Node.js API + SQLite（本次新增）
- **第二段（可选）**：拆前后端、引入微信扫码登录

如果只是给 6 个人的小队用，第一段足够。

---

## 0. 现状清单（v0.2 已对齐）

| 项 | 当前值 |
|---|---|
| 服务器 | 腾讯云轻量 2C2G（已具备） |
| 系统 | Ubuntu 22.04 LTS |
| 域名 | `spartanultra.allenboard.cn` |
| 证书 | 已具备（用户提供，需确认证书部署形态） |
| 当前已部署 | 一个静态页（占位）。将被全量静态站 + API 替换 |
| DNS | 需在 DNS 服务商把 `spartanultra.allenboard.cn` 解析到服务器公网 IP |
| 数据库 | 计划用 SQLite，单文件 |
| 镜像入口 | `https://github.com/zrx418567095/Spartan2026` |

---

## 0.1 设计原则

| 原则 | 具体做法 |
|---|---|
| **零外部依赖** | 数据走自有 SQLite；天气走 Open-Meteo；不再接任何第三方鉴权服务 |
| **极简部署** | 一台 2C2G 轻量服务器即可；不需要 Docker；不需要 K8s |
| **静态优先** | 公共页面纯 HTML/CSS/JS；只在登录后调用 API |
| **管理员全权** | 一个 admin 账号可读 / 写任何成员的费用、装备、任务；不必借助多角色分层 |
| **成员限自己** | 成员只能读 / 写自己的记录；不能看见其他成员的支付明细 |
| **姓名全拼登录** | 账号名就是姓名全拼（小写），仅作"我能输入什么"的最小校验；服务端做存在性校验后签发 JWT |
| **可审计** | Git 单仓管理；`push.sh` 一键同步；不回写任何凭证 |
| **易于备份** | SQLite 单文件；按天 cron 备份 + 异地 |
| **后端是真源** | 所有业务数据（成员/公告/费用/任务/装备）以 SQLite 为唯一真源；前端只缓存登录态；写操作必须经 API，失败 alert 用户 |


---

## 1. 总体架构

```
                ┌─────────────────────────────┐
   浏览器 ───▶  │  Nginx (80/443 → 3000/8080)  │
                └──────────────┬───────────────┘
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
   ┌────────────────────┐           ┌────────────────────────┐
   │  静态前端 (8080)   │           │  Node.js API (3000)    │
   │  · index.html      │           │  · Express/Fastify     │
   │  · css/main.css    │           │  · REST/JSON           │
   │  · js/{app,data,   │  ──API──▶ │  · better-sqlite3       │
   │     summary,       │           │  · joi / zod 校验      │
   │     weather}.js    │           │  · JWT 签发与校验      │
   │  · assets/         │           │                        │
   └────────────────────┘           └──────────┬─────────────┘
                                                │
                                          SQLite 单文件
                                       /var/data/spartan.db
```

### 1.1 第一段：当前形态

- **前端**：纯静态 HTML/CSS/JS
  - `index.html` / `css/main.css` / `js/{app,data,summary,weather}.js`
  - 静态资源总大小约 1.5 MB（其中两张赛事图占大头）
- **后端**（本次新增，未在仓库中）
  - `server.js` —— Express + better-sqlite3
  - API 端点覆盖 `users / weather / expenses / gear / tasks`
- **数据**：SQLite 单文件，存储团队成员、费用、装备状态、任务

### 1.2 第二段：可选演进

- 拆前后端到不同子域（`/api` → 8080，`/` → 8081）
- SQLite 升级为 PostgreSQL（仍然可以单机跑 `pg_lite`）
- 增加微信扫码登录 / 短信验证码

---

## 2. 仓库布局

```
spartan-hub/
├── index.html
├── favicon.ico
├── css/main.css
├── js/                  # 现有前端
│   ├── app.js           # 全部渲染逻辑
│   ├── data.js          # 静态原型数据（仅 dev）
│   ├── summary.js
│   └── weather.js
├── assets/              # 赛事图片、海报、PDF 等
├── server/              # 后端代码（本次新增）
│   ├── index.js
│   ├── db.js
│   ├── routes/
│   ├── middleware/
│   ├── package.json
│   └── .env.example
├── docs/
│   └── ARCHITECTURE.md # 本文档
├── nginx/
│   └── spartan.conf     # Nginx 站点配置
├── deploy/
│   ├── setup.sh         # 首次部署脚本
│   ├── backup.sh        # 每日 SQLite 备份
│   └── systemd/         # Node 服务的 systemd unit
├── data/                # SQLite 文件 + 上传文件（不进 git）
├── push.sh              # GitHub 推送脚本
├── README.md
└── .gitignore
```

---

## 3. API 设计

### 3.1 通用约定

- 协议：`HTTPS`
- 域：`https://spartanultra.allenboard.cn`
- 路径前缀：`/api/v1`
- 数据格式：`application/json; charset=utf-8`
- 时区：返回 UTC 秒 + `Asia/Shanghai` 字符串
- 鉴权：除注册/登录与公开内容外，所有写操作要求 `Authorization: Bearer <token>`
- 速率限制：`20 r/s` 起步，`/api/v1/auth/login` 单独限 `5 r/m`
- CORS：`Access-Control-Allow-Origin: https://spartanultra.allenboard.cn`（不带尾 `/`）

### 3.2 路由清单（贴合"管理员全权 / 成员限己"）

| Method | Path | 说明 | 鉴权 | 备注 |
|---|---|---|---|---|
| GET | `/api/v1/public/itinerary` | 公共行程 | 否 | 静态返回 |
| GET | `/api/v1/public/course` | 公共赛道路况 | 否 | |
| GET | `/api/v1/public/aid-stations` | 8 个水站 + 9 个补给点 | 否 | |
| GET | `/api/v1/public/cutoffs` | 5 个关门时间表 | 否 | |
| GET | `/api/v1/public/event` | 赛事标题、副标等 | 否 | |
| GET | `/api/v1/weather` | 实时天气（Open-Meteo 缓存） | 否 | 30 分钟缓存 |
| POST | `/api/v1/auth/login` | 姓名全拼登录 | 否 | 单 IP `5/m` |
| POST | `/api/v1/auth/logout` | 撤销 session | 是 | |
| GET | `/api/v1/auth/me` | 当前登录成员 | 是 | |
| GET | `/api/v1/members` | 成员列表（仅公开字段） | 是 | 仅返回 `id / display / group / role` |
| POST | `/api/v1/members` | 新增成员 | **仅 admin** | 校验 `id` 与 `username` 唯一 |
| PATCH | `/api/v1/members/:id` | 编辑成员（姓名/组别/角色/登录名） | **仅 admin** | 登录名冲突时 409 |
| DELETE | `/api/v1/members/:id` | 软删除成员（保留分摊历史） | **仅 admin** | `a1` 不可删除 |
| GET | `/api/v1/members/:id/splits` | 个人分摊列表 + 汇总 | **本人或 admin** | |
| GET | `/api/v1/announcements` | 公告列表（公共/定向） | 部分 | 未登录仅看 public；登录看定向 |
| POST | `/api/v1/announcements` | 新增公告 | **仅 admin** | 支持 `scope / targetMemberId / pinned` |
| PATCH | `/api/v1/announcements/:id` | 编辑公告 | **仅 admin** | |
| DELETE | `/api/v1/announcements/:id` | 软删除公告 | **仅 admin** | |
| GET | `/api/v1/expense-items` | 大项列表（含未分配余额） | **仅 admin** | |
| POST | `/api/v1/expense-items` | 新增大项 | **仅 admin** | |
| PATCH | `/api/v1/expense-items/:id` | 修改大项（金额/状态/备注） | **仅 admin** | |
| DELETE | `/api/v1/expense-items/:id` | 软删除大项 | **仅 admin** | |
| GET | `/api/v1/expense-items/:id/splits` | 大项下全部分摊 | **仅 admin** | |
| POST | `/api/v1/expense-items/:id/splits` | 新增/批量分摊 | **仅 admin** | 支持均摊一键计算 |
| DELETE | `/api/v1/splits/:id` | 移除分摊 | **仅 admin** | |
| POST | `/api/v1/splits/:id/mark-paid` | 成员确认已付 + 管理员核销 | **本人或 admin** | |
| GET | `/api/v1/members/:id/gear` | 个人装备状态 | **本人或 admin** | |
| PUT | `/api/v1/members/:id/gear` | 整表覆盖个人装备状态 | **本人或 admin** | 二态 `0 / 1` |
| GET | `/api/v1/members/:id/tasks` | 个人任务 | **本人或 admin** | |
| POST | `/api/v1/members/:id/tasks` | 新增个人任务 | **本人或 admin** | |
| PATCH | `/api/v1/tasks/:id` | 完成 / 取消 | **本人或 admin** | |
| DELETE | `/api/v1/tasks/:id` | 删除任务 | **本人或 admin** | |
| GET | `/api/v1/expenses/summary` | 团队费用总览（总支出/各成员待付/已付） | **仅 admin** | 支持 CSV 导出 |
| GET | `/api/v1/gear/progress` | 团队装备就位率 | **仅 admin** | |
| GET | `/api/v1/admin/audit` | 审计日志 | **仅 admin** | |

权限矩阵参见 `MEMBERS_AND_AUTH.md` §3。

#### 3.2.1 写操作审计

所有成员 / 公告的写操作都通过 `db.auditLog(actorId, action, target, before, after, req)` 写入 `audit_log` 表。
GET `/api/v1/admin/audit` 供 admin 查最近 100 条记录。

action 命名约定：
- `member.create` / `member.update` / `member.archive`

### 3.3 数据模型（摘要）

详细 DDL 见 `db-schema.md`，关键表：

- `members` — 业务 ID + `username`（全拼）+ `display`（中文名）+ `role`
- `sessions` — JWT 撤销表
- `expense_items` — 大项（总金额、分摊主体），管理员录入
- `expense_splits` — 分摊（指定成员 + 金额），成员只读和确认已付
- `gear_status` — `(member_id, item_name)` 复合主键
- `tasks` — 个人任务
- `announcements` — 公共与定向公告
- `audit_log` — 全部写操作留痕

### 3.4 鉴权策略（v0.2）

第一阶段落地"姓名全拼 + 服务端存在性校验"模型：

- 客户端 POST `/api/v1/auth/login { username }`
- 服务端只接受满足正则的全小写拼音（`/^[a-z]+(\.[a-z]+)?$/`），同时查 `members.username`
- 命中后签发 HMAC-SHA256 JWT：
  - payload `{ member_id, role, jti, iat, exp }`
  - 8 小时过期
  - HttpOnly + SameSite=Strict Cookie
- 路由中间件 `requireAuth(role?)` 校验 JWT，挂到 `req.auth`
- 资源中间件 `requireSelfOrAdmin((req) => req.params.id)` 限制访问

签名密钥在 `server/.env` 的 `JWT_SECRET`（生产建议 64 字节随机，每次重启可轮换）。

> ⚠️ 本模型仍属"团队内部信任"：知道他人姓名全拼就能以对方身份登录。
> 候选加固（不在 v0.2 范围内）：
> - 服务端短信验证码
> - 微信扫码 + 后台白名单
> - 邀请码 + 全拼组合
> 后续按需新增 `auth_methods` 表，字段 `member_id / method / secret_hash / enabled`。


---

## 4. 文件大小与性能基线

```
index.html              2.1 KB
css/main.css            24.7 KB
js/app.js               27.9 KB
js/data.js              18.8 KB
js/summary.js           1.0 KB
js/weather.js           8.3 KB
assets/赛道高清图.jpg   347.8 KB
assets/水站以及补给站   762.9 KB
assets/关门时间详情     293.2 KB
其余 6 张 webp           ≤ 1.5 MB
```

- **总下载量**：约 2.5 MB（含所有图片，首次加载）
- **首屏关键资源**：HTML + CSS + JS + 主 Hero 图 ≈ 600 KB
- **后续图片懒加载**：`loading="lazy"` 已就绪

### 4.1 带宽估算

按 6 人 + 偶尔转发：

- 峰值同时在线 ≤ 10 人
- 平均每月 PV ≈ 1,000
- 流量 = 1,000 × 2 MB ≈ 2 GB
- 轻量服务器 5 Mbps 共享带宽足够

---

## 5. 服务器选型与配置

### 5.1 推荐规格

| 项 | 最小 | 推荐 |
|---|---|---|
| 实例 | 腾讯云轻量 2C2G | 腾讯云轻量 2C4G |
| 系统 | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| 磁盘 | 50 GB SSD | 50 GB SSD |
| 带宽 | 4 Mbps | 5 Mbps |
| 月费 | ~ ¥50 | ~ ¥70 |

预估内存占用（峰值）：

- Nginx ~30 MB
- Node.js PM2 集群 2 实例 × 80 MB = 160 MB
- SQLite + 系统 ≤ 200 MB
- 余量 ≈ 1.6 GB

### 5.2 关键软件版本

| 软件 | 版本 |
|---|---|
| Nginx | 1.18+ |
| Node.js | 20 LTS |
| SQLite | 3.40+ |
| PM2 | 5.x（可选） |
| acme.sh | 最新 |

---

## 6. 部署流程（`spartanultra.allenboard.cn`）

### 6.0 准备清单

| 项 | 值 |
|---|---|
| 服务商 | 腾讯云轻量 |
| 域名 | `spartanultra.allenboard.cn` |
| 解析 | A 记录 → 服务器公网 IP |
| 证书 | 你已具备；稍后配置在 §6.5 |
| 服务器用户 | `spartan`（标准账户，非 root） |
| 部署目录 | `/home/spartan/app/spartan-hub` |

### 6.1 服务器初始化

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx sqlite3 git curl
# 装 Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

### 6.2 创建用户并拉取代码

```bash
sudo useradd -m -s /bin/bash spartan
sudo mkdir -p /home/spartan/app
sudo chown -R spartan:spartan /home/spartan/app
sudo -u spartan git clone https://github.com/zrx418567095/Spartan2026.git /home/spartan/app/spartan-hub
cd /home/spartan/app/spartan-hub
sudo -u spartan git checkout v0.1.0   # 或 HEAD，按需
```

### 6.3 安装后端依赖并初始化数据库

```bash
cd /home/spartan/app/spartan-hub/server
sudo -u spartan npm ci --omit=dev
sudo -u spartan cp .env.example .env
sudo -u spartan nano .env    # 填 JWT_SECRET（64 字节随机）
sudo -u spartan node scripts/init.js   # 建表
sudo -u spartan node scripts/seed.js   # 成员 + 公告种子
```

`.env` 必填项：

```ini
PORT=3000
NODE_ENV=production
SQLITE_PATH=/var/lib/spartan/data/spartan.db
JWT_SECRET=$(openssl rand -hex 64)
ALLOW_ORIGIN=https://spartanultra.allenboard.cn
TRUSTED_PROXY=true
```

预创建数据目录：

```bash
sudo mkdir -p /var/lib/spartan/data
sudo chown -R spartan:spartan /var/lib/spartan
```

### 6.4 用 PM2 启动 API

```bash
sudo -u spartan pm2 start index.js --name spartan-api -i 1
sudo -u spartan pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u spartan --hp /home/spartan
sudo systemctl enable pm2-spartan
```

> 推荐 `-i 1` 而不是 `-i 2`：SQLite 单文件 + WAL 在多 writer 进程下会触发 `SQLITE_BUSY`。单进程 + Node 异步 I/O 完全够 6 人小组用。

### 6.5 部署 Nginx

`/etc/nginx/sites-available/spartan-ultra`：

```nginx
# 80 → 443 重定向 + ACME 备用
server {
  listen 80;
  listen [::]:80;
  server_name spartanultra.allenboard.cn;
  root /home/spartan/app/spartan-hub;
  location ^~ /.well-known/acme-challenge/ { allow all; }
  location / { return 301 https://$host$request_uri; }
}

# 443 主站
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name spartanultra.allenboard.cn;

  ssl_certificate     /etc/nginx/ssl/spartanultra.fullchain.pem;
  ssl_certificate_key /etc/nginx/ssl/spartanultra.key;
  ssl_protocols       TLSv1.2 TLSv1.3;
  ssl_ciphers         HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers off;
  ssl_session_cache shared:SSL:10m;
  http2_push_preload on;

  root /home/spartan/app/spartan-hub;
  index index.html;
  server_tokens off;

  # 安全头
  add_header Strict-Transport-Security "max-age=15552000; includeSubDomains" always;
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "no-referrer-when-downgrade" always;
  add_header Content-Security-Policy "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; script-src 'self' https://cdnjs.cloudflare.com; connect-src 'self' https://api.open-meteo.com" always;

  # 静态资源缓存
  location ~* \.(css|js|png|jpg|jpeg|webp|svg|woff2?)$ {
    expires 7d;
    add_header Cache-Control "public, max-age=604800" always;
    try_files $uri =404;
  }

  # 登录接口独立限速
  limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
  location = /api/v1/auth/login {
    limit_req zone=login burst=10 nodelay;
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_read_timeout 30s;
  }

  # 普通 API 限速
  limit_req_zone $binary_remote_addr zone=api:10m rate=20r/s;
  location /api/v1/ {
    limit_req zone=api burst=40 nodelay;
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_read_timeout 30s;
  }

  # SPA 入口
  location / {
    try_files $uri $uri/ /index.html;
  }

  # 健康检查
  location = /healthz { access_log off; return 200 "ok"; add_header Content-Type text/plain; }
}
```

把用户已具备的 `fullchain.pem` 与 `.key` 放在 `/etc/nginx/ssl/` 下：

```bash
sudo mkdir -p /etc/nginx/ssl
sudo cp /path/to/your/spartanultra.fullchain.pem /etc/nginx/ssl/
sudo cp /path/to/your/spartanultra.key /etc/nginx/ssl/
sudo chmod 600 /etc/nginx/ssl/spartanultra.key
sudo chmod 644 /etc/nginx/ssl/spartanultra.fullchain.pem
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/spartan-ultra /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6.6 防火墙

```bash
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

腾讯云轻量控制台 → 防火墙 → 放行 `80/443/22`，来源 `0.0.0.0/0`。

### 6.7 验收清单

```bash
# 健康检查
curl -I https://spartanultra.allenboard.cn/healthz

# 公共接口
curl -s https://spartanultra.allenboard.cn/api/v1/public/event | head

# 登录接口（应返回 200 with 正确 username 时）
curl -s -i -X POST https://spartanultra.allenboard.cn/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"allen"}'
```

### 6.8 不需要的步骤

- **不再申请 acme.sh 证书**：证书已具备
- **不再备案流程**：服务器与域名都已具备
- **不需要 Docker / K8s / CI**：单实例 + 手动 `bash ./push.sh` 已够
    try_files $uri $uri/ /index.html;
  }

  # 安全
  server_tokens off;
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "no-referrer-when-downgrade" always;
}

# HTTPS 由 acme.sh / 证书自动续签处理
```

启用：

```bash
sudo ln -s /etc/nginx/sites-available/spartan /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**步骤 5：申请 HTTPS 证书**

腾讯云轻量服务器支持 DNSPod / Let's Encrypt。

```bash
# 方式 A：腾讯云 DNSPod API
curl https://get.acme.sh | sh
export Tencent_Cloud_SecretId="..."
export Tencent_Cloud_SecretKey="..."
acme.sh --issue --dns dns_tencent -d your-domain.cn -d '*.your-domain.cn'
acme.sh --install-cert -d your-domain.cn \
  --reloadcmd "sudo systemctl reload nginx"
```

在 `/etc/nginx/sites-enabled/spartan` 顶部添加 443 块：

```nginx
server {
  listen 443 ssl http2;
  server_name your-domain.cn www.your-domain.cn;

  ssl_certificate     /home/spartan/.acme.sh/your-domain.cn/fullchain.cer;
  ssl_certificate_key /home/spartan/.acme.sh/your-domain.cn/your-domain.cn.key;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;
  ssl_session_cache shared:SSL:10m;

  root /home/spartan/app;
  index index.html;
  # 其余 location 与上面 80 块一致
}

server {
  listen 80;
  server_name your-domain.cn www.your-domain.cn;
  return 301 https://$host$request_uri;
}
```

**步骤 6：放行防火墙**

腾讯云轻量服务器：

- 控制台 → 防火墙 → 添加规则
- 80/443 TCP：来源 0.0.0.0/0

服务器本地：

```bash
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 6.2 部署目录与权限

```
/home/spartan/app
  ├── spartan-hub/                # 仓库代码
  ├── server/                     # API 进程
  └── server.log                  # PM2 日志

/var/lib/spartan/data
  ├── spartan.db                  # SQLite 主文件
  ├── spartan.db-wal
  └── backups/spartan-YYYYMMDD.db.gz
```

权限：

```bash
sudo mkdir -p /var/lib/spartan/{data,backups}
sudo chown -R spartan:spartan /var/lib/spartan
```

---

## 7. 配置与敏感信息

### 7.1 环境变量（`server/.env`）

```ini
PORT=3000
NODE_ENV=production
SQLITE_PATH=/var/lib/spartan/data/spartan.db
JWT_SECRET=请用 openssl rand -hex 64 生成
ALLOW_ORIGIN=https://your-domain.cn
LOG_LEVEL=info
```

**生产部署注意事项：**

- 文件权限 `chmod 600 server/.env`
- `JWT_SECRET` 必须 64 字节以上，不可与 dev/test 复用
- `ALLOW_ORIGIN` 锁死域名，禁止通配或 `*`

### 7.2 数据库种子

部署后第一次自动创建表结构，并植入 6 名成员 + 1 个管理员：

```bash
cd server
node scripts/seed.js
```

种子使用脚本里的硬编码密码哈希。**注意：种子账号和原型账号一一对应，但此时密码是种子脚本生成的临时密码，需在首次登录后立刻修改。**

### 7.3 反向代理与 Cookie

登录态使用 JWT + `HttpOnly` + `SameSite=Strict` Cookie：

```ts
res.cookie('sp_token', jwt, {
  httpOnly: true,
  sameSite: 'strict',
  secure: true,
  maxAge: 8 * 3600 * 1000
});
```

前端不再使用 `localStorage` 存 token，全部改为 Cookie。

---

## 8. 备份与恢复

### 8.1 SQLite 备份

每天凌晨 03:00 备份，保留 30 天。

`/home/spartan/app/deploy/backup.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR=/var/lib/spartan/backups
KEEP_DAYS=30
TS=$(date +%Y%m%d-%H%M%S)
SRC=/var/lib/spartan/data/spartan.db

# 一致性快照
sqlite3 "$SRC" ".timeout 5000" ".backup '$BACKUP_DIR/snapshot-$TS.db'"
gzip "$BACKUP_DIR/snapshot-$TS.db"
mv "$BACKUP_DIR/snapshot-$TS.db.gz" "$BACKUP_DIR/spartan-$TS.db.gz"

# 清理过期
find "$BACKUP_DIR" -name 'spartan-*.db.gz' -mtime +$KEEP_DAYS -delete

# 上传至 COS / OSS（可选）
# /usr/local/bin/coscli cp "$BACKUP_DIR/spartan-$TS.db.gz" cos://bucket/backup/
```

注册到 cron：

```bash
sudo crontab -u spartan -e
0 3 * * * /bin/bash /home/spartan/app/deploy/backup.sh >> /var/log/spartan-backup.log 2>&1
```

### 8.2 异地备份（可选）

推荐 COS / OSS：

```bash
# 安装 coscli
curl -sL https://github.com/tencentyun/coscli/releases/latest/download/coscli-windows -o /usr/local/bin/coscli
chmod +x /usr/local/bin/coscli

# 配置 ACCESS_KEY / SECRET_KEY 环境变量
# 同步至 bucket
/usr/local/bin/coscli sync /var/lib/spartan/backups cos://spartan-backup/db/ --delete
```

### 8.3 灾难恢复

```bash
# 1. 恢复数据库
gunzip -c backups/spartan-20260815-030000.db.gz > /var/lib/spartan/data/spartan.db
sudo chown spartan:spartan /var/lib/spartan/data/spartan.db

# 2. 重启 API
pm2 restart spartan-api

# 3. 验证
curl https://your-domain.cn/api/v1/members -H "Authorization: Bearer ..."
```

---

## 9. 监控与告警

### 9.1 基础监控

```bash
# Node 进程存活
pm2 monit

# 磁盘
df -h / /var

# 内存
free -m

# Nginx 状态
systemctl status nginx
```

### 9.2 简易健康检查

```bash
# /usr/local/bin/spartan-health
#!/usr/bin/env bash
curl -fsS -m 5 https://your-domain.cn/api/v1/public/itinerary >/dev/null || echo "API DOWN"
df -P / /var | awk 'NR>1 && $5+0 > 90 {print "DISK HIGH"}'
```

或使用腾讯云轻量监控：

- 控制台 → 监控 → 添加自定义监控
- 指标：`http_status_2xx / api / disk_use`
- 告警阈值：CPU > 80% 持续 5 分钟；磁盘 > 90%；API 5xx > 5%

### 9.3 日志

- PM2 日志：`/home/spartan/.pm2/logs/`
- Nginx 访问日志：`/var/log/nginx/access.log`
- 定期 rotate：

```bash
sudo tee /etc/logrotate.d/spartan <<'EOF'
/var/log/nginx/*.log /home/spartan/.pm2/logs/*.log {
  daily
  missingok
  rotate 14
  compress
  delaycompress
  notifempty
  create 0640 www-data spartan
  sharedscripts
  postrotate
    systemctl reload nginx >/dev/null 2>&1 || true
    pm2 reloadLogs >/dev/null 2>&1 || true
  endscript
}
EOF
```

---

## 10. 升级与回滚

### 10.1 升级流程

```bash
cd /home/spartan/app/spartan-hub
git pull
npm ci --omit=dev
pm2 reload spartan-api
```

零停机升级：

- PM2 启用 `--max-memory-restart 200M` 自动拉起新进程
- Nginx upstream 切换指向新进程

### 10.2 回滚

```bash
# 取上一个 tag
git fetch --tags
git checkout v0.1.0
pm2 reload spartan-api
```

数据变更的回滚：

- 备份中包含数据；用 SQLite 备份恢复 + 重启服务

---

## 11. 安全清单

| 项 | 状态 |
|---|---|
| HTTPS 强制 301 | 部署后立即生效 |
| HSTS | 在 Nginx 加 `add_header Strict-Transport-Security "max-age=15552000; includeSubDomains"` |
| JWT 仅存 HttpOnly Cookie | 必须 |
| 输入校验 | joi / zod 全面校验请求体 |
| 速率限制 | Nginx `limit_req_zone` + reverse proxy |
| CSP | 设置 `default-src 'self'` + 必要的 Google Fonts / cdnjs 域 |
| 数据库备份加密 | 备份文件 `chmod 600` |
| Secret 不进 git | 已用 `.env` 隔离 |
| Token 不入 localStorage | 仅 Cookie |

**访问速率限制（建议）**：

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=20r/s;
location /api/ {
  limit_req zone=api burst=40 nodelay;
  proxy_pass http://127.0.0.1:3000;
}
```

---

## 12. 域名与备案

部署到腾讯云内地服务器必须备案。

- 域名注册商：腾讯云 / DNSPod 推荐，便于快速接入 DNSPod API 申请证书
- 备案流程约 7–20 天
- 备案期间可用 `your-id.tencentcloudapp.com` 临时访问（不适合对外但够内部测试）

---

## 13. 成本估算（月）

| 项 | 费用 |
|---|---|
| 轻量 2C2G | ¥50–70 |
| 域名（约 ¥60/年）| ¥5 |
| 备案（一次性）| 免费 |
| SSL 证书 | 免费（Let's Encrypt） |
| 数据传输 | 含包月套餐 |
| **合计** | **~ ¥60/月** |

---

## 14. 演进路线

```
Phase 1 · 原型                   ✅ 完成
Phase 2 · 静态部署到 CDN         ✅ 简单
Phase 3 · Node + SQLite 单机    ⬅ 当前文档（推荐先实施）
Phase 4 · 拆前后端子域           性能与维护性提升
Phase 5 · 微信扫码登录           提升鉴权强度
Phase 6 · 拆 PostgreSQL          多人协作触发
Phase 7 · 离线 PWA + 推送        适配野外无网
```

---

## 15. 实施清单（按顺序）

1. 创建腾讯云轻量服务器，选 Ubuntu 22.04
2. 安装基础软件（Nginx / Node / Git / SQLite）
3. 克隆代码仓库到 `/home/spartan/app/spartan-hub`
4. 在 `/home/spartan/app/server` 下编写 Node API（首次实现按 §3 接口）
5. 用 `.env.example` 生成 `.env`，填入密钥
6. 申请域名 / DNS / 备案
7. 申请 HTTPS 证书
8. 配置 Nginx（含 80/443、HSTS、限流）
9. 启动 PM2，开机自启
10. 第一次备份 + cron
11. 配置腾讯云监控告警
12. 在 `apps/web/js/app.js` 中把硬编码 `localStorage` 切换为 `/api/v1/auth/*` 请求

我会在下一轮交付 `server/` 骨架。

---

## 16. 已知限制与备选

| 当前限制 | 建议升级路径 |
|---|---|
| 公开访问即泄露数据 | 增加邀请码 + 短信验证码 |
| SQLite 写入并发受限 | 升级 PostgreSQL 或单写多读 |
| 单实例风险 | 增加 1 个 standby + liteFS/COPY 同步 |
| Open-Meteo 在国内网络不稳定 | 自建反向代理 / 缓存 30 分钟 |

