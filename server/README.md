# 服务端代码占位

完整的服务端实现将在下一轮交付，包括：

- `index.js` —— Express / Fastify 入口
- `db.js` —— SQLite 连接与迁移
- `routes/` —— `/api/v1/*` 路由
- `middleware/auth.js` —— JWT 校验
- `middleware/ratelimit.js` —— 速率限制
- `scripts/seed.js` —— 首次部署种子数据

接口设计与数据模型详见 `docs/ARCHITECTURE.md`。
