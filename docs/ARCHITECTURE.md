# 技术架构与部署手册

> Spartan Hub · Super Beast 2026
> 部署目标：腾讯云轻量应用服务器（单实例低配置）
> 文档版本：v0.1
> 适用代码版本：`v0.1.0`

本文对应**两段式部署**：

- **第一段（当前原型）**：纯静态前端 + Node.js API + SQLite，一台轻量服务器搞定
- **第二段（可选）**：把 API 拆出独立进程 / 拆 MySQL / 加微信扫码登录

如果只是给 6 个人的小队用，第一段足够。

---

## 0. 设计原则

| 原则 | 具体做法 |
|---|---|
| **零依赖外部 SaaS** | 数据走自有 SQLite；天气走 Open-Meteo；不再接任何第三方鉴权服务 |
| **极简部署** | 一台 2C2G 轻量服务器即可；不需要 Docker；不需要 K8s |
| **静态优先** | 公共页面纯 HTML/CSS/JS；只在登录后调用 API |
| **可审计** | Git 单仓管理；`push.sh` 一键同步；不回写任何凭证 |
| **易于备份** | SQLite 单文件；按天 cron 备份 + 异地 |

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
- 路径前缀：`/api/v1`
- 数据格式：`application/json; charset=utf-8`
- 时区：返回 UTC 时间戳与 `Asia/Shanghai` 字符串并存
- 鉴权：除注册/登录与公开内容外，所有写操作要求 `Authorization: Bearer <token>`

### 3.2 路由清单

| Method | Path | 说明 | 鉴权 |
|---|---|---|---|
| GET | `/api/v1/public/itinerary` | 公共行程 | 否 |
| GET | `/api/v1/public/course` | 公共赛道路况 | 否 |
| GET | `/api/v1/public/aid-stations` | 公共水站数据 | 否 |
| GET | `/api/v1/public/cutoffs` | 公共关门时间表 | 否 |
| GET | `/api/v1/weather` | 实时天气缓存代理 | 否 |
| POST | `/api/v1/auth/login` | 账号名登录（团队内用） | 否 |
| POST | `/api/v1/auth/logout` | 退出登录 | 是 |
| GET | `/api/v1/members` | 成员列表 | 是 |
| GET | `/api/v1/members/:id/expenses` | 个人费用 | 是（本人或 admin） |
| POST | `/api/v1/members/:id/expenses` | 新增费用 | 是（admin） |
| PATCH | `/api/v1/expenses/:id` | 更新支付状态 | 是（admin） |
| GET | `/api/v1/members/:id/gear` | 个人装备状态 | 是（本人或 admin） |
| PUT | `/api/v1/members/:id/gear` | 覆盖个人装备状态 | 是（本人） |
| GET | `/api/v1/members/:id/tasks` | 个人任务 | 是（本人） |
| PATCH | `/api/v1/tasks/:id` | 更新任务状态 | 是（本人） |

### 3.3 数据模型（草案）

```sql
members
  id          TEXT PRIMARY KEY,         -- m1, m2, ...
  username    TEXT UNIQUE NOT NULL,    -- member01
  display     TEXT NOT NULL,           -- 张一
  group_name  TEXT,                    -- 广州组
  role        TEXT NOT NULL,           -- member / admin
  created_at  INTEGER

sessions
  token       TEXT PRIMARY KEY,        -- 随机 32 字节
  member_id   TEXT NOT NULL,
  expires_at  INTEGER,
  created_at  INTEGER

expenses
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id    TEXT NOT NULL,
  item         TEXT NOT NULL,
  category     TEXT,
  amount_cents INTEGER NOT NULL,        -- 用分避免浮点
  paid_cents   INTEGER NOT NULL DEFAULT 0,
  due_date     TEXT,
  note         TEXT,
  updated_at   INTEGER
  FOREIGN KEY (member_id) REFERENCES members(id)

gear_status
  member_id    TEXT NOT NULL,
  item_name    TEXT NOT NULL,
  level        TEXT,                    -- mandatory / recommended / optional
  status       INTEGER,                 -- 0 未确认 / 1 已有 / 2 待购买 / 3 已装包
  PRIMARY KEY (member_id, item_name)

tasks
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id   TEXT NOT NULL,
  title       TEXT NOT NULL,
  done        INTEGER NOT NULL DEFAULT 0,
  due_at      INTEGER,
  created_at  INTEGER
```

### 3.4 鉴权策略（第一段简化）

第一阶段保留原型的"账号名登录"，但服务端做防滥用：

- 客户端 POST `/api/v1/auth/login { username }`
- 服务端查 `members.username` 是否存在 → 失败 401
- 服务端签发 HMAC-SHA256 JWT，payload `{ member_id, role, exp }`，密钥在环境变量
- 客户端保存 token 到 `localStorage`
- 后续每个写请求带 `Authorization: Bearer <token>`
- 路由中间件校验 token，过期 8 小时

> ⚠️ 这是"团队内部"信任模型：知道账号名 + 服务器地址就能登录一人。
> 上线公网前必须替换为：邀请码 + 短信验证码 或 微信扫码登录。
> 这一替换在第二段落地，预计架构几乎不变。

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

## 6. 部署流程

### 6.1 单机一次性部署

**步骤 1：初始化系统**

```bash
sudo apt update
sudo apt install -y nginx nodejs npm sqlite3 git curl
# Node 18 → 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

**步骤 2：克隆代码**

```bash
sudo useradd -m -s /bin/bash spartan
sudo -u spartan git clone https://github.com/zrx418567095/Spartan2026.git /home/spartan/app
cd /home/spartan/app
```

**步骤 3：安装 Node 依赖 + 启动**

```bash
cd server
npm ci --omit=dev
pm2 start index.js --name spartan-api -i 2
pm2 save
pm2 startup systemd
```

**步骤 4：Nginx 配置**

`/etc/nginx/sites-available/spartan`：

```nginx
server {
  listen 80 default_server;
  server_name your-domain.cn www.your-domain.cn;
  root /home/spartan/app;
  index index.html;

  # 静态资源缓存
  location ~* \.(css|js|png|jpg|jpeg|webp|svg|woff2?)$ {
    expires 7d;
    add_header Cache-Control "public, max-age=604800, immutable";
    try_files $uri =404;
  }

  # 后端 API
  location /api/ {
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

