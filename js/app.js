// Spartan Super Beast 2026 — Team Hub
// 纯静态版本：不使用 ES Modules，通过全局对象访问数据与工具。

(function () {
  const $ = selector => document.querySelector(selector);
  const SPARTAN_HUB = window.SPARTAN_HUB;
  const Summary = window.SpartanSummary;

  const state = { user: null, view: 'home' };
  const STORAGE_KEY = 'spartan-hub-user';

  const money = v => `¥${v.toLocaleString('zh-CN')}`;
  const img = (file, alt) => `<img src="./assets/${file}" alt="${alt}" loading="lazy" decoding="async">`;
  const downloadLink = (file, name) => `
    <a class="download" href="./assets/${file}" download="${name}">
      <span class="arrow">↓</span> 下载高清图
    </a>
  `;
  // 文件名做 URL 编码：保留中文文件名
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
      const action = item.id === 'logout'
        ? 'data-action="logout"'
        : `data-view="${item.id}"`;
      return `<li><a href="#${item.id}" class="${isActive ? 'active' : ''}" ${action}>${item.label}</a></li>`;
    };

    links.innerHTML = SPARTAN_HUB.nav.map(build).join('');
    mobileLinks.innerHTML = SPARTAN_HUB.nav.map(build).join('');

    if (user) {
      const greet = document.createElement('li');
      greet.innerHTML = `<a style="color: var(--purple-glow); cursor: default;">${user.name}</a>`;
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
          <p class="sec-desc">原型阶段只需输入账号名，不构成真实安全认证。</p>
          <form class="login-form" id="loginForm">
            <input id="loginInput" type="text" placeholder="试试 member01 / member04 / admin" autocomplete="username" required>
            <button type="submit">进入工作台</button>
          </form>
          <div class="login-error" id="loginError" role="status"></div>
          <div class="login-hint">演示账号：member01 · member02 · member03 · member04 · member05 · member06 · admin</div>
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
            <div class="stat"><div class="num">${c.aidStations + c.aidPoints - c.aidStations}</div><div class="lbl">Aid Points</div></div>
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
    const expenses = SPARTAN_HUB.expensesByUser[user.id] || [];
    const gearMap = SPARTAN_HUB.gearStatusByUser[user.id] || {};
    const tasks = SPARTAN_HUB.tasksByUser[user.id] || [];

    const summary = Summary.summarizeExpenses(expenses);
    const gear = Summary.summarizeGear(SPARTAN_HUB.publicGear, gearMap);
    const tasksDone = tasks.filter(t => t.done).length;
    const upcomingTask = tasks.find(t => !t.done);

    return `
      <section class="section">
        <div class="container">
          <div class="dashboard-head">
            <div>
              <div class="sec-tag">My Dashboard</div>
              <div class="dashboard-name">你好，${user.name}</div>
              <div class="dashboard-meta">${user.group} · ${user.role === 'admin' ? '管理员' : '团队成员'} · SPARTAN SUPER BEAST 2026</div>
            </div>
            <button class="btn" data-action="logout">退出登录</button>
          </div>

          <div class="stat-grid">
            <div class="stat"><div class="label">应承担费用</div><div class="value">${money(summary.total)}</div></div>
            <div class="stat"><div class="label">已支付</div><div class="value green">${money(summary.paid)}</div></div>
            <div class="stat"><div class="label">待支付</div><div class="value ${summary.pending > 0 ? 'red' : 'green'}">${money(summary.pending)}</div></div>
            <div class="stat">
              <div class="label">物资准备</div>
              <div class="value purple">${gear.rate}%</div>
              <div class="progress"><span style="width:${gear.rate}%"></span></div>
              <div style="color:var(--muted);font-size:0.7rem;margin-top:6px;">${gear.ready} / ${gear.total} 已就位</div>
            </div>
          </div>

          <h3 style="font-family:var(--display);font-size:1.2rem;letter-spacing:2px;margin:24px 0 12px;color:var(--white);">费用明细</h3>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr><th>项目</th><th>类别</th><th class="num">应付</th><th class="num">已付</th><th class="num">待付</th><th>截止</th><th>状态</th></tr>
              </thead>
              <tbody>
                ${expenses.map(expense => {
                  const pending = expense.amount - expense.paid;
                  const status = Summary.expenseStatus(expense);
                  return `
                    <tr>
                      <td>${expense.item}</td>
                      <td>${expense.category}</td>
                      <td class="num">${money(expense.amount)}</td>
                      <td class="num">${money(expense.paid)}</td>
                      <td class="num">${money(pending)}</td>
                      <td>${expense.due}</td>
                      <td><span class="tag ${status}">${Summary.statusLabel(status)}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

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
                <input type="checkbox" data-task="${index}" ${task.done ? 'checked' : ''}>
                <span class="${task.done ? 'done' : ''}">${task.title}</span>
              </li>
            `).join('')}
          </ul>

          <div class="note">原型说明：所有数据保存在浏览器本地（localStorage），并不与他人同步，仅用于验证界面和流程。</div>
        </div>
      </section>
    `;
  }

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
        const index = Number(event.target.getAttribute('data-task'));
        const user = SPARTAN_HUB.users[state.user];
        if (user) {
          SPARTAN_HUB.tasksByUser[user.id][index].done = event.target.checked;
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

  function render() {
    const view = state.user && state.view === 'login' ? 'home' : state.view;
    const views = {
      home: renderHome,
      itinerary: renderItinerary,
      gear: renderGear,
      guides: renderGuides,
      dashboard: renderDashboard
    };
    $('#main').innerHTML = views[view]();
    renderNav();
    bindLogin();
    bindTasks();
    if (state.view === 'home' && window.SpartanWeather) {
      window.SpartanWeather.loadAndRender();
    }
  }

  function init() {
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
