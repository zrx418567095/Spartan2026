# 部署手册

> Spartan Hub · Super Beast 2026
> 目标服务器：腾讯云轻量应用服务器 2C2G
> 目标域名：`https://spartanultra.allenboard.cn/`
> 文档版本：v1.0
> 适用代码版本：`v0.1.x` 及以上

本文档面向"打包 → 上传 → 服务器初始化 → 启动 → 验证 → 反代 HTTPS"完整流程。

---

## 0. 部署清单

| 项 | 值 |
|---|---|
| 服务器 | 腾讯云轻量 2C2G / Ubuntu 22.04 LTS |
| 公网 IP | （请填入） |
| 域名 | `spartanultra.allenboard.cn` |
| 部署路径 | `/var/lib/spartan`（代码）/ `/var/lib/spartan/data`（SQLite）|
| 服务端口 | `127.0.0.1:3000`（仅本机，被 Nginx 反代） |
| 进程管理 | systemd 服务 `spartan-hub.service` |
| TLS 终止 | Nginx + Let's Encrypt（或现有证书） |
| 数据库 | SQLite 单文件 `data/spartan.db` |
| 包格式 | `tar.gz`（含前端 + 后端源码，不含 node_modules） |

---

## 1. 本地打包

在开发机（Windows / macOS / Linux）执行：

```bash
cd J:/kimi-test/spartan-hub          # Windows
# 或
cd ~/projects/spartan-hub            # Linux/macOS

bash ./build.sh
```

产物：
```
dist/
├── spartan-hub-20260730-1803.tar.gz    # 约 3-5 MB
└── spartan-hub-20260730-1803.sha256    # 校验码
```

> ⚠️ `node_modules` 不在包内，服务器端会执行 `npm ci`，省下 ~300 MB 传输。

---

## 2. 上传到服务器

```bash
# 1. 上传包
scp dist/spartan-hub-20260730-1803.tar.gz root@<公网IP>:/tmp/

# 2. SSH 登录
ssh root@<公网IP>
```

---

## 3. 服务器初始化（首次部署）

### 3.1 创建用户与目录

```bash
# 创建专用用户（不推荐 root 直接跑）
useradd -r -m -s /bin/bash spartan

# 部署目录
mkdir -p /var/lib/spartan
chown -R spartan:spartan /var/lib/spartan
```

### 3.2 安装 Node.js 22+

```bash
# 推荐用 NodeSource 仓库
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# 验证
node -v    # 应输出 v22.x 或更高
npm -v
```

### 3.3 安装 Nginx + Certbot

```bash
apt-get install -y nginx certbot python3-certbot-nginx
```

### 3.4 解压包

```bash
cd /var/lib/spartan
tar -xzf /tmp/spartan-hub-20260730-1803.tar.gz --strip-components=1
chown -R spartan:spartan /var/lib/spartan
```

目录结构：

```
/var/lib/spartan/
├── index.html
├── css/  js/  assets/  docs/
├── server/
│   ├── index.js
│   ├── package.json
│   ├── start.sh
│   ├── schema.sql
│   ├── scripts/  middleware/  routes/
│   └── .env.example
└── manifest.txt
```

---

## 4. 配置后端

### 4.1 生成 .env

```bash
cd /var/lib/spartan/server

# 生成 64 字节随机 JWT 密钥
SECRET=$(openssl rand -hex 32)

cp .env.example .env
chmod 600 .env
```

编辑 `.env`：

```ini
PORT=3000
NODE_ENV=production
HOST=127.0.0.1

# 数据库文件（首次启动会自动创建）
SQLITE_PATH=/var/lib/spartan/data/spartan.db

# 必填：JWT 签名密钥（≥ 64 字节随机）
JWT_SECRET=<粘贴上面生成的 SECRET>

# CORS 白名单
ALLOW_ORIGIN=https://spartanultra.allenboard.cn

# Nginx 反代后面必须 true
TRUSTED_PROXY=true

# Token 过期（秒）默认 8 小时
TOKEN_TTL_SECONDS=28800
```

### 4.2 安装依赖

```bash
sudo -u spartan npm ci --omit=dev
```

### 4.3 初始化数据库

```bash
sudo -u spartan npm run db:init
sudo -u spartan npm run db:seed
```

成功后会看到：

```
[seed] ok: 6 members inserted
[seed] ok: 3 announcements inserted
[seed] ok: 4 expense items inserted
[seed] ok: 24 splits inserted
```

### 4.4 冒烟测试

```bash
sudo -u spartan npm run smoke
```

预期：所有断言通过。

---

## 5. 配置 systemd 守护进程

### 5.1 创建服务文件

```bash
cat > /etc/systemd/system/spartan-hub.service <<'EOF'
[Unit]
Description=Spartan Hub - Super Beast 2026
After=network.target

[Service]
Type=simple
User=spartan
Group=spartan
WorkingDirectory=/var/lib/spartan/server
EnvironmentFile=/var/lib/spartan/server/.env
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=3
StandardOutput=append:/var/lib/spartan/server/logs/systemd.log
StandardError=append:/var/lib/spartan/server/logs/systemd.log

# 安全加固
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/spartan/data /var/lib/spartan/server/logs

[Install]
WantedBy=multi-user.target
EOF

mkdir -p /var/lib/spartan/server/logs
chown -R spartan:spartan /var/lib/spartan/server/logs
systemctl daemon-reload
systemctl enable spartan-hub
systemctl start spartan-hub
```

### 5.2 验证

```bash
systemctl status spartan-hub
curl -s http://127.0.0.1:3000/healthz
# 预期: {"ok":true,"ts":...}
```

---

## 6. 配置 Nginx 反代 + HTTPS

### 6.1 申请证书（如果还没有）

```bash
certbot --nginx -d spartanultra.allenboard.cn
```

### 6.2 写入 Nginx 配置

```bash
cat > /etc/nginx/sites-available/spartan <<'EOF'
# 限流（与后端 .env 保持一致）
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=20r/s;
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

server {
    listen 80;
    server_name spartanultra.allenboard.cn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name spartanultra.allenboard.cn;

    ssl_certificate     /etc/letsencrypt/live/spartanultra.allenboard.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/spartanultra.allenboard.cn/privkey.pem;

    # SSL 优化
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;

    # 客户端最大上传（图片等静态资源）
    client_max_body_size 20M;

    # 安全头
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header Referrer-Policy strict-origin-when-cross-origin;

    # 静态资源缓存
    location ~* \.(js|css|webp|jpg|png|ico|svg|woff2?)$ {
        proxy_pass http://127.0.0.1:3000;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # API 限流
    location /api/v1/auth/login {
        limit_req zone=login_limit burst=10 nodelay;
        proxy_pass http://127.0.0.1:3000;
    }

    location /api/v1/ {
        limit_req zone=api_limit burst=40 nodelay;
        proxy_pass http://127.0.0.1:3000;
    }

    # 其它全部反代
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/spartan /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 6.3 验证 HTTPS

```bash
curl -I https://spartanultra.allenboard.cn/healthz
# 预期: HTTP/2 200
```

---

## 7. DNS 配置（重要）

在域名服务商（Cloudflare / 腾讯云 DNSPod 等）添加：

| 主机记录 | 记录类型 | 记录值 |
|---------|---------|--------|
| `spartanultra` | A | `<公网IP>` |

---

## 8. 验证清单

部署完成后逐项勾选：

- [ ] `systemctl status spartan-hub` 显示 `active (running)`
- [ ] `curl http://127.0.0.1:3000/healthz` 返回 `{"ok":true,...}`
- [ ] `curl -I https://spartanultra.allenboard.cn/` 返回 200
- [ ] 浏览器打开 `https://spartanultra.allenboard.cn/` 能看到 SpartanUltra 首页
- [ ] 用管理员账号 `admin` 登录成功（任何密码，因为本地无密码校验）
- [ ] 进入"成员管理"能看到 6 名成员
- [ ] 进入"费用管理"能看到 4 个大项 + 24 条分摊
- [ ] 退出登录，再以成员账号 `allen` (m2) 登录成功

---

## 9. 运维常用命令

```bash
# 查看服务状态
systemctl status spartan-hub

# 重启服务
systemctl restart spartan-hub

# 查看日志（systemd 接管）
journalctl -u spartan-hub -f

# 查看应用日志
tail -f /var/lib/spartan/server/logs/server.log

# 数据库备份
cp /var/lib/spartan/data/spartan.db /var/lib/spartan/data/spartan.db.bak-$(date +%Y%m%d)

# 升级部署（新版本）
cd /var/lib/spartan/server
systemctl stop spartan-hub
cd /var/lib/spartan
# 解压新包覆盖
tar -xzf /tmp/spartan-hub-NEW.tar.gz --strip-components=1
cd server
sudo -u spartan npm ci --omit=dev
systemctl start spartan-hub
systemctl status spartan-hub

# 完全重置数据库（慎用！会丢失所有数据）
cd /var/lib/spartan/server
bash ./start.sh reset
```

---

## 10. 故障排查

| 现象 | 排查 |
|------|------|
| 502 Bad Gateway | 检查 `systemctl status spartan-hub`；检查 .env 中 `JWT_SECRET` 是否设置 |
| 静态资源 404 | 检查 Nginx 是否 reload；检查 `/var/lib/spartan/index.html` 是否存在 |
| 数据库被锁 | 检查是否有多个 Node 进程 `ps aux | grep node` |
| CORS 错误 | `.env` 中 `ALLOW_ORIGIN` 必须与访问域名完全一致 |
| Token 频繁过期 | `.env` 中 `TOKEN_TTL_SECONDS` 调大；检查客户端时钟 |

---

## 11. 安全建议

1. **SSH**：禁用密码登录，仅允许密钥
   ```bash
   sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
   systemctl restart sshd
   ```

2. **防火墙**：只开 22 / 80 / 443
   ```bash
   ufw allow 22/tcp
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw enable
   ```

3. **数据库备份**：加 cron，每天 03:00 备份
   ```bash
   0 3 * * * cp /var/lib/spartan/data/spartan.db /var/lib/spartan/data/backup-$(date +\%Y\%m\%d).db
   ```

4. **JWT_SECRET**：定期轮换（约每 90 天），轮换后所有用户需要重新登录

5. **禁用 root 远程登录**

---

## 12. 给 openclaw 的部署 checklist

```
[ ] 服务器已具备 Node.js ≥ 22
[ ] /var/lib/spartan 目录就绪，权限 spartan:spartan
[ ] /tmp/spartan-hub-*.tar.gz 已上传
[ ] 解压完成
[ ] .env 已生成并填好 JWT_SECRET
[ ] npm ci 完成
[ ] npm run db:init && npm run db:seed 完成
[ ] npm run smoke 通过
[ ] systemd 单元已写入并 enable
[ ] systemctl start spartan-hub 成功
[ ] Nginx 配置已写入并 reload
[ ] TLS 证书已就位
[ ] DNS A 记录已指向服务器 IP
[ ] https://spartanultra.allenboard.cn/ 返回 200
```

---

## 13. 联系

部署过程中遇到任何问题，把以下信息贴给我：
- `journalctl -u spartan-hub -n 50` 的输出
- `nginx -t` 与 `nginx/error.log` 末尾 50 行
- `curl -v https://spartanultra.allenboard.cn/` 的输出
- 浏览器 F12 → Network → 失败请求的状态码与响应