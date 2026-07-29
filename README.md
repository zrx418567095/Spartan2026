# Spartan Hub · Super Beast 2026

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

## 数据源

- 障碍与赛道图：官方公众号文章（`https://mp.weixin.qq.com/s/I_OLuaRZYkg9CCd2RkdIaQ`）附图
- 补给站与关门时间：官方赛事图
- 天气：[Open-Meteo](https://open-meteo.com/)
