// Spartan Super Beast 2026 — Team Hub
// 纯静态版本：不使用 ES Modules，通过全局对象访问数据与工具。

(function () {
  const $ = selector => document.querySelector(selector);
  const SPARTAN_HUB = window.SPARTAN_HUB;
  const Summary = window.SpartanSummary;

  const state = { user: null, view: 'home' };
  const STORAGE_KEY = 'spartan-hub-user';

  // 后端未启动，原型数据落地到 localStorage 后能跨刷新保留
  const DATA_KEY = 'spartan-hub-data';
  function persistData() {
    localStorage.setItem(DATA_KEY, JSON.stringify({
      expenseItems: SPARTAN_HUB.expenseItems,
      expenseSplits: SPARTAN_HUB.expenseSplits,
      tasksByUser: SPARTAN_HUB.tasksByUser,
      gearStatusByUser: SPARTAN_HUB.gearStatusByUser,
      announcements: SPARTAN_HUB.announcements
    }));
  }
  function restoreData() {
    const saved = localStorage.getItem(DATA_KEY);
    if (!saved) return;
    try {
      const obj = JSON.parse(saved);
      Object.assign(SPARTAN_HUB, obj);
    } catch (e) { /* ignore */ }
  }

  const money = v => `¥${v.toLocaleString('zh-CN')}`;
  const img = (file, alt) => `<img src="./assets/${file}" alt="${alt}" loading="lazy" decoding="async">`;
  const downloadLink = (file, name) => `
    <a class="download" href="./assets/${file}" download="${name}">
      <span class="arrow">↓</span> 下载高清图
    </a>
  `;
  const urlEncode = (s) => encodeURIComponent(s);

  function persist() {
    if (state.user) localStorage.setItem(STORAGE_KEY, state.user);
    else localStorage.removeItem(STORAGE_KEY);
  }

  function login(username) {
    const user = SPARTAN_HUB.users[username];
    if (!user) return false;
    state.user = username;
    persist();
    return true;
  }

  function logout() {
    state.user = null;
    persist();
    render();
  }

  function setView(view) {
    state.view = view;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderNav() {
    const user = state.user ? SPARTAN_HUB.users[state.user] : null;
    const links = $('#navLinks');
    const mobileLinks = $('#navMobileLinks');
    if (!links || !mobileLinks) return;

    const build = item => {
      const isActive = state.view === item.id;
      const isAuthItem = item.requiresAuth && !user;
      const isGuestItem = item.hideWhenGuest && !user;
      const isAuthedItem = item.hideWhenAuth && user;
      if (isAuthItem || isGuestItem || isAuthedItem) return '';
      // 管理员专属
      if (item.adminOnly && (!user || user.role !== 'admin')) return '';
      const action = item.id === 'logout'
        ? 'data-action="logout"'
        : `data-view="${item.id}"`;
      return `<li><a href="#${item.id}" class="${isActive ? 'active' : ''}" ${action}>${item.label}</a></li>`;
    };

    links.innerHTML = SPARTAN_HUB.nav.map(build).join('');
    mobileLinks.innerHTML = SPARTAN_HUB.nav.map(build).join('');

    if (user) {
      const greet = document.createElement('li');
      greet.innerHTML = `<a style="color: var(--purple-glow); cursor: default;">${user.name}${user.role === 'admin' ? ' · 管理员' : ''}</a>`;
      links.prepend(greet);
    }
  }

  function bindDelegatedClicks() {
    document.addEventListener('click', event => {
      const viewTarget = event.target.closest('[data-view]');
      if (viewTarget) {
        event.preventDefault();
        setView(viewTarget.getAttribute('data-view'));
        $('#navMobile').classList.remove('open');
        return;
      }
      const logoutTarget = event.target.closest('[data-action="logout"]');
      if (logoutTarget) {
        event.preventDefault();
        logout();
        $('#navMobile').classList.remove('open');
      }
    });
  }

  // ============== 页面渲染 ==============

  function renderHome() {
    const e = SPARTAN_HUB.event;
    const c = SPARTAN_HUB.course;
    const announcements = SPARTAN_HUB.announcements.slice(0, 3);
    return `
      <section class="hero">
        <div class="hero-tag">${e.seriesTag}</div>
        <h1>SPARTAN<br><span class="hl">SUPER BEAST</span></h1>
        <p class="hero-sub">${e.heroBackground}</p>
        <div class="hero-stats">
          <div class="hero-stat"><div class="num">${c.distanceKm} KM</div><div class="lbl">${c.tier} Distance</div></div>
          <div class="hero-stat"><div class="num">${c.obstacles}</div><div class="lbl">Obstacles</div></div>
          <div class="hero-stat"><div class="num">${(c.climb).toLocaleString('zh-CN')} M</div><div class="lbl">Uphill</div></div>
          <div class="hero-stat"><div class="num">6</div><div class="lbl">Athletes</div></div>
        </div>
        <div class="hero-course">
          Uphill ${(c.climb).toLocaleString('zh-CN')} m
          <span class="sep">·</span>
          Downhill ${(c.descent).toLocaleString('zh-CN')} m
          <span class="sep">·</span>
          ${c.aidStations} Aid Stations
        </div>
      </section>

      ${window.SpartanWeather ? window.SpartanWeather.render() : ''}

      <section class="section">
        <div class="container">
          <div class="sec-tag">Key Intel</div>
          <h2 class="sec-title">关键情报</h2>
          <div class="sec-line"></div>
          <p class="sec-desc">赛事核心信息一览。个人费用、物资状态请登录后查看。</p>
          <div class="grid grid-3">
            <div class="card"><span class="badge">比赛</span><h4>出发时间</h4><p>8/15 周六<br><span class="hl">07:15 年龄段组</span></p></div>
            <div class="card"><span class="badge">住宿</span><h4>云顶大酒店</h4><p>张家口崇礼区四台嘴乡梧桐大道<br><span class="hl">0313-4777777</span></p></div>
            <div class="card"><span class="badge">去程</span><h4>HU7816</h4><p>8/13 21:15 CAN T3<br><span class="hl">→ 00:25+1 PEK T2</span></p></div>
            <div class="card"><span class="badge red">返程</span><h4>MU6311</h4><p>8/16 21:50 PKX<br><span class="hl">→ 01:15+1 CAN T3</span></p></div>
            <div class="card"><span class="badge">去程高铁</span><h4>G7831</h4><p>8/14 07:29 北京北<br><span class="hl">→ 08:52 太子城</span></p></div>
            <div class="card"><span class="badge">天气</span><h4>崇礼 8 月</h4><p>白天 25–30°C / 夜间 14–18°C<br>昼夜温差大 · 多雷阵雨</p></div>
          </div>
        </div>
      </section>

      <section class="section alt">
        <div class="container">
          <div class="sec-tag">Quick Briefing</div>
          <h2 class="sec-title">关键决策</h2>
          <div class="sec-line"></div>
          <div class="grid grid-3">
            ${SPARTAN_HUB.decisions.map(d => `
              <div class="card"><h4>${d.title}</h4><p>建议：<span class="hl">${d.pick}</span><br>${d.reason}</p></div>
            `).join('')}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="sec-tag">Announcements</div>
          <h2 class="sec-title">最新公告</h2>
          <div class="sec-line"></div>
          <div>
            ${announcements.map(a => `
              <div class="announce">
                <div class="priority ${a.priority === 'high' ? '' : 'low'}">●</div>
                <div><h4>${a.title}</h4><div class="time">${a.time}</div></div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <section class="auth-strip" id="login">
        <div class="container">
          <div class="sec-tag">Member Access</div>
          <h2 class="sec-title">登录查看个人费用与物资</h2>
          <div class="sec-line"></div>
          <p class="sec-desc">原型阶段只需输入账号名（全拼，小写），不构成真实安全认证。</p>
          <form class="login-form" id="loginForm">
            <input id="loginInput" type="text" placeholder="试试 chener / xuwei / admin" autocomplete="username" required>
            <button type="submit">进入工作台</button>
          </form>
          <div class="login-error" id="loginError" role="status"></div>
          <div class="login-hint">演示账号：chener · zhangyi · panbin · xuwei · xuxiaoyong · zhousong · admin</div>
        </div>
      </section>
    `;
  }

  function renderItinerary() {
    return `
      <section class="section">
        <div class="container">
          <div class="sec-tag">Race Briefing</div>
          <h2 class="sec-title">赛道路况 · ULTRA</h2>
          <div class="sec-line"></div>
          <p class="sec-desc">超级野兽赛 ULTRA 难度 · 49.6 km · 72 障碍（两圈，第二圈涉水障碍 17/18/20/23 免挑战）· 8 个水站 · 9 个补给点 · 5 个关门点。我们所在的是 <strong style="color:var(--purple-glow);">年龄段组，07:15 出发</strong>。</p>
        </div>
      </section>

      <section class="section alt" id="itinerary">
        <div class="container">
          <div class="sec-tag">Itinerary</div>
          <h2 class="sec-title">行程预览</h2>
          <div class="sec-line"></div>
          <p class="sec-desc">8/12 行前准备 · 8/13 广州 → 北京 · 8/14 北京 → 崇礼 · 8/15 比赛日 · 8/16 返程。</p>
          ${SPARTAN_HUB.itinerary.map(day => `
            <div class="day">
              <div class="day-head">
                <div class="day-num">${day.date.slice(5).replace('-', '/')}</div>
                <div class="day-info">
                  <h3>${day.title}</h3>
                  <div class="date">${day.weekday} · ${day.date}</div>
                </div>
              </div>
              <p style="color:var(--muted);font-size:0.85rem;margin-bottom:14px;">${day.summary}</p>
              <div class="tl">
                ${day.items.map(item => `
                  <div class="tl-item ${item.highlight ? 'highlight' : ''}">
                    <div class="tl-time">${item.time}</div>
                    <div class="tl-title">${item.title}</div>
                    ${item.note ? `<div class="tl-note">${item.note}</div>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderGear() {
    const mandatory = SPARTAN_HUB.publicGear.filter(g => g.level === 'mandatory');
    const recommended = SPARTAN_HUB.publicGear.filter(g => g.level === 'recommended');
    const optional = SPARTAN_HUB.publicGear.filter(g => g.level === 'optional');

    const renderBlock = (title, items, level) => items.map(item => `
      <div class="card">
        <span class="tag ${level}">${item.category}</span>
        <h4>${item.name}</h4>
        <p>${item.level === 'mandatory' ? '官方强制装备，缺少可能被取消成绩。' :
            item.level === 'recommended' ? '强烈建议，缺失会增加完赛难度。' :
            '视个人情况准备。'}</p>
      </div>
    `).join('');

    return `
      <section class="section">
        <div class="container">
          <div class="sec-tag">Gear</div>
          <h2 class="sec-title">物资管理</h2>
          <div class="sec-line"></div>

          <div class="gear-banner">
            ${img('640 (1).webp', 'Spartan 强制装备清单')}
            <div class="overlay">
              <div>
                <span class="tag mandatory">MANDATORY · 官方强制</span>
                <h3>强制装备清单</h3>
                <p>头带 / 计时芯片 / GPS（仅限超级野兽）/ 2L 水袋 / 能量补给 / 应急口哨 / 应急毯</p>
              </div>
            </div>
          </div>

          <h3 style="font-family:var(--display);font-size:1.3rem;letter-spacing:2px;color:var(--white);margin:32px 0 12px;">强制装备 · Mandatory</h3>
          <div class="grid grid-3">${renderBlock('强制', mandatory, 'mandatory')}</div>

          <h3 style="font-family:var(--display);font-size:1.3rem;letter-spacing:2px;color:var(--white);margin:32px 0 12px;">建议装备 · Recommended</h3>
          <div class="grid grid-3">${renderBlock('建议', recommended, 'recommended')}</div>

          <h3 style="font-family:var(--display);font-size:1.3rem;letter-spacing:2px;color:var(--white);margin:32px 0 12px;">可选装备 · Optional</h3>
          <div class="grid grid-3">${renderBlock('可选', optional, 'optional')}</div>

          <p class="sec-desc" style="margin-top:32px;">个人物资状态请登录后在“我的工作台”查看与更新。</p>
        </div>
      </section>
    `;
  }

  function renderGuides() {
    const c = SPARTAN_HUB.course;
    const groups = {};
    SPARTAN_HUB.guides.forEach(g => {
      if (!groups[g.category]) groups[g.category] = [];
      groups[g.category].push(g);
    });
    return `
      <section class="section">
        <div class="container">
          <div class="sec-tag">Race Guides</div>
          <h2 class="sec-title">比赛攻略</h2>
          <div class="sec-line"></div>

          <div class="race-banner">
            <div class="label">崇礼云顶滑雪公园 · 8.15 · 年龄段组 07:15 出发</div>
            <h3>BEAST RACE ELEVATION</h3>
            <p>总距离 <strong style="color:var(--purple-glow);">${c.distanceKm} km</strong>，累计爬升 <strong style="color:var(--purple-glow);">${c.climb} m</strong>，累计下降 <strong style="color:var(--purple-glow);">${c.descent} m</strong>。<strong style="color:var(--purple-glow);">${c.loop1}</strong> 个基础障碍跑 <strong style="color:var(--purple-glow);">两圈</strong>，第二圈涉水障碍 #17 #18 #20 #23 免挑战，第二圈共 <strong style="color:var(--purple-glow);">${c.loop2}</strong> 个，全场总挑战 <strong style="color:var(--purple-glow);">${c.totalChallenges}</strong> 次。${c.aidStations} 个水站 + ${c.aidPoints} 个补给点 · 5 个关门点。</p>
          </div>

          <div class="course-stats">
            <div class="stat"><div class="num">${c.distanceKm} km</div><div class="lbl">Total Distance</div></div>
            <div class="stat"><div class="num">${c.totalChallenges}</div><div class="lbl">总挑战 (38 + 34)</div></div>
            <div class="stat"><div class="num">${c.climb.toLocaleString('zh-CN')} m</div><div class="lbl">Uphill</div></div>
            <div class="stat"><div class="num">${c.aidPoints}</div><div class="lbl">Aid Points</div></div>
          </div>

          <h3 style="font-family:var(--display);font-size:1.3rem;letter-spacing:2px;color:var(--white);margin:32px 0 14px;">海拔剖面</h3>
          <figure class="profile-figure">
            ${img('640 (3).webp', 'Beast Race 49.6 km 海拔剖面图，含 39 障碍与 8 水站')}
            <figcaption class="caption">海拔剖面 <strong>49.6 km</strong> · 累计爬升 <strong>${c.climb} m</strong> · 累计下降 <strong>${c.descent} m</strong>。前 10 km 持续陡升，13–17 km 出现最高点群。</figcaption>
          </figure>

          <h3 style="font-family:var(--display);font-size:1.3rem;letter-spacing:2px;color:var(--white);margin:32px 0 14px;">赛道全景</h3>
          <figure class="map-figure">
            <div class="corner">ULTRA · 49.6 KM</div>
            ${downloadLink(urlEncode('赛道高清图.jpg'), 'spartan-chongli-ultra-course.jpg')}
            ${img(urlEncode('赛道高清图.jpg'), '崇礼云顶滑雪公园超级野兽赛 49.6 km 高清赛道地图，38 个障碍与水站位置')}
          </figure>

          <h3 style="font-family:var(--display);font-size:1.3rem;letter-spacing:2px;color:var(--white);margin:40px 0 14px;">障碍一览 · 两圈</h3>
          <p class="sec-desc" style="margin-top:0;margin-bottom:14px;">共 38 个基础障碍，第一圈全 38 个；第二圈涉水障碍 <strong style="color:var(--purple-glow);">#17 泅渡 / #18 俄底斯河 / #20 海格力斯之锤 / #23 冥河洗礼</strong> 免挑战，第二圈实际挑战 34 个，全场总挑战 72 次。</p>
          <h4 style="font-family:var(--display);font-size:1.05rem;letter-spacing:2px;color:var(--purple-glow);margin:18px 0 10px;">第一圈 · 1–38（全部完成）</h4>
          <div class="obstacle-grid">
            ${SPARTAN_HUB.obstacles.map(o => `
              <div class="obstacle ${o.water ? 'water' : ''}">
                <div class="n">${String(o.id).padStart(2, '0')}</div>
                <div class="name">
                  <div class="zh">${o.zh}</div>
                  <div class="en">${o.en}${o.water ? ' · 涉水' : ''}</div>
                </div>
              </div>
            `).join('')}
          </div>
          <h4 style="font-family:var(--display);font-size:1.05rem;letter-spacing:2px;color:var(--purple-glow);margin:32px 0 10px;">第二圈 · 1–38（4 个涉水免挑战）</h4>
          <div class="obstacle-grid">
            ${SPARTAN_HUB.obstacles.map(o => {
              const exempt = o.water;
              return `
                <div class="obstacle ${exempt ? 'exempt' : ''}">
                  <div class="n">${String(o.id).padStart(2, '0')}</div>
                  <div class="name">
                    <div class="zh">${o.zh}${exempt ? ' · 免挑战' : ''}</div>
                    <div class="en">${o.en}${o.water ? ' · 涉水' : ''}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <h3 style="font-family:var(--display);font-size:1.3rem;letter-spacing:2px;color:var(--white);margin:40px 0 14px;">8 个水站 · 段距离 / 总距 / 段爬升 / 总爬 / 段下降 / 总降</h3>
          <p class="sec-desc" style="margin-top:0;margin-bottom:14px;">每段距离与总距均以官方图为准（第一圈数据）。补给点共 9 个，包含 <strong>换装点（24.79 km）</strong> 与终点。</p>
          <div class="tbl-wrap aid-table">
            <table class="tbl">
              <thead>
                <tr>
                  <th>站点</th>
                  <th class="num">段距 (km)</th>
                  <th class="num">总距 (km)</th>
                  <th class="num">段爬 (m)</th>
                  <th class="num">总爬 (m)</th>
                  <th class="num">段降 (m)</th>
                  <th class="num">总降 (m)</th>
                </tr>
              </thead>
              <tbody>
                ${SPARTAN_HUB.aidStations.map(s => `
                  <tr>
                    <td class="station">${s.name}</td>
                    <td class="num">${s.legKm.toFixed(2)}</td>
                    <td class="num">${s.cumKm.toFixed(2)}</td>
                    <td class="num">${s.legUp}</td>
                    <td class="num">${s.cumUp}</td>
                    <td class="num">${s.legDown}</td>
                    <td class="num">${s.cumDown}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <h3 style="font-family:var(--display);font-size:1.3rem;letter-spacing:2px;color:var(--white);margin:40px 0 14px;">关门时间表 · 5 个关卡（年龄段组）</h3>
          <p class="sec-desc" style="margin-top:0;margin-bottom:14px;">年龄段组 07:15 出发。不晚于关门时间到达对应关卡，违者将被立即取消比赛资格并驱离赛道。换装点将于 <strong>14:45 关闭</strong>，所有选手必须在 15 分钟内离开。</p>
          <div class="tbl-wrap cutoff-table">
            <table class="tbl">
              <thead>
                <tr>
                  <th>关门点</th>
                  <th class="num">总距 (km)</th>
                  <th class="num">总爬 (m)</th>
                  <th class="num">总降 (m)</th>
                  <th>途径障碍</th>
                  <th>途经水站</th>
                  <th>年龄段组</th>
                </tr>
              </thead>
              <tbody>
                ${SPARTAN_HUB.cutoffs.map(cut => `
                  <tr>
                    <td class="station">${cut.name}</td>
                    <td class="num">${cut.cumKm.toFixed(2)}</td>
                    <td class="num">${cut.cumUp}</td>
                    <td class="num">${cut.cumDown}</td>
                    <td>${cut.obstacles}</td>
                    <td>${cut.waters}</td>
                    <td><span class="cutoff-tag age">${cut.cutoff}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <p class="sec-desc" style="margin-top:14px;">所有时间均以官方为准；现场请以计时芯片读数为准。</p>

          <h3 style="font-family:var(--display);font-size:1.3rem;letter-spacing:2px;color:var(--white);margin:40px 0 14px;">实战攻略</h3>
          ${Object.entries(groups).map(([cat, items]) => `
            <h4 style="font-family:var(--display);font-size:1rem;letter-spacing:2px;color:var(--purple-glow);margin:24px 0 10px;">${cat}</h4>
            <div class="grid grid-2">
              ${items.map(g => `
                <div class="guide-card">
                  <div class="cat">${g.category}</div>
                  <h4>${g.title}</h4>
                  <p>${g.body}</p>
                </div>
              `).join('')}
            </div>
          `).join('')}

          <div class="earn-banner">
            ${img('640 (5).webp', 'Spartan EARN YOUR 海报')}
            <div class="text">EARN YOUR 2026</div>
          </div>
        </div>
      </section>
    `;
  }

  // ============ 个人工作台（成员 / 管理员） ============

  function renderDashboard() {
    if (!state.user) {
      return `
        <section class="auth-strip">
          <div class="container">
            <div class="sec-tag">Member Access</div>
            <h2 class="sec-title">需要登录</h2>
            <div class="sec-line"></div>
            <p class="sec-desc">请先返回首页登录后查看个人工作台。</p>
          </div>
        </section>
      `;
    }

    const user = SPARTAN_HUB.users[state.user];
    const isAdmin = user.role === 'admin';
    const mySplits = SPARTAN_HUB.expenseSplits.filter(s => s.memberId === user.id);
    const summary = Summary.summarizeMemberSplits(SPARTAN_HUB.expenseSplits, user.id);
    const gearMap = SPARTAN_HUB.gearStatusByUser[user.id] || {};
    const tasks = SPARTAN_HUB.tasksByUser[user.id] || [];

    const gear = Summary.summarizeGear(SPARTAN_HUB.publicGear, gearMap);
    const tasksDone = tasks.filter(t => t.done).length;
    const upcomingTask = tasks.find(t => !t.done);

    return `
      <section class="section">
        <div class="container">
          <div class="dashboard-head">
            <div>
              <div class="sec-tag">My Dashboard</div>
              <div class="dashboard-name">你好，${user.name}${isAdmin ? ' · 管理员' : ''}</div>
              <div class="dashboard-meta">${user.group} · ${isAdmin ? '团队管理员' : '团队成员'} · SPARTAN SUPER BEAST 2026</div>
            </div>
            <button class="btn" data-action="logout">退出登录</button>
          </div>

          <div class="stat-grid">
            <div class="stat"><div class="label">应承担费用</div><div class="value">${Summary.formatCents(summary.totalCents)}</div></div>
            <div class="stat"><div class="label">已支付</div><div class="value green">${Summary.formatCents(summary.paidCents)}</div></div>
            <div class="stat"><div class="label">待支付</div><div class="value ${summary.pendingCents > 0 ? 'red' : 'green'}">${Summary.formatCents(summary.pendingCents)}</div></div>
            <div class="stat">
              <div class="label">物资准备</div>
              <div class="value purple">${gear.rate}%</div>
              <div class="progress"><span style="width:${gear.rate}%"></span></div>
              <div style="color:var(--muted);font-size:0.7rem;margin-top:6px;">${gear.ready} / ${gear.total} 已就位</div>
            </div>
          </div>

          <h3 style="font-family:var(--display);font-size:1.2rem;letter-spacing:2px;margin:24px 0 12px;color:var(--white);">我的费用分摊</h3>
          ${mySplits.length === 0 ? '<div class="note">当前没有被分摊的费用。</div>' : `
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr><th>费用大项</th><th>类别</th><th class="num">应付</th><th>截止</th><th>状态</th><th>操作</th></tr>
              </thead>
              <tbody>
                ${mySplits.map(s => {
                  const item = SPARTAN_HUB.expenseItems.find(i => i.id === s.itemId);
                  const status = Summary.splitStatus(s);
                  return `
                    <tr>
                      <td>${item ? item.title : '未知大项'}</td>
                      <td>${item ? item.category : '-'}</td>
                      <td class="num">${Summary.formatCents(s.amountCents)}</td>
                      <td>${item && item.note ? item.note.slice(0, 24) : '-'}</td>
                      <td><span class="tag ${status}">${Summary.statusLabel(status)}</span></td>
                      <td>
                        <button class="btn-mini" data-mark-paid="${s.id}" ${s.paidStatus === 'paid' ? 'disabled' : ''}>标记已付</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          `}

          <h3 style="font-family:var(--display);font-size:1.2rem;letter-spacing:2px;margin:36px 0 12px;color:var(--white);">个人物资</h3>
          <div class="grid grid-3">
            ${SPARTAN_HUB.publicGear.map(item => {
              const status = gearMap[item.name] != null ? gearMap[item.name] : 0;
              return `
                <div class="card">
                  <span class="tag ${item.level}">${item.category}</span>
                  <h4>${item.name}</h4>
                  <p>${item.level === 'mandatory' ? '官方强制装备' : item.level === 'recommended' ? '强烈建议' : '个人自选'}</p>
                  <span class="gear-status s-${status}" style="margin-top:10px;">${Summary.gearStatusLabel(status)}</span>
                </div>
              `;
            }).join('')}
          </div>

          <h3 style="font-family:var(--display);font-size:1.2rem;letter-spacing:2px;margin:36px 0 12px;color:var(--white);">个人任务 (${tasksDone}/${tasks.length})</h3>
          ${upcomingTask ? `<div class="note">下一个待办：<strong style="color:var(--white);">${upcomingTask.title}</strong></div>` : '<div class="note">当前没有未完成的任务。</div>'}
          <ul class="task-list">
            ${tasks.map((task, index) => `
              <li>
                <input type="checkbox" data-task="${user.id}:${index}" ${task.done ? 'checked' : ''}>
                <span class="${task.done ? 'done' : ''}">${task.title}</span>
              </li>
            `).join('')}
          </ul>

          ${isAdmin ? `
            <div class="note" style="margin-top:32px;">
              你当前是 <strong style="color:var(--purple-glow);">管理员</strong>，可以前往
              <a href="#" data-view="admin-expense" style="color:var(--purple-glow);">费用管理</a> /
              <a href="#" data-view="admin-members" style="color:var(--purple-glow);">成员管理</a>
              进行全队操作。
            </div>
          ` : ''}

          <div class="note">原型说明：所有数据保存在浏览器本地（localStorage），并不与他人同步，仅用于验证界面和流程。</div>
        </div>
      </section>
    `;
  }

  // ============ 管理员 - 费用管理 ============

  function renderAdminExpense() {
    if (!state.user || SPARTAN_HUB.users[state.user].role !== 'admin') {
      return `<section class="auth-strip"><div class="container"><h2 class="sec-title">需要管理员权限</h2></div></section>`;
    }
    const team = Summary.summarizeTeam(SPARTAN_HUB.expenseItems, SPARTAN_HUB.expenseSplits);
    const items = Summary.summarizeItems(SPARTAN_HUB.expenseItems, SPARTAN_HUB.expenseSplits);

    // 成员汇总（按 member 维度）
    const memberIds = ['m1','m2','m3','m4','m5','m6'];
    const memberSummaries = memberIds.map(mid => {
      const u = SPARTAN_HUB.users[Object.keys(SPARTAN_HUB.users).find(k => SPARTAN_HUB.users[k].id === mid)];
      return { memberId: mid, name: u ? u.name : mid, ...Summary.summarizeMemberSplits(SPARTAN_HUB.expenseSplits, mid) };
    });

    return `
      <section class="section">
        <div class="container">
          <div class="sec-tag">Admin · Expense</div>
          <h2 class="sec-title">费用管理</h2>
          <div class="sec-line"></div>
          <p class="sec-desc">管理员可创建费用大项并为指定成员分配分摊金额。成员在个人工作台可标记已付。</p>

          <div class="stat-grid">
            <div class="stat"><div class="label">大项总额</div><div class="value">${Summary.formatCents(team.itemTotal)}</div></div>
            <div class="stat"><div class="label">已分摊</div><div class="value">${Summary.formatCents(team.splitTotal)}</div></div>
            <div class="stat"><div class="label">未分配</div><div class="value ${team.unassignedTotal > 0 ? 'red' : 'green'}">${Summary.formatCents(team.unassignedTotal)}</div></div>
            <div class="stat"><div class="label">已支付 / 待付</div><div class="value green">${Summary.formatCents(team.paidCents)} / <span style="color:var(--red);font-size:0.9em;">${Summary.formatCents(team.pendingCents)}</span></div></div>
          </div>

          <div style="margin: 24px 0;">
            <button class="btn btn-primary" id="addItemBtn">+ 新增大项</button>
            <button class="btn" id="exportCsvBtn">导出汇总 CSV</button>
          </div>

          <h3 style="font-family:var(--display);font-size:1.2rem;letter-spacing:2px;margin:24px 0 12px;color:var(--white);">费用大项</h3>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr><th>ID</th><th>名称</th><th>类别</th><th class="num">总额</th><th class="num">已分摊</th><th class="num">未分配</th><th class="num">已付</th><th>状态</th><th>操作</th></tr>
              </thead>
              <tbody>
                ${items.map(it => {
                  const status = Summary.itemStatus(it, SPARTAN_HUB.expenseSplits);
                  return `
                    <tr>
                      <td><code>${it.id}</code></td>
                      <td><strong>${it.title}</strong>${it.note ? `<br><span style="color:var(--muted);font-size:0.75rem;">${it.note}</span>` : ''}</td>
                      <td>${it.category}</td>
                      <td class="num">${Summary.formatCents(it.amountCents)}</td>
                      <td class="num">${Summary.formatCents(it.splitCents)} (${it.memberCount}人)</td>
                      <td class="num ${it.unassignedCents > 0 ? 'red' : 'green'}">${Summary.formatCents(it.unassignedCents)}</td>
                      <td class="num">${Summary.formatCents(it.paidCents)}</td>
                      <td><span class="tag ${status}">${Summary.statusLabel(status)}</span></td>
                      <td>
                        <button class="btn-mini" data-edit-item="${it.id}">分摊</button>
                        <button class="btn-mini btn-danger" data-del-item="${it.id}">删除</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <h3 style="font-family:var(--display);font-size:1.2rem;letter-spacing:2px;margin:36px 0 12px;color:var(--white);">成员汇总</h3>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr><th>成员</th><th class="num">分摊笔数</th><th class="num">应承担</th><th class="num">已付</th><th class="num">待付</th></tr>
              </thead>
              <tbody>
                ${memberSummaries.map(ms => `
                  <tr>
                    <td><strong>${ms.name}</strong> <code>(${ms.memberId})</code></td>
                    <td class="num">${ms.items}</td>
                    <td class="num">${Summary.formatCents(ms.totalCents)}</td>
                    <td class="num green">${Summary.formatCents(ms.paidCents)}</td>
                    <td class="num ${ms.pendingCents > 0 ? 'red' : 'green'}">${Summary.formatCents(ms.pendingCents)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div id="adminExpenseModal"></div>
        </div>
      </section>
    `;
  }

  function renderAdminMembers() {
    if (!state.user || SPARTAN_HUB.users[state.user].role !== 'admin') {
      return `<section class="auth-strip"><div class="container"><h2 class="sec-title">需要管理员权限</h2></div></section>`;
    }
    const memberIds = ['m1','m2','m3','m4','m5','m6'];
    const rows = memberIds.map(mid => {
      const username = Object.keys(SPARTAN_HUB.users).find(k => SPARTAN_HUB.users[k].id === mid);
      const u = SPARTAN_HUB.users[username];
      const ms = Summary.summarizeMemberSplits(SPARTAN_HUB.expenseSplits, mid);
      const tasks = SPARTAN_HUB.tasksByUser[mid] || [];
      const tasksDone = tasks.filter(t => t.done).length;
      return `
        <tr>
          <td><strong>${u.name}</strong></td>
          <td><code>${username}</code></td>
          <td><code>${mid}</code></td>
          <td>${u.group}</td>
          <td class="num">${Summary.formatCents(ms.totalCents)}</td>
          <td class="num red">${Summary.formatCents(ms.pendingCents)}</td>
          <td class="num">${tasksDone} / ${tasks.length}</td>
        </tr>
      `;
    }).join('');
    return `
      <section class="section">
        <div class="container">
          <div class="sec-tag">Admin · Members</div>
          <h2 class="sec-title">成员管理</h2>
          <div class="sec-line"></div>
          <p class="sec-desc">查看所有成员的费用与任务进度。</p>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr><th>姓名</th><th>登录名（全拼）</th><th>业务 ID</th><th>组别</th><th class="num">应承担</th><th class="num">待付</th><th>任务进度</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  // ============ 绑定交互 ============

  function bindLogin() {
    const form = $('#loginForm');
    if (!form) return;
    form.addEventListener('submit', event => {
      event.preventDefault();
      const username = $('#loginInput').value.trim().toLowerCase();
      if (!login(username)) {
        $('#loginError').textContent = '未找到该账号，请使用列表中的演示账号。';
        return;
      }
      $('#loginError').textContent = '';
      setView('dashboard');
    });
  }

  function bindTasks() {
    document.querySelectorAll('input[data-task]').forEach(input => {
      input.addEventListener('change', event => {
        const [mid, idxStr] = event.target.getAttribute('data-task').split(':');
        const index = Number(idxStr);
        if (SPARTAN_HUB.tasksByUser[mid]) {
          SPARTAN_HUB.tasksByUser[mid][index].done = event.target.checked;
          persistData();
          render();
        }
      });
    });
  }

  function bindNavToggle() {
    const btn = $('#navHamburger');
    const mobile = $('#navMobile');
    if (!btn || !mobile) return;
    btn.addEventListener('click', () => mobile.classList.toggle('open'));
  }

  // 成员标记已付
  function bindMarkPaid() {
    document.querySelectorAll('[data-mark-paid]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-mark-paid');
        const split = SPARTAN_HUB.expenseSplits.find(s => s.id === id);
        if (!split) return;
        const me = SPARTAN_HUB.users[state.user];
        if (!me) return;
        if (me.role === 'admin' || split.memberId === me.id) {
          split.paidStatus = 'paid';
          persistData();
          render();
        }
      });
    });
  }

  // 管理员 - 大项操作
  function bindAdminExpense() {
    const addBtn = $('#addItemBtn');
    if (addBtn) addBtn.addEventListener('click', () => openItemModal(null));

    const exportBtn = $('#exportCsvBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportCsv);

    document.querySelectorAll('[data-edit-item]').forEach(btn => {
      btn.addEventListener('click', () => openItemModal(btn.getAttribute('data-edit-item')));
    });
    document.querySelectorAll('[data-del-item]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-item');
        if (confirm('确认删除该大项及其所有分摊？')) {
          SPARTAN_HUB.expenseItems = SPARTAN_HUB.expenseItems.filter(i => i.id !== id);
          SPARTAN_HUB.expenseSplits = SPARTAN_HUB.expenseSplits.filter(s => s.itemId !== id);
          persistData();
          render();
        }
      });
    });
  }

  function openItemModal(itemId) {
    const item = itemId ? SPARTAN_HUB.expenseItems.find(i => i.id === itemId) : null;
    const splits = item ? SPARTAN_HUB.expenseSplits.filter(s => s.itemId === itemId) : [];
    const modal = $('#adminExpenseModal');
    if (!modal) return;

    const memberIds = ['m1','m2','m3','m4','m5','m6'];
    const memberOptions = memberIds.map(mid => {
      const username = Object.keys(SPARTAN_HUB.users).find(k => SPARTAN_HUB.users[k].id === mid);
      const u = SPARTAN_HUB.users[username];
      return `<label style="display:inline-flex;align-items:center;margin:4px 12px 4px 0;font-size:0.82rem;"><input type="checkbox" class="member-check" value="${mid}" data-username="${u.name}" ${splits.some(s => s.memberId === mid) ? 'checked' : ''}> ${u.name}</label>`;
    }).join('');

    modal.innerHTML = `
      <div class="modal-mask" id="modalMask">
        <div class="modal">
          <div class="modal-head">
            <h3>${item ? '编辑大项 / 分摊' : '新增费用大项'}</h3>
            <button class="modal-close" id="modalClose">×</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <label>大项名称</label>
              <input id="mTitle" type="text" value="${item ? item.title : ''}" placeholder="如：上海-香港机票">
            </div>
            <div class="form-row">
              <label>类别</label>
              <select id="mCategory">
                ${['交通','住宿','餐饮','赛事','装备','其他'].map(c => `<option value="${c}" ${item && item.category === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="form-row">
              <label>总金额（元）</label>
              <input id="mAmount" type="number" min="0" step="0.01" value="${item ? (item.amountCents/100) : ''}" placeholder="0.00">
            </div>
            <div class="form-row">
              <label>大项状态</label>
              <select id="mStatus">
                <option value="unpaid" ${item && item.status === 'unpaid' ? 'selected' : ''}>待支付</option>
                <option value="partial" ${item && item.status === 'partial' ? 'selected' : ''}>部分结清</option>
                <option value="paid" ${item && item.status === 'paid' ? 'selected' : ''}>已结清</option>
              </select>
            </div>
            <div class="form-row">
              <label>备注</label>
              <input id="mNote" type="text" value="${item ? (item.note || '') : ''}" placeholder="可选">
            </div>
            <div class="form-row">
              <label>分配成员</label>
              <div style="margin: 6px 0 10px;">${memberOptions}</div>
              <div style="display:flex;gap:8px;align-items:center;">
                <button type="button" class="btn-mini" id="selectAllBtn">全选</button>
                <button type="button" class="btn-mini" id="selectNoneBtn">全不选</button>
                <span style="color:var(--muted);font-size:0.8rem;margin-left:12px;">均摊模式：</span>
                <button type="button" class="btn-mini btn-primary" id="splitEvenBtn">一键均摊</button>
              </div>
            </div>
            <div class="form-row">
              <label>分摊明细（可手动修改金额）</label>
              <div id="splitsList" style="border:1px solid var(--border);padding:8px;max-height:200px;overflow:auto;"></div>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn" id="modalCancel">取消</button>
            <button class="btn btn-primary" id="modalSave">${item ? '保存' : '创建'}</button>
          </div>
        </div>
      </div>
    `;

    const renderSplitsList = () => {
      const checked = Array.from(document.querySelectorAll('.member-check:checked'));
      const list = $('#splitsList');
      if (!list) return;
      if (checked.length === 0) { list.innerHTML = '<div style="color:var(--muted);font-size:0.82rem;">尚未选择成员。</div>'; return; }
      list.innerHTML = checked.map(cb => {
        const mid = cb.value;
        const name = cb.getAttribute('data-username');
        const existing = splits.find(s => s.memberId === mid);
        return `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="width:80px;font-size:0.85rem;">${name}</span>
            <input type="number" class="split-amt" data-mid="${mid}" min="0" step="0.01" value="${existing ? existing.amountCents/100 : ''}" placeholder="0.00" style="flex:1;">
            <span style="color:var(--muted);font-size:0.78rem;">元</span>
          </div>
        `;
      }).join('');
    };
    renderSplitsList();

    document.querySelectorAll('.member-check').forEach(cb => cb.addEventListener('change', renderSplitsList));
    $('#selectAllBtn').addEventListener('click', () => { document.querySelectorAll('.member-check').forEach(cb => cb.checked = true); renderSplitsList(); });
    $('#selectNoneBtn').addEventListener('click', () => { document.querySelectorAll('.member-check').forEach(cb => cb.checked = false); renderSplitsList(); });
    $('#splitEvenBtn').addEventListener('click', () => {
      const total = Number($('#mAmount').value);
      const checked = Array.from(document.querySelectorAll('.member-check:checked'));
      if (!total || checked.length === 0) { alert('请先填写总金额并选择成员'); return; }
      const each = (total / checked.length).toFixed(2);
      checked.forEach(cb => {
        const input = document.querySelector(`.split-amt[data-mid="${cb.value}"]`);
        if (input) input.value = each;
      });
    });

    $('#modalClose').addEventListener('click', closeModal);
    $('#modalCancel').addEventListener('click', closeModal);

    $('#modalSave').addEventListener('click', () => {
      const title = $('#mTitle').value.trim();
      const category = $('#mCategory').value;
      const amount = Math.round(Number($('#mAmount').value) * 100);
      const status = $('#mStatus').value;
      const note = $('#mNote').value.trim();
      if (!title || !amount) { alert('名称与金额必填'); return; }

      let targetItemId;
      if (item) {
        Object.assign(item, { title, category, amountCents: amount, status, note });
        targetItemId = item.id;
        // 删除旧分摊，重新写
        SPARTAN_HUB.expenseSplits = SPARTAN_HUB.expenseSplits.filter(s => s.itemId !== targetItemId);
      } else {
        targetItemId = 'ei-' + Date.now();
        SPARTAN_HUB.expenseItems.push({ id: targetItemId, title, category, amountCents: amount, status, note, createdBy: 'a1' });
      }

      // 写入新分摊
      const checked = Array.from(document.querySelectorAll('.member-check:checked'));
      checked.forEach(cb => {
        const mid = cb.value;
        const amtInput = document.querySelector(`.split-amt[data-mid="${mid}"]`);
        const amt = Math.round(Number(amtInput.value) * 100);
        if (!amt) return;
        SPARTAN_HUB.expenseSplits.push({
          id: 'sp-' + Date.now() + '-' + mid,
          itemId: targetItemId,
          memberId: mid,
          amountCents: amt,
          paidStatus: 'unpaid'
        });
      });

      persistData();
      closeModal();
      render();
    });
  }

  function closeModal() {
    const modal = $('#adminExpenseModal');
    if (modal) modal.innerHTML = '';
  }

  function exportCsv() {
    const rows = [['成员', '应承担(元)', '已付(元)', '待付(元)', '笔数']];
    ['m1','m2','m3','m4','m5','m6'].forEach(mid => {
      const u = SPARTAN_HUB.users[Object.keys(SPARTAN_HUB.users).find(k => SPARTAN_HUB.users[k].id === mid)];
      const ms = Summary.summarizeMemberSplits(SPARTAN_HUB.expenseSplits, mid);
      rows.push([u.name, ms.totalCents/100, ms.paidCents/100, ms.pendingCents/100, ms.items]);
    });
    const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spartan-expense-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ============ 主渲染 ============

  function render() {
    const view = state.user && state.view === 'login' ? 'home' : state.view;
    const views = {
      home: renderHome,
      itinerary: renderItinerary,
      gear: renderGear,
      guides: renderGuides,
      dashboard: renderDashboard,
      'admin-expense': renderAdminExpense,
      'admin-members': renderAdminMembers
    };
    $('#main').innerHTML = (views[view] || renderHome)();
    renderNav();
    bindLogin();
    bindTasks();
    bindMarkPaid();
    bindAdminExpense();
    if (state.view === 'home' && window.SpartanWeather) {
      window.SpartanWeather.loadAndRender();
    }
  }

  function init() {
    restoreData();
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SPARTAN_HUB.users[saved]) state.user = saved;
    bindDelegatedClicks();
    bindNavToggle();
    render();
    if (window.SpartanWeather) window.SpartanWeather.loadAndRender();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();