// /api/v1/weather —— 实时天气代理（open-meteo，30 分钟内存缓存）
// 崇礼云顶坐标：40.97°N, 115.39°E，海拔约 1600m

const express = require('express');

const router = express.Router();

const LAT = 40.97;
const LON = 115.39;
const CACHE_MS = 30 * 60 * 1000;

let _cache = { at: 0, data: null, inflight: null };

async function fetchWeather() {
  if (_cache.data && Date.now() - _cache.at < CACHE_MS) return _cache.data;
  if (_cache.inflight) return _cache.inflight;

  _cache.inflight = (async () => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset` +
      `&forecast_days=5&timezone=Asia%2FShanghai`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`open-meteo HTTP ${res.status}`);
    const data = await res.json();
    _cache = { at: Date.now(), data, inflight: null };
    return data;
  })();

  try {
    return await _cache.inflight;
  } finally {
    _cache.inflight = null;
  }
}

router.get('/', async (_req, res) => {
  try {
    const data = await fetchWeather();
    res.json({
      cached: !!(Date.now() - _cache.at < CACHE_MS && _cache.data),
      cacheAgeSec: Math.floor((Date.now() - _cache.at) / 1000),
      data
    });
  } catch (e) {
    res.status(502).json({ error: 'weather_unavailable', message: e.message });
  }
});

module.exports = router;