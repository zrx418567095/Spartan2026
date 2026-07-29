// 实时天气：Open-Meteo（无需 key）
// 目标地点：河北崇礼云顶滑雪公园
// 接口：https://api.open-meteo.com/v1/forecast

window.SpartanWeather = {
  location: { name: '崇礼云顶滑雪公园', lat: 40.971, lon: 115.135, elevation: 1600 },
  STORAGE_KEY: 'spartan-hub-weather',
  TTL: 30 * 60 * 1000, // 30 分钟缓存

  // 天气代码 → 中文 / 图标
  codeMap: {
    0:  { text: '晴',       icon: '☀️' },
    1:  { text: '大致晴朗', icon: '🌤️' },
    2:  { text: '局部多云', icon: '⛅' },
    3:  { text: '阴',       icon: '☁️' },
    45: { text: '雾',       icon: '🌫️' },
    48: { text: '冰雾',     icon: '🌫️' },
    51: { text: '小毛毛雨', icon: '🌦️' },
    53: { text: '毛毛雨',   icon: '🌦️' },
    55: { text: '大毛毛雨', icon: '🌧️' },
    61: { text: '小雨',     icon: '🌦️' },
    63: { text: '中雨',     icon: '🌧️' },
    65: { text: '大雨',     icon: '🌧️' },
    71: { text: '小雪',     icon: '🌨️' },
    73: { text: '中雪',     icon: '❄️' },
    75: { text: '大雪',     icon: '❄️' },
    80: { text: '阵雨',     icon: '🌦️' },
    81: { text: '强阵雨',   icon: '🌧️' },
    82: { text: '暴阵雨',   icon: '⛈️' },
    95: { text: '雷暴',     icon: '⛈️' },
    96: { text: '雷暴冰雹', icon: '⛈️' },
    99: { text: '强雷暴',   icon: '⛈️' }
  },

  buildUrl() {
    const { lat, lon } = this.location;
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m',
      hourly: 'temperature_2m,weather_code,precipitation_probability',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,uv_index_max',
      forecast_days: 7,
      timezone: 'Asia/Shanghai'
    });
    return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  },

  describe(code) {
    return this.codeMap[code] || { text: '未知', icon: '❓' };
  },

  formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
  },

  formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  readCache() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Date.now() - data.timestamp > this.TTL) return null;
      return data;
    } catch (_) {
      return null;
    }
  },

  writeCache(payload) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ ...payload, timestamp: Date.now() }));
    } catch (_) { /* ignore */ }
  },

  async fetch() {
    const cached = this.readCache();
    if (cached) return { ...cached, cached: true };

    const res = await fetch(this.buildUrl());
    if (!res.ok) throw new Error(`天气接口 ${res.status}`);
    const data = await res.json();
    this.writeCache(data);
    return { ...data, cached: false };
  },

  render() {
    const loc = this.location;
    return `
      <section class="weather" id="weather">
        <div class="weather-inner">
          <div class="sec-tag">Live · Open-Meteo</div>
          <h2 class="sec-title">崇礼云顶 · 实时天气</h2>
          <div class="sec-line"></div>
          <div class="weather-card" id="weatherCard">
            <div class="weather-loading">
              <div class="spinner"></div>
              <span>正在拉取最新预报…</span>
            </div>
          </div>
          <p class="weather-source">数据源：<a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> · 自动 30 分钟刷新 · 海拔 ${loc.elevation} m</p>
        </div>
      </section>
    `;
  },

  renderCard(data) {
    const loc = this.location;
    const cur = data.current || {};
    const daily = (data.daily && data.daily.time) || [];
    const desc = this.describe(cur.weather_code);
    const cachedTag = data.cached ? '<span class="cache-tag">缓存</span>' : '<span class="cache-tag fresh">实时</span>';
    const hourly = (data.hourly && data.hourly.time) || [];
    const startIdx = hourly.findIndex(t => new Date(t).getTime() >= Date.now() - 30 * 60 * 1000);
    const nextHours = startIdx >= 0 ? hourly.slice(startIdx, startIdx + 8) : hourly.slice(0, 8);

    return `
      <div class="weather-now">
        <div class="weather-now-left">
          <div class="weather-icon">${desc.icon}</div>
          <div>
            <div class="weather-temp">${Math.round(cur.temperature_2m ?? 0)}<span>°C</span></div>
            <div class="weather-cond">${desc.text} · 体感 ${Math.round(cur.apparent_temperature ?? cur.temperature_2m ?? 0)}°C</div>
            <div class="weather-meta">${loc.name} · 风速 ${Math.round(cur.wind_speed_10m ?? 0)} km/h</div>
          </div>
        </div>
        <div class="weather-now-right">
          ${cachedTag}
          <button class="btn small" id="weatherRefresh">刷新</button>
        </div>
      </div>

      <div class="weather-daily">
        ${daily.slice(0, 7).map((day, i) => {
          const code = data.daily.weather_code[i];
          const tMax = data.daily.temperature_2m_max[i];
          const tMin = data.daily.temperature_2m_min[i];
          const rain = data.daily.precipitation_probability_max[i];
          const uv = data.daily.uv_index_max ? data.daily.uv_index_max[i] : null;
          const d = this.describe(code);
          return `
            <div class="weather-day ${i === 0 ? 'today' : ''}">
              <div class="d-name">${i === 0 ? '今天' : this.formatDate(day)}</div>
              <div class="d-icon">${d.icon}</div>
              <div class="d-cond">${d.text}</div>
              <div class="d-temp">${Math.round(tMax)}° / ${Math.round(tMin)}°</div>
              <div class="d-meta">降水 ${rain ?? 0}%${uv != null ? ` · UV ${uv.toFixed(1)}` : ''}</div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="weather-hourly">
        <h4>未来 8 小时</h4>
        <div class="hourly-strip">
          ${nextHours.map((t, idx) => {
            const realIdx = startIdx >= 0 ? startIdx + idx : idx;
            const code = data.hourly.weather_code[realIdx];
            const temp = data.hourly.temperature_2m[realIdx];
            const pop = data.hourly.precipitation_probability ? data.hourly.precipitation_probability[realIdx] : null;
            const d = this.describe(code);
            return `
              <div class="hour">
                <div class="h-time">${t.slice(11, 16)}</div>
                <div class="h-icon">${d.icon}</div>
                <div class="h-temp">${Math.round(temp)}°</div>
                ${pop != null ? `<div class="h-rain">${pop}%</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  renderError(err) {
    return `
      <div class="weather-now">
        <div class="weather-now-left">
          <div class="weather-icon">⚠️</div>
          <div>
            <div class="weather-temp">--<span>°C</span></div>
            <div class="weather-cond">天气数据获取失败</div>
            <div class="weather-meta">${err && err.message ? err.message : '请检查网络后重试'}</div>
          </div>
        </div>
        <div class="weather-now-right">
          <button class="btn small" id="weatherRefresh">重试</button>
        </div>
      </div>
    `;
  },

  async loadAndRender() {
    const card = document.getElementById('weatherCard');
    if (!card) return;
    try {
      const data = await this.fetch();
      card.innerHTML = this.renderCard(data);
    } catch (err) {
      card.innerHTML = this.renderError(err);
    }
    const refresh = document.getElementById('weatherRefresh');
    if (refresh) refresh.addEventListener('click', () => {
      try { localStorage.removeItem(this.STORAGE_KEY); } catch (_) {}
      this.loadAndRender();
    });
  }
};
