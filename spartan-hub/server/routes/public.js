// /api/v1/public/* —— 公共读接口
// 静态赛事信息，从客户端原型 data.js 中沉淀为常量。
// 这里以 JSON 返回，前端可以从 window.SPARTAN_HUB.event 切到 fetch('/api/v1/public/event')。

const express = require('express');
const router = express.Router();

// 与前端原型 js/data.js 对齐
const EVENT = {
  name: 'SPARTAN SUPER BEAST 2026',
  subtitle: '崇礼云顶站',
  seriesTag: 'NATIONAL SERIES · 2026',
  window: '2026.08.13 – 08.16',
  location: '河北张家口崇礼区云顶滑雪公园',
  status: 'preparation',
  heroBackground: '从广州到北京，从北京到崇礼。6 个人，49.6 公里，38 障碍 × 2 圈，2,318 米爬升，EARN YOUR 2026.',
  raceStart: '07:15'
};

const COURSE = {
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
};

const AID_STATIONS = [
  { id: 1, name: '水站 1', legKm: 2.85, cumKm:  2.85, legUp: 359, cumUp:  359, legDown:  34, cumDown:   34 },
  { id: 2, name: '水站 2', legKm: 3.66, cumKm:  6.51, legUp: 167, cumUp:  526, legDown: 158, cumDown:  192 },
  { id: 3, name: '水站 3', legKm: 3.06, cumKm:  9.57, legUp:  12, cumUp:  538, legDown: 136, cumDown:  328 },
  { id: 4, name: '水站 4', legKm: 4.48, cumKm: 14.05, legUp: 118, cumUp:  656, legDown: 215, cumDown:  543 },
  { id: 5, name: '水站 5', legKm: 1.34, cumKm: 15.39, legUp:   4, cumUp:  660, legDown: 104, cumDown:  647 },
  { id: 6, name: '水站 6', legKm: 2.88, cumKm: 18.27, legUp: 402, cumUp: 1062, legDown:  14, cumDown:  661 },
  { id: 7, name: '水站 7', legKm: 3.47, cumKm: 21.74, legUp:  38, cumUp: 1100, legDown: 120, cumDown:  781 },
  { id: 8, name: '水站 8', legKm: 2.78, cumKm: 24.52, legUp:  19, cumUp: 1119, legDown:  62, cumDown:  843 }
];

const CUTOFFS = [
  { id: 1, name: '换装点（折返）',  cumKm: 24.79, cumUp: 1159, cumDown: 1137, obstacles: '1–38',  waters: '1–8',  cutoff: '14:15' },
  { id: 2, name: '水站 1',         cumKm: 27.64, cumUp: 1518, cumDown: 1171, obstacles: '1–5',   waters: '1',    cutoff: '15:45' },
  { id: 3, name: '水站 5',         cumKm: 40.18, cumUp: 1819, cumDown: 1784, obstacles: '6–27',  waters: '2–5',  cutoff: '18:15' },
  { id: 4, name: '水站 6',         cumKm: 43.06, cumUp: 2221, cumDown: 1798, obstacles: '28–30', waters: '6',    cutoff: '19:30' },
  { id: 5, name: '终点',           cumKm: 49.58, cumUp: 2318, cumDown: 2274, obstacles: '31–38', waters: '7–8',  cutoff: '21:15' }
];

const OBSTACLES = [
  { id: 1,  zh: '宙斯的惩罚',     en: 'SANDBAG CARRY' },
  { id: 2,  zh: '俄尔普斯之禁',   en: 'BARBED WIRE CRAWL' },
  { id: 3,  zh: '跨越高栏',       en: 'HURDLES' },
  { id: 4,  zh: '伊卡洛斯之翼',   en: '4 WALLS' },
  { id: 5,  zh: '三阶穿越',       en: 'O.U.T' },
  { id: 6,  zh: '迷宫巨绳',       en: 'PLATE DRAG' },
  { id: 7,  zh: '金苹果的守护',   en: 'ROPE CLIMB' },
  { id: 8,  zh: '跨越屋脊',       en: 'A-FRAME CARGO' },
  { id: 9,  zh: '胜利之矛',       en: 'SPEAR THROW' },
  { id: 10, zh: '阿特拉斯之石',   en: 'ATLAS CARRY' },
  { id: 11, zh: '冥河',           en: 'SWIM' },
  { id: 12, zh: '逆水之渡',       en: 'INVERTED WALL' },
  { id: 13, zh: '奥德修斯之弓',   en: 'BOW DRAW' },
  { id: 14, zh: '神车巨轮',       en: 'HEAVY ROLL' },
  { id: 15, zh: '神殿基石',       en: 'TEMPLE BASE' },
  { id: 16, zh: '人猿泰山',       en: 'TARZAN' },
  { id: 17, zh: '泅渡',           en: 'RIVER CROSS',   water: true },
  { id: 18, zh: '俄底斯河',       en: 'STYX RIVER',    water: true },
  { id: 19, zh: '飞檐走壁',       en: 'WALL CLIMB' },
  { id: 20, zh: '海格力斯之锤',   en: 'HERCULES HAMMER', water: true },
  { id: 21, zh: '泰索斯坡',       en: 'TETHYS SLOPE' },
  { id: 22, zh: '鹤超奥林匹斯',   en: 'OLYMPUS VAULT' },
  { id: 23, zh: '冥河洗礼',       en: 'STYX BAPTISM',  water: true },
  { id: 24, zh: '雅各布天梯',     en: "JACOB'S LADDER" },
  { id: 25, zh: '跨越摩脊 2',     en: 'RIDGE CROSS 2' },
  { id: 26, zh: '海格力斯之犁',   en: 'HERCULES PLOW' },
  { id: 27, zh: '俄尔普斯之径',   en: 'ORPHEUS PATH' },
  { id: 28, zh: '神车巨轮 2',     en: 'HEAVY ROLL 2' },
  { id: 29, zh: '泰坦的陨落',     en: 'TITAN FALL' },
  { id: 30, zh: '逆神之战',       en: 'TITAN CARRY' },
  { id: 31, zh: '海德拉的试炼',   en: 'HYDRA' },
  { id: 32, zh: '宙斯的惩罚 2.0', en: 'SANDBAG CARRY 2.0' },
  { id: 33, zh: '胜利之矛 2.0',   en: 'SPEAR THROW 2.0' },
  { id: 34, zh: '泰坦的陨落',     en: 'ARMER' },
  { id: 35, zh: '逆神之战',       en: 'CHAIN CARRY' },
  { id: 36, zh: '生命之绳',       en: 'TYROLEAN TRAVERSE' },
  { id: 37, zh: '神车巨轮 3',     en: 'HEAVY ROLL 3' },
  { id: 38, zh: '神车巨轮 4',     en: 'HEAVY ROLL 4' }
];

router.get('/event', (_req, res) => res.json(EVENT));
router.get('/course', (_req, res) => res.json(COURSE));
router.get('/aid-stations', (_req, res) => res.json(AID_STATIONS));
router.get('/cutoffs', (_req, res) => res.json(CUTOFFS));
router.get('/obstacles', (_req, res) => res.json(OBSTACLES));

const PUBLIC_GEAR = [
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
];
router.get('/gear', (_req, res) => res.json({ gear: PUBLIC_GEAR }));

module.exports = router;