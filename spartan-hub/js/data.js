// Prototype dataset for the Spartan Super Beast team hub.
// 第一版仅使用账号名登录，数据写在客户端，不代表真实权限控制。

window.SPARTAN_HUB = {
  event: {
    name: 'SPARTAN SUPER BEAST 2026',
    subtitle: '崇礼云顶站',
    seriesTag: 'NATIONAL SERIES · 2026',
    window: '2026.08.13 – 08.16',
    location: '河北张家口崇礼区云顶滑雪公园',
    status: 'preparation',
    heroBackground: '从广州到北京，从北京到崇礼。6 个人，49.6 公里，38 障碍 × 2 圈，2,318 米爬升，EARN YOUR 2026.',
    raceStart: '07:15'
  },

  course: {
    distanceKm: 49.6,
    obstacles: 38,
    loop1: 38,
    loop2: 34,
    totalChallenges: 72,
    climb: 2318,
    descent: 2274,
    aidStations: 8,
    aidPoints: 9,
    loops: 2,
    waterExempt: [17, 18, 20, 23],
    tier: 'ULTRA'
  },

  nav: [
    { id: 'home', label: '首页' },
    { id: 'itinerary', label: '行程预览' },
    { id: 'gear', label: '物资管理' },
    { id: 'guides', label: '比赛攻略' },
    { id: 'login', label: '登录', hideWhenAuth: true },
    { id: 'dashboard', label: '我的', requiresAuth: true, hideWhenGuest: true },
    { id: 'admin-announcements', label: '公告', requiresAuth: true, hideWhenGuest: true, adminOnly: true },
    { id: 'admin-expense', label: '费用', requiresAuth: true, hideWhenGuest: true, adminOnly: true },
    { id: 'admin-members', label: '成员', requiresAuth: true, hideWhenGuest: true, adminOnly: true },
    { id: 'logout', label: '退出', requiresAuth: true, hideWhenGuest: true }
  ],

  itinerary: [
    {
      id: 'prep-0812',
      date: '2026-08-12',
      weekday: '周三',
      title: '行前准备',
      summary: '装备检查、证件确认、行李打包、与第 6 人同步航班。',
      items: [
        { time: '全天', title: '装备检查', note: '越野跑鞋、手套、能量胶、盐丸、水袋背包、防水外套' },
        { time: '全天', title: '证件确认', note: '身份证、赛事报名二维码' },
        { time: 'PM', title: '与第 6 人同步航班', note: '确认到达首都机场时间一致' }
      ]
    },
    {
      id: 'day-0813',
      date: '2026-08-13',
      weekday: '周四',
      title: '广州 → 北京',
      summary: '夜航，凌晨抵达首都机场，过夜洗浴休息。',
      items: [
        { time: '19:00', title: '广州组集合', note: '番禺广场地铁站 5 人汇合' },
        { time: '19:10', title: '前往白云机场 T3', note: '网约车 65 km / 约 57 分钟' },
        { time: '21:15', title: 'HU7816 起飞', note: 'CAN T3 → PEK T2，约 3h10m', highlight: true },
        { time: '00:25+1', title: '抵达首都机场 T2', note: '与第 6 人汇合' },
        { time: '01:00', title: '京林洗浴过夜', note: '人均约 ¥82，含过夜费用', highlight: true }
      ]
    },
    {
      id: 'day-0814',
      date: '2026-08-14',
      weekday: '周五',
      title: '北京 → 崇礼',
      summary: '清晨赶高铁，入住云顶酒店，领取参赛包，赛前准备。',
      items: [
        { time: '05:30', title: '起床洗漱' },
        { time: '05:45', title: '前往北京北站', note: '网约车 40.5 km / 约 51 分钟' },
        { time: '07:29', title: 'G7831 出发', note: '北京北 → 太子城，约 1h23m，¥99', highlight: true },
        { time: '09:15', title: '入住云顶大酒店', note: '崇礼区四台嘴乡梧桐大道', highlight: true },
        { time: '13:00', title: '领取参赛包', note: '号码布、计时芯片、参赛服' },
        { time: '16:00', title: '温泉放松' },
        { time: '20:30', title: '早睡', note: '保证充足睡眠', highlight: true }
      ]
    },
    {
      id: 'day-0815',
      date: '2026-08-15',
      weekday: '周六',
      title: '比赛日',
      summary: '超级野兽赛 ULTRA · 49.6 km / 38 基础障碍 × 2 圈（第二圈涉水 4 项免挑战）· 我们 07:15 出发。',
      items: [
        { time: '05:00', title: '起床、简单早餐' },
        { time: '05:30', title: '热身、涂防晒、贴肌贴' },
        { time: '06:15', title: '前往起跑区（云顶滑雪公园内）' },
        { time: '06:30', title: '检录、存包' },
        { time: '07:15', title: '年龄段组出发（我们）', highlight: true },
        { time: '07:15–14:15', title: '第一圈：障碍 1–38 + 水站 1–8' },
        { time: '14:15', title: '换装点关门（24.79 km）', note: '15 分钟内必须离开换装点；超时取消资格并驱离赛道', highlight: true },
        { time: '15:45', title: '水站 1 关门（27.64 km）', note: '1,518 m 爬升', highlight: true },
        { time: '18:15', title: '水站 5 关门（40.18 km）', note: '1,819 m 爬升', highlight: true },
        { time: '19:30', title: '水站 6 关门（43.06 km）', note: '2,221 m 爬升', highlight: true },
        { time: '21:15', title: '终点关门（49.58 km）', note: '2,318 m 爬升 · 预计 14 小时完赛', highlight: true },
        { time: '22:00', title: '回酒店洗漱、温泉' },
        { time: '23:00', title: '庆功晚宴', note: 'USBY 音乐餐厅 / 满都拉', highlight: true }
      ]
    },
    {
      id: 'day-0816',
      date: '2026-08-16',
      weekday: '周日',
      title: '返程',
      summary: '崇礼 → 北京 → 广州，深夜到家。',
      items: [
        { time: '08:00', title: '早餐、收拾行李' },
        { time: '10:42', title: 'D9274 出发', note: '太子城 → 清河 / 北京北，¥79', highlight: true },
        { time: '13:30', title: '前往北京大兴机场' },
        { time: '21:50', title: 'MU6311 起飞', note: 'PKX → CAN T3，约 3h25m', highlight: true },
        { time: '01:15+1', title: '抵达广州白云 T3' },
        { time: '02:30', title: '回到番禺', highlight: true }
      ]
    }
  ],

  // 公共装备清单（与官方强制装备对齐）
  publicGear: [
    { level: 'mandatory',  category: '强制', name: '头带 / 计时芯片' },
    { level: 'mandatory',  category: '强制', name: 'GPS 芯片（仅限超级野兽）' },
    { level: 'mandatory',  category: '强制', name: '水袋背包 2L' },
    { level: 'mandatory',  category: '强制', name: '能量补给（胶/糖/盐丸）' },
    { level: 'mandatory',  category: '强制', name: '应急口哨' },
    { level: 'mandatory',  category: '强制', name: '应急毯 / 救生毯' },
    { level: 'recommended', category: '建议', name: '越野跑鞋（两双）' },
    { level: 'recommended', category: '建议', name: '盐丸 × 10' },
    { level: 'recommended', category: '建议', name: '全指手套' },
    { level: 'recommended', category: '建议', name: '压缩裤 / 短裤 × 2' },
    { level: 'recommended', category: '建议', name: '速干 T 恤 × 3' },
    { level: 'recommended', category: '建议', name: '防晒霜 SPF50+' },
    { level: 'recommended', category: '建议', name: '肌贴 / 运动绷带' },
    { level: 'recommended', category: '建议', name: '凡士林' },
    { level: 'optional',   category: '可选', name: '防水冲锋衣' },
    { level: 'optional',   category: '可选', name: '抓绒保暖层' },
    { level: 'optional',   category: '可选', name: '手机防水袋' },
    { level: 'optional',   category: '可选', name: '充电宝' },
    { level: 'optional',   category: '可选', name: 'GPS 运动手表' },
    { level: 'optional',   category: '可选', name: '创可贴 / 碘伏' },
    { level: 'optional',   category: '可选', name: '布洛芬 / 云南白药' }
  ],

  // 强制装备（来自 640 (1).webp 头带 + 计时芯片 + GPS）
  mandatoryGear: [
    '头带 / 计时芯片',
    'GPS 芯片（仅限超级野兽）',
    '水袋背包 2L',
    '能量补给',
    '应急口哨',
    '应急毯'
  ],

  // 8 个水站（来自《水站&关门时间》图，含段距离/总距/段爬升/总爬/段下降/总下降）
  aidStations: [
    { id: 1, name: '水站 1', legKm: 2.85, cumKm:  2.85, legUp: 359, cumUp:  359, legDown:  34, cumDown:   34 },
    { id: 2, name: '水站 2', legKm: 3.66, cumKm:  6.51, legUp: 167, cumUp:  526, legDown: 158, cumDown:  192 },
    { id: 3, name: '水站 3', legKm: 3.06, cumKm:  9.57, legUp:  12, cumUp:  538, legDown: 136, cumDown:  328 },
    { id: 4, name: '水站 4', legKm: 4.48, cumKm: 14.05, legUp: 118, cumUp:  656, legDown: 215, cumDown:  543 },
    { id: 5, name: '水站 5', legKm: 1.34, cumKm: 15.39, legUp:   4, cumUp:  660, legDown: 104, cumDown:  647 },
    { id: 6, name: '水站 6', legKm: 2.88, cumKm: 18.27, legUp: 402, cumUp: 1062, legDown:  14, cumDown:  661 },
    { id: 7, name: '水站 7', legKm: 3.47, cumKm: 21.74, legUp:  38, cumUp: 1100, legDown: 120, cumDown:  781 },
    { id: 8, name: '水站 8', legKm: 2.78, cumKm: 24.52, legUp:  19, cumUp: 1119, legDown:  62, cumDown:  843 }
  ],

  // 5 个关门点（只显示年龄段组，07:15 出发）
  cutoffs: [
    { id: 1, name: '换装点（折返）',  cumKm: 24.79, cumUp: 1159, cumDown: 1137, obstacles: '1–38',  waters: '1–8',  cutoff: '14:15' },
    { id: 2, name: '水站 1',         cumKm: 27.64, cumUp: 1518, cumDown: 1171, obstacles: '1–5',   waters: '1',    cutoff: '15:45' },
    { id: 3, name: '水站 5',         cumKm: 40.18, cumUp: 1819, cumDown: 1784, obstacles: '6–27',  waters: '2–5',  cutoff: '18:15' },
    { id: 4, name: '水站 6',         cumKm: 43.06, cumUp: 2221, cumDown: 1798, obstacles: '28–30', waters: '6',    cutoff: '19:30' },
    { id: 5, name: '终点',           cumKm: 49.58, cumUp: 2318, cumDown: 2274, obstacles: '31–38', waters: '7–8',  cutoff: '21:15' }
  ],

  startTime: '07:15',

  // 障碍清单：38 个基础障碍，跑两圈；第二圈涉水 #17 #18 #20 #23 免挑战
  obstacles: [
    { id: 1,  zh: '宙斯的惩罚',       en: 'SANDBAG CARRY' },
    { id: 2,  zh: '俄尔普斯之禁',     en: 'BARBED WIRE CRAWL' },
    { id: 3,  zh: '跨越高栏',         en: 'HURDLES' },
    { id: 4,  zh: '伊卡洛斯之翼',     en: '4 WALLS' },
    { id: 5,  zh: '三阶穿越',         en: 'O.U.T' },
    { id: 6,  zh: '迷宫巨绳',         en: 'PLATE DRAG' },
    { id: 7,  zh: '金苹果的守护',     en: 'ROPE CLIMB' },
    { id: 8,  zh: '跨越屋脊',         en: 'A-FRAME CARGO' },
    { id: 9,  zh: '胜利之矛',         en: 'SPEAR THROW' },
    { id: 10, zh: '阿特拉斯之石',     en: 'ATLAS CARRY' },
    { id: 11, zh: '冥河',             en: 'SWIM' },
    { id: 12, zh: '逆水之渡',         en: 'INVERTED WALL' },
    { id: 13, zh: '奥德修斯之弓',     en: 'BOW DRAW' },
    { id: 14, zh: '神车巨轮',         en: 'HEAVY ROLL' },
    { id: 15, zh: '神殿基石',         en: 'TEMPLE BASE' },
    { id: 16, zh: '人猿泰山',         en: 'TARZAN' },
    { id: 17, zh: '泅渡',             en: 'RIVER CROSS',   water: true },
    { id: 18, zh: '俄底斯河',         en: 'STYX RIVER',    water: true },
    { id: 19, zh: '飞檐走壁',         en: 'WALL CLIMB' },
    { id: 20, zh: '海格力斯之锤',     en: 'HERCULES HAMMER', water: true },
    { id: 21, zh: '泰索斯坡',         en: 'TETHYS SLOPE' },
    { id: 22, zh: '鹤超奥林匹斯',     en: 'OLYMPUS VAULT' },
    { id: 23, zh: '冥河洗礼',         en: 'STYX BAPTISM',  water: true },
    { id: 24, zh: '雅各布天梯',       en: "JACOB'S LADDER" },
    { id: 25, zh: '跨越摩脊 2',       en: 'RIDGE CROSS 2' },
    { id: 26, zh: '海格力斯之犁',     en: 'HERCULES PLOW' },
    { id: 27, zh: '俄尔普斯之径',     en: 'ORPHEUS PATH' },
    { id: 28, zh: '神车巨轮 2',       en: 'HEAVY ROLL 2' },
    { id: 29, zh: '泰坦的陨落',       en: 'TITAN FALL' },
    { id: 30, zh: '逆神之战',         en: 'TITAN CARRY' },
    { id: 31, zh: '海德拉的试炼',     en: 'HYDRA' },
    { id: 32, zh: '宙斯的惩罚 2.0',   en: 'SANDBAG CARRY 2.0' },
    { id: 33, zh: '胜利之矛 2.0',     en: 'SPEAR THROW 2.0' },
    { id: 34, zh: '泰坦的陨落',       en: 'ARMER' },
    { id: 35, zh: '逆神之战',         en: 'CHAIN CARRY' },
    { id: 36, zh: '生命之绳',         en: 'TYROLEAN TRAVERSE' },
    { id: 37, zh: '神车巨轮 3',       en: 'HEAVY ROLL 3' },
    { id: 38, zh: '神车巨轮 4',       en: 'HEAVY ROLL 4' }
  ],

  guides: [
    { category: '赛前准备', title: '出发前 24 小时', body: '8/14 上午补觉，下午 13:00–15:00 领参赛包，赛道预览，温泉放松，20:30 早睡。' },
    { category: '赛前准备', title: '比赛当天起床流程', body: '05:00 起床简单早餐（面包、香蕉、能量棒），05:30 热身，涂防晒与凡士林，贴肌贴。' },
    { category: '比赛策略', title: '配速与障碍', body: '前 20 km 控制心率，不要被其他选手拉快节奏；遇到障碍失败立即按规则完成波比跳，避免硬撑。' },
    { category: '比赛策略', title: '补给节奏', body: '每 60–90 分钟一条能量胶，每小时 2–3 粒盐丸；少量多次补水，避免一次性大量饮水。' },
    { category: '装备建议', title: '鞋与手套', body: '比赛用鞋提前适应 30 km+，带备用鞋避免湿鞋；全指手套防磨起水泡。' },
    { category: '装备建议', title: '防水与保暖', body: '山区雷雨概率高，存包处备一套干衣和保暖层，赛后快速更换。' },
    { category: '天气与海拔', title: '崇礼 8 月', body: '白天 25–30°C，夜间 14–18°C，海拔 1600 m，注意温差与雷雨。' },
    { category: '赛后恢复', title: '完赛之后', body: '领取奖牌与完赛 T 恤，19:00 回酒店泡温泉，20:00 庆功晚宴，避免立即久坐。' }
  ],

  users: {
    chener:      { id: 'm1', name: '陈尔',   role: 'member', group: '广州组' },
    zhangyi:     { id: 'm2', name: '张毅',   role: 'member', group: '广州组' },
    panbin:      { id: 'm3', name: '潘斌',   role: 'member', group: '广州组' },
    xuwei:       { id: 'm4', name: '徐伟',   role: 'member', group: '广州组' },
    xuxiaoyong:  { id: 'm5', name: '徐晓勇', role: 'member', group: '广州组' },
    zhousong:    { id: 'm6', name: '周松',   role: 'member', group: '广州组' },
    admin:       { id: 'a1', name: '管理员', role: 'admin',  group: '组织方' }
  },

  // 费用大项（管理员录入）—— 模仿 expense_items 表
  expenseItems: [
    {
      id: 'ei-001',
      title: '云顶大酒店拼房 2 晚',
      category: '住宿',
      amountCents: 96000,
      status: 'unpaid',
      note: '6 人合住，标准间 3 间',
      createdBy: 'a1'
    },
    {
      id: 'ei-002',
      title: '斯巴达报名费',
      category: '赛事',
      amountCents: 420000,
      status: 'partial',
      note: '6 人 × ¥700',
      createdBy: 'a1'
    },
    {
      id: 'ei-003',
      title: '北京⇌太子城高铁',
      category: '交通',
      amountCents: 59400,
      status: 'partial',
      note: '6 人往返 × ¥99（仅去程）',
      createdBy: 'a1'
    },
    {
      id: 'ei-004',
      title: '庆功晚宴 USBY 餐厅',
      category: '餐饮',
      amountCents: 18000,
      status: 'unpaid',
      note: '6 人聚餐预算',
      createdBy: 'a1'
    }
  ],

  // 费用分摊（成员+金额）—— 模仿 expense_splits 表
  expenseSplits: [
    // ei-001 住宿 96000 / 6 = 16000 每人
    { id: 'sp-001', itemId: 'ei-001', memberId: 'm1', amountCents: 16000, paidStatus: 'paid' },
    { id: 'sp-002', itemId: 'ei-001', memberId: 'm2', amountCents: 16000, paidStatus: 'partial' },
    { id: 'sp-003', itemId: 'ei-001', memberId: 'm3', amountCents: 16000, paidStatus: 'paid' },
    { id: 'sp-004', itemId: 'ei-001', memberId: 'm4', amountCents: 16000, paidStatus: 'unpaid' },
    { id: 'sp-005', itemId: 'ei-001', memberId: 'm5', amountCents: 16000, paidStatus: 'paid' },
    { id: 'sp-006', itemId: 'ei-001', memberId: 'm6', amountCents: 16000, paidStatus: 'paid' },
    // ei-002 报名费 420000 / 6 = 70000 每人
    { id: 'sp-007', itemId: 'ei-002', memberId: 'm1', amountCents: 70000, paidStatus: 'paid' },
    { id: 'sp-008', itemId: 'ei-002', memberId: 'm2', amountCents: 70000, paidStatus: 'paid' },
    { id: 'sp-009', itemId: 'ei-002', memberId: 'm3', amountCents: 70000, paidStatus: 'paid' },
    { id: 'sp-010', itemId: 'ei-002', memberId: 'm4', amountCents: 70000, paidStatus: 'paid' },
    { id: 'sp-011', itemId: 'ei-002', memberId: 'm5', amountCents: 70000, paidStatus: 'partial' },
    { id: 'sp-012', itemId: 'ei-002', memberId: 'm6', amountCents: 70000, paidStatus: 'unpaid' },
    // ei-003 高铁 59400 / 6 = 9900 每人
    { id: 'sp-013', itemId: 'ei-003', memberId: 'm1', amountCents: 9900, paidStatus: 'paid' },
    { id: 'sp-014', itemId: 'ei-003', memberId: 'm2', amountCents: 9900, paidStatus: 'paid' },
    { id: 'sp-015', itemId: 'ei-003', memberId: 'm3', amountCents: 9900, paidStatus: 'paid' },
    { id: 'sp-016', itemId: 'ei-003', memberId: 'm4', amountCents: 9900, paidStatus: 'unpaid' },
    { id: 'sp-017', itemId: 'ei-003', memberId: 'm5', amountCents: 9900, paidStatus: 'paid' },
    { id: 'sp-018', itemId: 'ei-003', memberId: 'm6', amountCents: 9900, paidStatus: 'unpaid' },
    // ei-004 庆功 18000 / 6 = 3000 每人
    { id: 'sp-019', itemId: 'ei-004', memberId: 'm1', amountCents: 3000, paidStatus: 'unpaid' },
    { id: 'sp-020', itemId: 'ei-004', memberId: 'm2', amountCents: 3000, paidStatus: 'unpaid' },
    { id: 'sp-021', itemId: 'ei-004', memberId: 'm3', amountCents: 3000, paidStatus: 'unpaid' },
    { id: 'sp-022', itemId: 'ei-004', memberId: 'm4', amountCents: 3000, paidStatus: 'unpaid' },
    { id: 'sp-023', itemId: 'ei-004', memberId: 'm5', amountCents: 3000, paidStatus: 'unpaid' },
    { id: 'sp-024', itemId: 'ei-004', memberId: 'm6', amountCents: 3000, paidStatus: 'unpaid' }
  ],

  gearStatusByUser: {
    m1: { '越野跑鞋（两双）': 1, '水袋背包 2L': 1, '能量补给（胶/糖/盐丸）': 2, '盐丸 × 10': 1, '全指手套': 1, '防水冲锋衣': 3, '头带 / 计时芯片': 1 },
    m2: { '越野跑鞋（两双）': 3, '水袋背包 2L': 1, '能量补给（胶/糖/盐丸）': 2, '盐丸 × 10': 2, '全指手套': 1, '防水冲锋衣': 0, '头带 / 计时芯片': 1 },
    m3: { '越野跑鞋（两双）': 1, '水袋背包 2L': 3, '能量补给（胶/糖/盐丸）': 1, '盐丸 × 10': 1, '全指手套': 1, '防水冲锋衣': 1, '头带 / 计时芯片': 1 },
    m4: { '越野跑鞋（两双）': 2, '水袋背包 2L': 0, '能量补给（胶/糖/盐丸）': 0, '盐丸 × 10': 0, '全指手套': 0, '防水冲锋衣': 0, '头带 / 计时芯片': 1 },
    m5: { '越野跑鞋（两双）': 1, '水袋背包 2L': 1, '能量补给（胶/糖/盐丸）': 3, '盐丸 × 10': 3, '全指手套': 1, '防水冲锋衣': 1, '头带 / 计时芯片': 1 },
    m6: { '越野跑鞋（两双）': 0, '水袋背包 2L': 0, '能量补给（胶/糖/盐丸）': 0, '盐丸 × 10': 0, '全指手套': 0, '防水冲锋衣': 0, '头带 / 计时芯片': 1 }
  },

  decisions: [
    { title: '过夜场所', pick: '京林洗浴', reason: '距离机场近，性价比高' },
    { title: '去程高铁', pick: 'G7831 07:29', reason: '到达早，休息时间多' },
    { title: '酒店交通', pick: '网约车', reason: '5.2 km，约 8 分钟' },
    { title: '返程高铁', pick: 'D9274 10:42', reason: '给大兴机场留出时间' },
    { title: '大兴交通', pick: '网约车', reason: '快速省心' }
  ],

  announcements: [
    { title: '8/13 19:00 番禺广场集合',  priority: 'high', time: '2026-08-10' },
    { title: 'G7831 票已统一出票',        priority: 'mid',  time: '2026-08-05' },
    { title: '赛事规则更新：障碍 #14 调整', priority: 'low',  time: '2026-08-08' }
  ],

  tasksByUser: {
    m1: [{ title: '8/12 完成装备检查', done: true }, { title: '8/13 19:00 番禺广场集合', done: false }],
    m2: [{ title: '购买能量胶 8 条', done: false }, { title: '赛前与队友同步 8/14 早餐安排', done: false }],
    m3: [{ title: '8/12 前测试 GPS 手表', done: true }],
    m4: [{ title: '支付云顶酒店拼房 ¥800', done: false }, { title: '购买越野跑鞋', done: false }],
    m5: [{ title: '完成赛事报名费尾款 ¥409', done: false }],
    m6: [{ title: '8/13 前确认北京汇合航班', done: true }, { title: '支付高铁票 ¥178', done: false }]
  }
};
