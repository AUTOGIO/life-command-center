/* =============================================
   LIFE COMMAND CENTER — app.js
   Eduardo Giovannini · life.giovannini.us
   =============================================
   All state is stored in memory (no localStorage — using
   a simple in-memory object that resets on refresh).
   For persistence that survives refresh, we use the
   sessionStorage fallback pattern.
   ============================================= */

// ── TIDE ENGINE (DNPVN 2026 — Porto de Cabedelo) ─────────────────────────
// Dynamically imported so the main thread isn't blocked.
// Loaded once at init(); all subsequent calls are synchronous in-memory.
let tideEngine = null; // module reference, set after dynamic import

async function initTides() {
  try {
    tideEngine = await import('./tides.js');
    await tideEngine.loadTides();
    console.log('[tides] DNPVN 2026 loaded — 44 harmonic components, Porto de Cabedelo');
    // Immediately render tide section with exact data
    renderTideFromDNPVN();
  } catch (e) {
    console.warn('[tides] Failed to load DNPVN table, falling back to Open-Meteo:', e);
  }
}

function renderTideFromDNPVN() {
  if (!tideEngine) return;
  const result = tideEngine.getTideAt(Date.now());
  if (!result) return;
  const { levelStr, trendLabel, trendArrow, nextExtremeLabel } = tideEngine.formatTide(result);

  // Tide bar: range from today's extremes for context
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const todayEvents = tideEngine.getEventsForDate(ymd);
  const heights = todayEvents.map(e => e.height);
  const minH = heights.length ? Math.min(...heights) : 0;
  const maxH = heights.length ? Math.max(...heights) : 2.5;
  const normPct = maxH > minH ? Math.round(((result.height - minH) / (maxH - minH)) * 100) : 50;

  // Update DOM
  const tideCurrent = document.getElementById('tideCurrent');
  if (tideCurrent) tideCurrent.textContent = levelStr;
  const tideLabel = document.getElementById('tideTrendLabel');
  if (tideLabel) tideLabel.textContent = `${trendLabel} ${trendArrow}`.trim();
  const tideBar = document.getElementById('tideBarFill');
  if (tideBar) tideBar.style.width = `${normPct}%`;
  const tideNext = document.getElementById('tideTrendNext');
  if (tideNext) tideNext.textContent = `→ ${nextExtremeLabel}`;

  STATE.tides = { level: result.height, trend: result.trend,
                  rising: result.trend === 'rising', source: 'DNPVN' };

  // ── Tide status column in conditions table
  const tideStatusEl = document.getElementById('condStatusTide');
  if (tideStatusEl) {
    tideStatusEl.textContent = `${levelStr} ${trendArrow}`;
    tideStatusEl.className = 'cond-status cond-info';
  }

  // ── Rebuild tide curve SVG
  buildTideCurve();
}

function buildTideCurve() {
  if (!tideEngine) return;
  const svg = document.getElementById('tideCurveSvg');
  if (!svg) return;

  const now = new Date();
  const ymd = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const todayEvts = tideEngine.getEventsForDate(ymd);
  if (!todayEvts || !todayEvts.length) return;

  const heights = todayEvts.map(e => e.height);
  const minH = Math.min(...heights);
  const maxH = Math.max(...heights);
  const range = maxH - minH || 1;

  const W = 300, H = 60, PAD_T = 8, PAD_B = 10;
  const plotH = H - PAD_T - PAD_B;
  const dayStart = new Date(`${ymd}T00:00:00-03:00`).getTime();

  // Sample every 30 min — 48 points
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const ms = dayStart + i * 30 * 60 * 1000;
    const r  = tideEngine.getTideAt(ms);
    if (!r) continue;
    const x = (i / 48) * W;
    const y = PAD_T + plotH - ((r.level - minH) / range) * plotH;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  // Current time marker
  const nowFrac = Math.max(0, Math.min(1, (Date.now() - dayStart) / 86400000));
  const nowX    = (nowFrac * W).toFixed(1);
  const nowY    = (() => {
    const r = tideEngine.getTideAt(Date.now());
    if (!r) return ((H - PAD_B) / 2).toFixed(1);
    return (PAD_T + plotH - ((r.level - minH) / range) * plotH).toFixed(1);
  })();

  const yLo = (H - PAD_B).toFixed(1);
  const yHi = PAD_T.toFixed(1);

  // High/Low labels on curve
  const extremeLabels = todayEvts.map(ev => {
    const iso = ev.iso;
    const t   = new Date(iso + '-03:00');
    const fracT = (t.getTime() - dayStart) / 86400000;
    const x = (fracT * W).toFixed(1);
    const y = PAD_T + plotH - ((ev.height - minH) / range) * plotH;
    const labelY = ev.type === 'H' ? (y - 4).toFixed(1) : (y + 9).toFixed(1);
    const anchor = fracT < 0.1 ? 'start' : fracT > 0.9 ? 'end' : 'middle';
    return `<text x="${x}" y="${labelY}" text-anchor="${anchor}" font-size="6.5"
      fill="var(--color-amber)" font-family="'JetBrains Mono',monospace" font-weight="700">
      ${ev.type === 'H' ? 'H' : 'L'} ${ev.height.toFixed(2)}m
    </text>`;
  }).join('');

  svg.innerHTML = `
    <line x1="0" y1="${yLo}" x2="${W}" y2="${yLo}" stroke="var(--color-border)" stroke-width="0.5"/>
    <line x1="${W*0.25}" y1="${PAD_T}" x2="${W*0.25}" y2="${yLo}" stroke="var(--color-border)" stroke-width="0.4" stroke-dasharray="2 2"/>
    <line x1="${W*0.5}"  y1="${PAD_T}" x2="${W*0.5}"  y2="${yLo}" stroke="var(--color-border)" stroke-width="0.4" stroke-dasharray="2 2"/>
    <line x1="${W*0.75}" y1="${PAD_T}" x2="${W*0.75}" y2="${yLo}" stroke="var(--color-border)" stroke-width="0.4" stroke-dasharray="2 2"/>
    <polygon points="0,${yLo} ${pts.join(' ')} ${W},${yLo}" fill="var(--color-primary)" fill-opacity="0.12"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="var(--color-primary)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
    <line x1="${nowX}" y1="${PAD_T}" x2="${nowX}" y2="${yLo}" stroke="var(--color-amber)" stroke-width="1.5"/>
    <circle cx="${nowX}" cy="${nowY}" r="2.5" fill="var(--color-amber)"/>
    ${extremeLabels}
    <text x="2" y="${PAD_T}" dominant-baseline="hanging" font-size="6.5" fill="var(--color-text-muted)" font-family="'JetBrains Mono',monospace">${maxH.toFixed(1)}m</text>
    <text x="2" y="${yLo}" dominant-baseline="auto" font-size="6.5" fill="var(--color-text-muted)" font-family="'JetBrains Mono',monospace">${minH.toFixed(1)}m</text>
  `;
}

// ── STATE ──────────────────────────────────────────────────────────────────
const STATE = {
  settings: {
    lat: -7.115,
    lon: -34.863,
    minWind: 18,
    shoulderDaysLeft: 3,
    kiteStatus: 'repair', // 'repair' | 'ready'
  },
  habits: [
    { id: 'gym',       emoji: '🏋️', name: 'Gym',         streak: 0, done: false, blocked: false },
    { id: 'kite',      emoji: '🪁', name: 'Kitesurfing',  streak: 0, done: false, blocked: false },
    { id: 'muay',      emoji: '🥊', name: 'Muay Thai',    streak: 0, done: false, blocked: true  },
    { id: 'dogs',      emoji: '🐕', name: 'Dog Training', streak: 0, done: false, blocked: false },
  ],
  projects: [
    { id: 1, name: 'GMC Portfolio Dashboard', priority: 'high',   active: false },
    { id: 2, name: 'PersonalLifeOS',          priority: 'high',   active: false },
    { id: 3, name: 'MCP Integration',         priority: 'medium', active: false },
    { id: 4, name: 'AI Automation Scripts',   priority: 'medium', active: false },
  ],
  nextProjectId: 5,
  selectedMood: null,
  notes: '',
  session: { active: false, projectId: null, startTime: null, elapsed: 0 },
  sessionTimer: null,
  heatmap: [], // Array of 28 objects {date, score}
  weather: null,
  tides: null,
  conditionsOk: null,
};

// ── PERSISTENCE (localStorage) ───────────────────────────────────────────────
const LS_KEY = 'lifeOS_v1';

function restoreState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // Shoulder recovery
      if (typeof saved.shoulderDaysLeft === 'number') {
        STATE.settings.shoulderDaysLeft = saved.shoulderDaysLeft;
      }
      if (saved.shoulderStartDate) {
        STATE.settings.shoulderStartDate = saved.shoulderStartDate;
      }
      // Kite status
      if (saved.kiteStatus) STATE.settings.kiteStatus = saved.kiteStatus;
      // Habits: restore done + streak
      if (Array.isArray(saved.habits)) {
        saved.habits.forEach(sh => {
          const h = STATE.habits.find(h => h.id === sh.id);
          if (h) { h.streak = sh.streak || 0; }
        });
      }
      // Heatmap
      if (Array.isArray(saved.heatmap)) STATE.heatmap = saved.heatmap;
      // Projects
      if (Array.isArray(saved.projects)) STATE.projects = saved.projects;
    }
  } catch(e) { console.warn('restoreState error', e); }

  // Derive blocked states from saved settings
  const muay = STATE.habits.find(h => h.id === 'muay');
  if (muay) muay.blocked = STATE.settings.shoulderDaysLeft > 0;
  const kite = STATE.habits.find(h => h.id === 'kite');
  if (kite) kite.blocked = STATE.settings.kiteStatus === 'repair';

  ensureHeatmap();
}

function persistState() {
  try {
    const data = {
      shoulderDaysLeft:  STATE.settings.shoulderDaysLeft,
      shoulderStartDate: STATE.settings.shoulderStartDate || null,
      kiteStatus:        STATE.settings.kiteStatus,
      habits: STATE.habits.map(h => ({ id: h.id, streak: h.streak })),
      heatmap:  STATE.heatmap,
      projects: STATE.projects,
    };
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch(e) { console.warn('persistState error', e); }
}

// ── HEATMAP INIT ─────────────────────────────────────────────────────────
function ensureHeatmap() {
  const today = dateKey(new Date());
  // Build 28-day window keys
  const keys = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(dateKey(d));
  }
  // Filter existing to only 28-day window
  STATE.heatmap = keys.map(k => {
    const found = STATE.heatmap.find(h => h.date === k);
    return found || { date: k, score: 0 };
  });
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

function todayKey() { return dateKey(new Date()); }

function updateTodayHeatmap() {
  const done = STATE.habits.filter(h => h.done).length;
  const entry = STATE.heatmap.find(h => h.date === todayKey());
  if (entry) entry.score = done;
}

// ── CLOCK & DATE ──────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const timeEl = document.getElementById('headerTime');
  const dateEl = document.getElementById('headerDate');
  const todayEl = document.getElementById('todayDayName');

  const hours = String(now.getHours()).padStart(2, '0');
  const mins  = String(now.getMinutes()).padStart(2, '0');
  timeEl.textContent = `${hours}:${mins}`;

  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dayName = days[now.getDay()];
  const dateStr = `${dayName}, ${months[now.getMonth()]} ${now.getDate()}`;
  dateEl.textContent = dateStr;
  if (todayEl) todayEl.textContent = dayName;
}

// ── SCHEDULE ──────────────────────────────────────────────────────────────
const SCHEDULE = [
  { time: '23:00', name: 'Sleep',           icon: '🌙', desc: 'Target bedtime', block: [23,0,7,0] },
  { time: '07:00', name: 'Wake up',          icon: '☀️', desc: 'Morning begins', block: [7,0,8,0] },
  { time: '08:00', name: 'Breakfast',        icon: '🍳', desc: 'Fuel up',        block: [8,0,9,0] },
  { time: '09:00', name: 'Physical block',   icon: '⚡', desc: 'Gym or Kite',    block: [9,0,12,0] },
  { time: '12:00', name: 'Recovery / Lunch', icon: '🥗', desc: 'Rest & refuel',  block: [12,0,14,0] },
  { time: '14:00', name: 'AI Projects',      icon: '🤖', desc: 'Deep work',      block: [14,0,18,0] },
  { time: '18:00', name: 'Free / Dog time',  icon: '🐕', desc: 'Wind down',      block: [18,0,20,0] },
  { time: '20:00', name: 'Dinner / Relax',   icon: '🍽️', desc: 'Evening routine', block: [20,0,23,0] },
];

function getCurrentBlockIndex() {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes();
  const totalMins = h * 60 + m;
  for (let i = 0; i < SCHEDULE.length; i++) {
    const s = SCHEDULE[i];
    const [sh, sm, eh, em] = s.block;
    const start = sh * 60 + sm;
    let end = eh * 60 + em;
    if (end <= start) end += 24 * 60; // overnight
    const t = (totalMins < start) ? totalMins + 24*60 : totalMins;
    if (t >= start && t < end) return i;
  }
  return -1;
}

function renderSchedule() {
  const list = document.getElementById('scheduleList');
  const activeIdx = getCurrentBlockIndex();
  list.innerHTML = SCHEDULE.map((item, i) => {
    const now = new Date();
    const [sh] = item.block;
    const itemHour = sh;
    const isPast = itemHour < now.getHours() && i !== activeIdx;
    const isActive = i === activeIdx;
    return `<div class="schedule-item ${isActive ? 'active' : ''} ${isPast && !isActive ? 'done' : ''}">
      <div class="schedule-time">${item.time}</div>
      <div class="schedule-body">
        <div class="schedule-name">${item.name}</div>
        <div class="schedule-desc">${item.desc}</div>
      </div>
      <div class="schedule-icon">${item.icon}</div>
    </div>`;
  }).join('');
}

// ── 48H WIND FORECAST CHART ───────────────────────────────────────────
let windChartData = null; // cached 48h data

async function fetch48hWind() {
  const { lat, lon } = STATE.settings;
  const url = `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m` +
    `&wind_speed_unit=kmh&forecast_hours=48` +
    `&timezone=America%2FFortaleza`;
  try {
    const res  = await fetch(url);
    const data = await res.json();
    windChartData = {
      times:  data.hourly.time,
      speeds: data.hourly.wind_speed_10m,
      gusts:  data.hourly.wind_gusts_10m,
      dirs:   data.hourly.wind_direction_10m,
    };
    buildWindChart();
  } catch(e) {
    console.warn('[wind-chart] fetch error', e);
  }
}

function buildWindChart() {
  const d = windChartData;
  if (!d) return;
  const svg    = document.getElementById('windChartSvg');
  const xAxis  = document.getElementById('windChartXAxis');
  const peakEl = document.getElementById('wfcPeakLabel');
  const winEl  = document.getElementById('wfcWindowsList');
  const thrEl  = document.getElementById('wfcThreshLabel');
  if (!svg) return;

  const W = 700, H = 100, PAD_T = 10, PAD_B = 14, PAD_L = 0, PAD_R = 0;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const n     = d.times.length;
  const minWind = STATE.settings.minWind || 18;
  if (thrEl) thrEl.textContent = minWind;

  const maxVal = Math.max(Math.max(...d.gusts), minWind + 10, 40);

  // Find the NOW index
  const nowStr  = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}T${String(t.getHours()).padStart(2,'0')}:00`;
  })();
  const nowIdx  = d.times.findIndex(t => t === nowStr);
  const nowFrac = nowIdx >= 0 ? nowIdx / (n - 1) : 0;
  const nowX    = (PAD_L + nowFrac * plotW).toFixed(1);

  // Scale helpers
  const xOf = i => (PAD_L + (i / (n - 1)) * plotW).toFixed(2);
  const yOf = v => (PAD_T + plotH - Math.min(v / maxVal, 1) * plotH).toFixed(2);

  // Build SVG paths
  // Gusts area (below gusts line, filled)
  const gustArea = d.gusts.map((g, i) => `${xOf(i)},${yOf(g)}`).join(' ');
  const gustPoly = `${xOf(0)},${yOf(0)} ${gustArea} ${xOf(n-1)},${yOf(0)}`;

  // Wind speed line
  const windLine = d.speeds.map((s, i) => `${xOf(i)},${yOf(s)}`).join(' ');
  const windArea = `${xOf(0)},${yOf(0)} ${windLine} ${xOf(n-1)},${yOf(0)}`;

  // Threshold line Y
  const threshY = parseFloat(yOf(minWind)).toFixed(2);

  // Kite window bands: contiguous runs where speed >= minWind
  const windows = [];
  let wStart = null;
  d.speeds.forEach((s, i) => {
    if (s >= minWind && wStart === null) wStart = i;
    else if (s < minWind && wStart !== null) { windows.push([wStart, i - 1]); wStart = null; }
  });
  if (wStart !== null) windows.push([wStart, n - 1]);

  // Kite window highlight rects
  const windowRects = windows.map(([s, e]) => {
    const x1 = parseFloat(xOf(s));
    const x2 = parseFloat(xOf(e));
    return `<rect x="${x1}" y="${PAD_T}" width="${(x2 - x1).toFixed(1)}" height="${plotH}" fill="var(--color-success)" fill-opacity="0.10" rx="1"/>`;
  }).join('');

  // X-axis labels every 6 hours
  const xLabels = [];
  for (let i = 0; i < n; i += 6) {
    const t   = d.times[i];
    const hh  = t.slice(11, 16); // "HH:00"
    const day = t.slice(5, 10).replace('-', '/');
    const x   = parseFloat(xOf(i));
    xLabels.push({ x, hh, day, i });
  }

  // Peak wind info
  const peakSpeed = Math.max(...d.speeds);
  const peakIdx   = d.speeds.indexOf(peakSpeed);
  const peakTime  = d.times[peakIdx]?.slice(11, 16) ?? '--:--';
  const peakDay   = d.times[peakIdx]?.slice(5, 10).replace('-', '/') ?? '';
  if (peakEl) {
    peakEl.textContent = `Peak ${Math.round(peakSpeed)} km/h at ${peakTime} ${peakDay}`;
    peakEl.style.color = peakSpeed >= minWind ? 'var(--color-success)' : 'var(--color-text-muted)';
  }

  // Wind direction labels at peak and now
  const dirLabel = (deg) => {
    const dirs = ['N','NE','E','SE','S','SW','W','NW'];
    return dirs[Math.round(deg / 45) % 8];
  };

  // Value labels at peak
  const peakX = parseFloat(xOf(peakIdx));
  const peakY = parseFloat(yOf(peakSpeed));

  svg.innerHTML = `
    <!-- Kite window bands -->
    ${windowRects}
    <!-- Gust area -->
    <polygon points="${gustPoly}" fill="var(--color-error)" fill-opacity="0.10"/>
    <polyline points="${gustArea}" fill="none" stroke="var(--color-error)" stroke-width="1" stroke-opacity="0.5" stroke-dasharray="3 2"/>
    <!-- Wind area fill -->
    <polygon points="${windArea}" fill="var(--color-primary)" fill-opacity="0.15"/>
    <!-- Wind speed line -->
    <polyline points="${windLine}" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <!-- Threshold line -->
    <line x1="${PAD_L}" y1="${threshY}" x2="${W - PAD_R}" y2="${threshY}"
      stroke="var(--color-amber)" stroke-width="1" stroke-dasharray="5 3"/>
    <text x="4" y="${(parseFloat(threshY) - 2).toFixed(1)}" font-size="7" fill="var(--color-amber)" font-family="'JetBrains Mono',monospace" font-weight="700">${minWind}</text>
    <!-- NOW marker -->
    <line x1="${nowX}" y1="${PAD_T}" x2="${nowX}" y2="${H - PAD_B}"
      stroke="var(--color-amber)" stroke-width="1.5"/>
    <text x="${(parseFloat(nowX) + 3).toFixed(1)}" y="${PAD_T + 7}" font-size="7"
      fill="var(--color-amber)" font-family="'JetBrains Mono',monospace" font-weight="700">NOW</text>
    <!-- Peak label -->
    ${peakSpeed >= 1 ? `<circle cx="${peakX}" cy="${peakY}" r="3" fill="var(--color-primary)"/>
    <text x="${peakX}" y="${(peakY - 5).toFixed(1)}" text-anchor="middle" font-size="7.5"
      fill="var(--color-primary)" font-family="'JetBrains Mono',monospace" font-weight="800">${Math.round(peakSpeed)}</text>` : ''}
    <!-- Baseline -->
    <line x1="${PAD_L}" y1="${H - PAD_B}" x2="${W}" y2="${H - PAD_B}" stroke="var(--color-border)" stroke-width="0.5"/>
  `;

  // X-axis DOM labels
  if (xAxis) {
    xAxis.innerHTML = '';
    xLabels.forEach(({ x, hh, day }) => {
      const span = document.createElement('span');
      span.className = 'wfc-x-label';
      span.style.left = ((x / W) * 100).toFixed(2) + '%';
      const midnight = hh === '00:00';
      span.innerHTML = midnight
        ? `<span class="wfc-x-date">${day}</span>`
        : `<span class="wfc-x-hour">${hh}</span>`;
      xAxis.appendChild(span);
    });
  }

  // Kite windows list
  if (winEl) {
    if (!windows.length) {
      winEl.textContent = 'No kite windows in next 48h';
      winEl.style.color = 'var(--color-text-muted)';
    } else {
      winEl.innerHTML = windows.map(([s, e]) => {
        const tStart = d.times[s]?.slice(11, 16) ?? '--';
        const tEnd   = d.times[e]?.slice(11, 16) ?? '--';
        const day    = d.times[s]?.slice(5, 10).replace('-', '/') ?? '';
        const maxSpd = Math.max(...d.speeds.slice(s, e + 1));
        const col    = maxSpd >= minWind + 10 ? 'var(--color-success)' : 'var(--color-amber)';
        return `<span class="wfc-window-badge" style="border-color:${col};color:${col}">${day} ${tStart}&ndash;${tEnd} <span style="opacity:0.7">${Math.round(maxSpd)}km/h</span></span>`;
      }).join('');
    }
  }
}

// ── SHOULDER RECOVERY BAR ───────────────────────────────────────────────
function renderShoulderBar() {
  const bar      = document.getElementById('shoulderBar');
  const display  = document.getElementById('shoulderDaysDisplay');
  const label    = document.getElementById('shoulderDaysLabel');
  const dotsEl   = document.getElementById('shoulderDots');
  if (!bar) return;

  const days = STATE.settings.shoulderDaysLeft;

  if (days <= 0) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'flex';
  display.textContent = days;
  label.textContent   = days === 1 ? 'day left' : 'days left';

  // Progress dots: filled = remaining, empty = days already recovered
  const total = STATE.settings.shoulderTotalDays || Math.max(days, 5);
  const recovered = total - days;
  dotsEl.innerHTML = Array.from({ length: total }, (_, i) => {
    const done = i < recovered;
    return `<span class="shoulder-dot ${done ? 'shoulder-dot-done' : 'shoulder-dot-left'}"></span>`;
  }).join('');
}

function initShoulderBar() {
  // Set total days on first load if not already stored
  if (!STATE.settings.shoulderTotalDays) {
    STATE.settings.shoulderTotalDays = STATE.settings.shoulderDaysLeft || 5;
  }

  renderShoulderBar();

  const btnMinus  = document.getElementById('shoulderMinus');
  const btnHealed = document.getElementById('shoulderHealed');

  btnMinus?.addEventListener('click', () => {
    if (STATE.settings.shoulderDaysLeft <= 0) return;
    STATE.settings.shoulderDaysLeft = Math.max(0, STATE.settings.shoulderDaysLeft - 1);
    const muay = STATE.habits.find(h => h.id === 'muay');
    if (muay) muay.blocked = STATE.settings.shoulderDaysLeft > 0;
    persistState();
    renderShoulderBar();
    renderHabits();
    renderBlockers();
    updateNudge();
  });

  btnHealed?.addEventListener('click', () => {
    STATE.settings.shoulderDaysLeft  = 0;
    STATE.settings.shoulderTotalDays = 0;
    const muay = STATE.habits.find(h => h.id === 'muay');
    if (muay) { muay.blocked = false; }
    persistState();
    renderShoulderBar();
    renderHabits();
    renderBlockers();
    updateNudge();
    // Flash confirmation in nudge bar
    const txt = document.getElementById('nudgeText');
    if (txt) {
      const prev = txt.textContent;
      txt.textContent = 'Shoulder cleared — Muay Thai is now unblocked!';
      txt.style.color = 'var(--color-success)';
      setTimeout(() => { txt.textContent = prev; txt.style.color = ''; updateNudge(); }, 3000);
    }
  });
}

// ── BLOCKERS / STATUS ───────────────────────────────────────────────
function renderBlockers() {
  const list = document.getElementById('blockerList');
  const s = STATE.settings;
  const items = [];

  // Shoulder recovery
  if (s.shoulderDaysLeft > 0) {
    items.push({
      type: 'warning',
      icon: '🩺',
      text: `Shoulder recovery: ${s.shoulderDaysLeft} day${s.shoulderDaysLeft !== 1 ? 's' : ''} left`,
      action: () => {
        STATE.settings.shoulderDaysLeft = Math.max(0, STATE.settings.shoulderDaysLeft - 1);
        const muay = STATE.habits.find(h => h.id === 'muay');
        if (muay) muay.blocked = STATE.settings.shoulderDaysLeft > 0;
        persistState();
        renderBlockers();
        renderHabits();
        updateNudge();
      },
      actionLabel: '−1 day'
    });
  } else {
    items.push({ type: 'success', icon: '✅', text: 'Shoulder cleared — Muay Thai ready!' });
    const muay = STATE.habits.find(h => h.id === 'muay');
    if (muay) muay.blocked = false;
  }

  // Kite status
  if (s.kiteStatus === 'repair') {
    items.push({
      type: 'warning', icon: '🪁',
      text: 'Kites in repair — waiting',
      action: () => {
        STATE.settings.kiteStatus = 'ready';
        const kite = STATE.habits.find(h => h.id === 'kite');
        if (kite) kite.blocked = false;
        persistState();
        renderBlockers();
        renderHabits();
        updateNudge();
      },
      actionLabel: 'Mark ready'
    });
    const kite = STATE.habits.find(h => h.id === 'kite');
    if (kite) kite.blocked = true;
  } else {
    items.push({ type: 'success', icon: '🪁', text: 'Kites ready to fly!' });
    const kite = STATE.habits.find(h => h.id === 'kite');
    if (kite) kite.blocked = false;
  }

  // Wind / kite conditions summary
  if (STATE.conditionsOk === true) {
    items.push({ type: 'info', icon: '🌬️', text: 'Wind is good for kiting today!' });
  }

  list.innerHTML = items.map((item, idx) => `
    <div class="blocker-item ${item.type}">
      <span class="blocker-icon">${item.icon}</span>
      <span class="blocker-text">${item.text}</span>
      ${item.action ? `<button class="btn-ghost" style="margin-left:auto; font-size: 0.65rem; padding: 2px 6px; white-space:nowrap; flex-shrink:0;" data-blocker-action="${idx}">${item.actionLabel}</button>` : ''}
    </div>
  `).join('');

  // Bind action buttons
  list.querySelectorAll('[data-blocker-action]').forEach(btn => {
    const idx = parseInt(btn.dataset.blockerAction);
    if (items[idx] && items[idx].action) {
      btn.addEventListener('click', items[idx].action);
    }
  });
}

// ── MOOD ──────────────────────────────────────────────────────────────────
function renderMood() {
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.mood === STATE.selectedMood);
    btn.addEventListener('click', () => {
      STATE.selectedMood = btn.dataset.mood;
      renderMood();
      persistState();
      updateNudge();
    });
  });
}

// ── HABITS ────────────────────────────────────────────────────────────────
function renderHabits() {
  const grid = document.getElementById('habitsGrid');
  grid.innerHTML = STATE.habits.map(h => `
    <div class="habit-item ${h.done ? 'done' : ''} ${h.blocked ? 'blocked' : ''}"
         data-habit-id="${h.id}"
         title="${h.blocked ? 'Currently blocked' : (h.done ? 'Done! Click to undo' : 'Click to mark done')}">
      <div class="habit-tag">${h.tag || h.name.slice(0,3).toUpperCase()}</div>
      <div class="habit-name">${h.name}</div>
      <div class="habit-streak ${h.streak >= 3 ? 'hot' : ''}">
        ${h.streak > 0 ? `${h.streak}d streak` : (h.blocked ? 'BLOCKED' : '—')}
      </div>
      <div class="habit-check">${h.done ? '✓' : ''}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.habit-item:not(.blocked)').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.habitId;
      const habit = STATE.habits.find(h => h.id === id);
      if (!habit || habit.blocked) return;
      habit.done = !habit.done;
      if (habit.done) habit.streak += 1;
      else habit.streak = Math.max(0, habit.streak - 1);
      updateTodayHeatmap();
      renderHabits();
      renderHeatmap();
      renderStreakRow();
      persistState();
      updateNudge();
    });
  });

  renderStreakRow();
}

function renderStreakRow() {
  const row = document.getElementById('habitStreakRow');
  const done = STATE.habits.filter(h => h.done).length;
  const total = STATE.habits.filter(h => !h.blocked).length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  row.innerHTML = `
    <span>${done}/${total} done today</span>
    <span>${pct}% complete</span>
  `;
}

function renderHeatmap() {
  const grid = document.getElementById('heatmapGrid');
  grid.innerHTML = STATE.heatmap.map((cell, i) => {
    const d = new Date(cell.date + 'T12:00:00');
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `<div class="heatmap-cell" data-score="${cell.score}" title="${label}: ${cell.score} habits"></div>`;
  }).join('');
}

// ── PROJECTS ──────────────────────────────────────────────────────────────
function renderProjects() {
  const list = document.getElementById('projectsList');
  list.innerHTML = STATE.projects.map(p => `
    <div class="project-item ${p.active ? 'active-project' : ''}" data-project-id="${p.id}">
      <div class="project-priority-dot ${p.priority}"></div>
      <div class="project-name">${p.name}</div>
      <div class="project-actions">
        <button class="project-action-btn start" title="Start session" data-action="start" data-project-id="${p.id}">▶</button>
        <button class="project-action-btn" title="Remove" data-action="remove" data-project-id="${p.id}">✕</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-action="start"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.projectId);
      startSession(id);
    });
  });

  list.querySelectorAll('[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.projectId);
      STATE.projects = STATE.projects.filter(p => p.id !== id);
      renderProjects();
      persistState();
    });
  });
}

// ── SESSION TIMER ──────────────────────────────────────────────────────────
function startSession(projectId) {
  if (STATE.session.active) endSession();
  STATE.projects.forEach(p => p.active = p.id === projectId);
  const proj = STATE.projects.find(p => p.id === projectId);
  STATE.session = { active: true, projectId, startTime: Date.now(), elapsed: 0 };

  const bar = document.getElementById('sessionBar');
  const projLabel = document.getElementById('sessionProject');
  bar.style.display = 'flex';
  projLabel.textContent = proj ? proj.name : '—';

  STATE.sessionTimer = setInterval(() => {
    STATE.session.elapsed = Math.floor((Date.now() - STATE.session.startTime) / 1000);
    const mins = String(Math.floor(STATE.session.elapsed / 60)).padStart(2, '0');
    const secs = String(STATE.session.elapsed % 60).padStart(2, '0');
    document.getElementById('sessionTimer').textContent = `${mins}:${secs}`;
  }, 1000);

  renderProjects();
}

function endSession() {
  clearInterval(STATE.sessionTimer);
  STATE.session.active = false;
  STATE.projects.forEach(p => p.active = false);
  document.getElementById('sessionBar').style.display = 'none';
  document.getElementById('sessionTimer').textContent = '00:00';
  renderProjects();
}

// ── ADD PROJECT ────────────────────────────────────────────────────────────
function initProjectForm() {
  const addBtn = document.getElementById('addProjectBtn');
  const form   = document.getElementById('addProjectForm');
  const cancel = document.getElementById('cancelProjectBtn');
  const input  = document.getElementById('projectNameInput');
  const priSel = document.getElementById('projectPriorityInput');

  addBtn.addEventListener('click', () => {
    form.style.display = 'flex';
    input.focus();
  });

  cancel.addEventListener('click', () => {
    form.style.display = 'none';
    input.value = '';
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) return;
    STATE.projects.unshift({
      id: STATE.nextProjectId++,
      name,
      priority: priSel.value,
      active: false,
    });
    form.style.display = 'none';
    input.value = '';
    renderProjects();
    persistState();
  });

  document.getElementById('endSessionBtn').addEventListener('click', endSession);
}

// ── NOTES ─────────────────────────────────────────────────────────────────
function initNotes() {
  const ta = document.getElementById('notesTextarea');
  const count = document.getElementById('notesCharCount');
  const saved = document.getElementById('notesSaved');
  let saveTimer;

  ta.value = STATE.notes;
  count.textContent = `${ta.value.length} / 2000`;

  ta.addEventListener('input', () => {
    STATE.notes = ta.value;
    count.textContent = `${ta.value.length} / 2000`;
    saved.textContent = '';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      persistState();
      saved.textContent = 'Saved';
      setTimeout(() => { saved.textContent = ''; }, 2000);
    }, 800);
  });
}

// ── LIVE CONDITIONS — Open-Meteo Wind + Marine (waves) + DNPVN tide ───────────
// Wind + waves from Open-Meteo (free, no key).
// Tide: DNPVN 2026 44-component harmonic table — most accurate source for this coast.
async function fetchConditions() {
  const { lat, lon, minWind } = STATE.settings;

  // Wind only — tide from DNPVN table, waves removed from conditions block.
  const windUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m&wind_speed_unit=kmh&timezone=America%2FFortaleza`;

  try {
    const windRes  = await fetch(windUrl);
    const windData = await windRes.json();

    // ── Wind ──
    const w = windData.current;
    const speed  = Math.round(w.wind_speed_10m);
    const gusts  = Math.round(w.wind_gusts_10m);
    const dirDeg = w.wind_direction_10m;
    const dir    = windDirLabel(dirDeg);
    const temp   = Math.round(w.temperature_2m);

    document.getElementById('windSpeed').textContent = `${speed} km/h`;
    document.getElementById('windGusts').textContent = `${gusts} km/h`;
    document.getElementById('windDir').textContent   = dir;

    // ── Conditions table status column ──
    function setCondStatus(id, ok, text) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent  = text;
      el.className    = 'cond-status ' + (ok === true ? 'cond-ok' : ok === false ? 'cond-fail' : 'cond-info');
    }
    setCondStatus('condStatusWind',  speed >= minWind,          speed >= minWind ? 'OK' : 'LOW');
    setCondStatus('condStatusGusts', gusts <= 45,               gusts <= 45 ? 'OK' : 'HIGH');
    setCondStatus('condStatusDir',   null,                      dir);

    // ── Tide: DNPVN 2026 harmonic table (cosine interpolation) ──
    // Rendered by renderTideFromDNPVN() which is called from initTides().
    // If the engine is already loaded, refresh it now too.
    renderTideFromDNPVN();

    // ── Decision logic ──
    const kiteReady = STATE.settings.kiteStatus === 'ready';
    const windOk  = speed >= minWind;
    const gustsOk = gusts <= 45;
    STATE.conditionsOk = kiteReady && windOk;

    STATE.weather = { speed, gusts, dir, dirDeg, temp };

    updateConditionsIndicator(speed, gusts, dir, kiteReady, windOk, gustsOk);
    updateKiteStatus();
    updateNudge();

    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    document.getElementById('conditionsUpdated').innerHTML =
      `<span class="live-badge">LIVE</span> Updated ${ts}`;

  } catch(e) {
    console.error('Conditions fetch failed:', e);
    document.getElementById('conditionsUpdated').textContent = 'Could not load — retrying…';
  }
}

function windDirLabel(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function updateConditionsIndicator(speed, gusts, dir, kiteReady, windOk, gustsOk) {
  const badge = document.getElementById('goBadge');
  const label = document.getElementById('goLabel');

  if (!kiteReady) {
    badge.textContent = '—';
    badge.className = 'go-badge pending';
    label.textContent = 'Kites not ready yet';
    return;
  }

  if (windOk && gustsOk && wavesOk) {
    badge.textContent = 'GO KITE';
    badge.className = 'go-badge go';
    label.textContent = `${speed} km/h ${dir} · Gusts ${gusts} · Waves ${waveH}m`;
  } else if (windOk && !gustsOk) {
    badge.textContent = 'TOO GUSTY';
    badge.className = 'go-badge nogo';
    label.textContent = `Gusts ${gusts} km/h — too strong. Gym day.`;
  } else if (windOk && !wavesOk) {
    badge.textContent = 'ROUGH SEA';
    badge.className = 'go-badge nogo';
    label.textContent = `Waves ${waveH}m — too rough. Gym day.`;
  } else {
    badge.textContent = 'GYM DAY';
    badge.className = 'go-badge nogo';
    label.textContent = `Wind ${speed} km/h — Need ${STATE.settings.minWind}+ km/h`;
  }
}

function updateKiteStatus() {
  const dot  = document.getElementById('kiteStatusDot');
  const text = document.getElementById('kiteStatusText');
  const { kiteStatus } = STATE.settings;
  dot.className = `kite-status-dot ${kiteStatus}`;
  text.textContent = kiteStatus === 'repair' ? 'Kites in repair — waiting' : 'Kites ready to fly';
}

// ── NUDGE BAR ─────────────────────────────────────────────────────────────
function updateNudge() {
  const icon = document.getElementById('nudgeIcon');
  const text = document.getElementById('nudgeText');
  const actions = document.getElementById('nudgeActions');

  const now = new Date();
  const hour = now.getHours();
  const habitsDone = STATE.habits.filter(h => h.done).length;
  const habitsAvail = STATE.habits.filter(h => !h.blocked).length;
  const allDone = habitsDone === habitsAvail;
  const s = STATE.settings;
  const kiteGo = STATE.conditionsOk;

  let msg, ic, tags = [];

  if (hour >= 6 && hour < 8) {
    ic = '☀️'; msg = 'Good morning! Time to fuel up — breakfast first, then the physical block.';
  } else if (hour >= 8 && hour < 9) {
    ic = '🍳'; msg = 'Breakfast time. Check the conditions widget — today is a gym or kite decision.';
    if (kiteGo) tags.push({ text: '🪁 Wind is good', color: 'success' });
  } else if (hour >= 9 && hour < 12) {
    if (kiteGo && s.kiteStatus === 'ready') {
      ic = '🪁'; msg = 'Wind is good and kites are ready. Get to the beach!';
      tags.push({ text: 'GO KITE', color: 'go' });
    } else if (s.kiteStatus === 'repair') {
      ic = '🏋️'; msg = 'Kites still in repair → Gym day. Make it count.';
      tags.push({ text: 'GYM DAY', color: 'warning' });
    } else {
      ic = '🏋️'; msg = 'Not enough wind for kiting today → Gym day. Make it count.';
      tags.push({ text: 'GYM DAY', color: 'warning' });
    }
    if (s.shoulderDaysLeft > 0) {
      tags.push({ text: `Shoulder: ${s.shoulderDaysLeft}d left`, color: 'warning' });
    }
  } else if (hour >= 12 && hour < 14) {
    ic = '🥗'; msg = 'Recovery block. Rest, eat well, hydrate. AI projects start at 14:00.';
  } else if (hour >= 14 && hour < 18) {
    const activeProj = STATE.projects.find(p => p.active);
    if (STATE.session.active && activeProj) {
      ic = '🤖'; msg = `Deep work in progress: ${activeProj.name}`;
      tags.push({ text: '⏱ Session active', color: 'primary' });
    } else {
      const topProj = STATE.projects.sort((a,b) => {
        const o = { high: 0, medium: 1, low: 2 };
        return o[a.priority] - o[b.priority];
      })[0];
      ic = '🤖';
      msg = topProj ? `AI project time. Top priority: ${topProj.name}` : 'AI project time. Start a session from the Projects panel.';
    }
  } else if (hour >= 18 && hour < 20) {
    ic = '🐕'; msg = 'Evening block. Dog training is a great wind-down anchor.';
    const dogs = STATE.habits.find(h => h.id === 'dogs');
    if (dogs && !dogs.done) tags.push({ text: '🐕 Not done yet', color: 'warning' });
  } else if (hour >= 20 && hour < 23) {
    ic = '🌙'; msg = `Winding down. ${allDone ? 'All habits complete — great day! 🎉' : `${habitsAvail - habitsDone} habit(s) still open.`}`;
  } else {
    ic = '😴';
    msg = hour >= 23 ? 'Time to sleep. Target: 7–8 hours.' : 'Early morning. Give yourself until 07:00.';
  }

  icon.textContent = ic;
  text.textContent = msg;
  actions.innerHTML = tags.map(t => `<span class="nudge-tag" style="${t.color === 'go' ? 'background:var(--color-success-highlight);color:var(--color-success)' : t.color === 'warning' ? 'background:var(--color-warning-highlight);color:var(--color-warning)' : t.color === 'primary' ? 'background:var(--color-primary-highlight);color:var(--color-primary)' : ''}">${t.text}</span>`).join('');
}

// ── SETTINGS MODAL ────────────────────────────────────────────────────────
function initSettings() {
  const fab     = document.getElementById('settingsFab');
  const overlay = document.getElementById('settingsOverlay');
  const close   = document.getElementById('settingsClose');
  const save    = document.getElementById('settingsSave');

  fab.addEventListener('click', () => {
    // Populate
    document.getElementById('settingsLat').value = STATE.settings.lat;
    document.getElementById('settingsLon').value = STATE.settings.lon;
    document.getElementById('settingsMinWind').value = STATE.settings.minWind;
    document.getElementById('settingsShoulderDays').value = STATE.settings.shoulderDaysLeft;
    document.getElementById('settingsKiteStatus').value = STATE.settings.kiteStatus;
    overlay.style.display = 'flex';
  });

  [close, overlay].forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target === overlay || e.target === close) overlay.style.display = 'none';
    });
  });

  save.addEventListener('click', () => {
    STATE.settings.lat = parseFloat(document.getElementById('settingsLat').value) || -7.115;
    STATE.settings.lon = parseFloat(document.getElementById('settingsLon').value) || -34.863;
    STATE.settings.minWind = parseInt(document.getElementById('settingsMinWind').value) || 18;
    STATE.settings.shoulderDaysLeft = parseInt(document.getElementById('settingsShoulderDays').value) || 0;
    STATE.settings.kiteStatus = document.getElementById('settingsKiteStatus').value;

    // Sync blockers
    const muay = STATE.habits.find(h => h.id === 'muay');
    if (muay) muay.blocked = STATE.settings.shoulderDaysLeft > 0;

    overlay.style.display = 'none';
    persistState();
    renderBlockers();
    renderHabits();
    updateKiteStatus();
    fetchWeather();
    updateNudge();
  });
}

// ── THEME TOGGLE ──────────────────────────────────────────────────────────
function initTheme() {
  const toggle = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  let theme = root.getAttribute('data-theme') || 'dark';

  const setTheme = (t) => {
    theme = t;
    root.setAttribute('data-theme', t);
    toggle.innerHTML = t === 'dark'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  };

  setTheme(theme);
  toggle.addEventListener('click', () => setTheme(theme === 'dark' ? 'light' : 'dark'));
}

// ── INIT ──────────────────────────────────────────────────────────────────
function init() {
  restoreState();
  initTheme();
  updateClock();
  setInterval(updateClock, 30000);
  renderSchedule();
  setInterval(renderSchedule, 60000);
  renderBlockers();
  renderMood();
  renderHabits();
  renderHeatmap();
  renderProjects();
  initProjectForm();
  initNotes();
  initSettings();
  initShoulderBar();
  // ── DNPVN tide engine — load first so renderTideFromDNPVN() fires immediately
  initTides().then(() => {
    // Refresh tide display every minute (interpolated — no API call)
    setInterval(renderTideFromDNPVN, 60 * 1000);
  });
  fetchConditions();
  setInterval(fetchConditions, 10 * 60 * 1000); // refresh every 10 min
  fetch48hWind();
  setInterval(fetch48hWind, 60 * 60 * 1000);     // wind chart refreshes hourly
  updateNudge();
  setInterval(updateNudge, 5 * 60 * 1000);
}

document.addEventListener('DOMContentLoaded', init);

// ── 7-DAY KITE FORECAST ───────────────────────────────────────────────────
async function fetchForecast() {
  const { lat, lon, minWind } = STATE.settings;

  // Fetch 7-day hourly wind + marine data
  // Wind: hourly wind_speed_10m, wind_gusts_10m for 7 days
  const windUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m` +
    `&wind_speed_unit=kmh&forecast_days=7&timezone=America%2FFortaleza`;

  // Marine: hourly wave_height, swell_wave_height for 7 days (tide now from DNPVN)
  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}` +
    `&hourly=wave_height,swell_wave_height` +
    `&forecast_days=7&timezone=America%2FFortaleza`;

  try {
    const [windRes, marineRes] = await Promise.all([fetch(windUrl), fetch(marineUrl)]);
    const [windData, marineData] = await Promise.all([windRes.json(), marineRes.json()]);

    const windTimes  = windData.hourly.time;
    const windSpeeds = windData.hourly.wind_speed_10m;
    const windGusts  = windData.hourly.wind_gusts_10m;
    const windDirs   = windData.hourly.wind_direction_10m;
    const waves      = marineData.hourly.wave_height;
    const swells     = marineData.hourly.swell_wave_height;

    // For each of the next 7 days, pick the 09:00 local hour slot
    // Use local date strings (America/Fortaleza = UTC-3) to match Open-Meteo response
    const today = new Date();
    const localDateStr = (d) => {
      const date = new Date(today);
      date.setDate(today.getDate() + d);
      // Format in local timezone (Fortaleza UTC-3)
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const todayStr = localDateStr(0);
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() + d);
      const dateStr = localDateStr(d);

      // Target 09:00 local — find index in hourly.time array matching "YYYY-MM-DDTHH:00"
      // Open-Meteo returns times in local timezone as ISO strings like "2026-04-23T09:00"
      const targetStr = `${dateStr}T09:00`;
      const idx = windTimes.findIndex(t => t === targetStr);

      const dayNames = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const dayName  = dayNames[date.getDay()];
      const dateLabel = `${date.getDate()} ${monthNames[date.getMonth()]}`;
      const isToday  = dateStr === todayStr;

      if (idx === -1) {
        // Slot not found — mark as unavailable
        days.push({ dayName, dateLabel, isToday, noData: true });
        continue;
      }

      const speed = Math.round(windSpeeds[idx] ?? 0);
      const gusts = Math.round(windGusts[idx] ?? 0);
      const dir   = windDirLabel(windDirs[idx] ?? 0);
      const wave  = parseFloat((waves[idx] ?? 0).toFixed(1));
      const swell = parseFloat((swells[idx] ?? 0).toFixed(1));

      // Kite decision thresholds (same as live widget)
      const kiteReady = STATE.settings.kiteStatus === 'ready';
      const windOk    = speed >= minWind;
      const gustsOk   = gusts <= 45;
      const wavesOk   = wave <= 2.0;
      const goKite    = kiteReady && windOk && gustsOk && wavesOk;

      // Tide at 09:00 — DNPVN 2026 cosine interpolation (exact harmonic data)
      let tideInfo = '';
      if (tideEngine) {
        const t09 = tideEngine.getTideAtTime(dateStr, '09:00');
        if (t09) {
          const { levelStr, trendArrow } = tideEngine.formatTide(t09);
          tideInfo = `${levelStr} ${trendArrow}`;
        }
      }

      // Reason label
      let reason = '';
      if (!kiteReady)      reason = 'kites in repair';
      else if (!windOk)    reason = `wind ${speed}km/h`;
      else if (!gustsOk)   reason = `gusts ${gusts}km/h`;
      else if (!wavesOk)   reason = `waves ${wave}m`;
      else                 reason = `${speed}km/h ${dir}`;

      days.push({ dayName, dateLabel, isToday, goKite, speed, gusts, dir, wave, swell, tideInfo, reason, noData: false });
    }

    renderForecastStrip(days);

    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const el = document.getElementById('forecastUpdated');
    if (el) el.textContent = `Jo\u00e3o Pessoa \u00b7 09:00 window \u00b7 ${ts}`;

  } catch(e) {
    console.error('Forecast fetch failed:', e);
    const el = document.getElementById('forecastUpdated');
    if (el) el.textContent = 'Forecast unavailable';
  }
}

function renderForecastStrip(days) {
  const tbody = document.getElementById('forecastTbody');
  if (!tbody) return;

  // Table rows
  tbody.innerHTML = days.map(d => {
    if (d.noData) {
      return `<tr class="forecast-row-nodata">
        <td class="fc-day">${d.dayName}</td>
        <td class="fc-date">${d.dateLabel}</td>
        <td colspan="6" style="color:var(--color-text-faint)">No data</td>
      </tr>`;
    }
    const verdict  = d.goKite ? 'GO KITE' : 'GYM';
    const vClass   = d.goKite ? 'fc-go' : 'fc-nogo';
    const todayCls = d.isToday ? ' fc-today' : '';
    return `<tr class="forecast-row${todayCls}">
      <td class="fc-day">${d.dayName}${d.isToday ? '<span class="fc-now-dot"></span>' : ''}</td>
      <td class="fc-date">${d.dateLabel}</td>
      <td class="fc-verdict ${vClass}">${verdict}</td>
      <td class="fc-num">${d.speed} <span class="fc-unit">km/h</span></td>
      <td class="fc-num">${d.gusts} <span class="fc-unit">km/h</span></td>
      <td class="fc-num">${d.wave} <span class="fc-unit">m</span></td>
      <td class="fc-num">${d.tideInfo || '—'}</td>
      <td class="fc-reason">${d.reason}</td>
    </tr>`;
  }).join('');

  // Wind bar mini-chart (inline SVG)
  const chartEl = document.getElementById('forecastWindChart');
  if (chartEl) {
    const valid = days.filter(d => !d.noData);
    const maxSpd = Math.max(...valid.map(d => d.speed), 1);
    const minThreshold = STATE.settings.minWind || 18;
    const w = 100 / (days.length || 1);
    const barsSvg = days.map((d, i) => {
      if (d.noData) return `<rect x="${i*w+w*0.1}%" y="0" width="${w*0.8}%" height="100%" fill="var(--color-surface-2)" rx="1"/>`;
      const hPct = Math.max(4, Math.round(d.speed / maxSpd * 100));
      const fill = d.speed >= minThreshold ? 'var(--color-primary)' : 'var(--color-text-faint)';
      const top  = 100 - hPct;
      return `<rect x="${i*w+w*0.1}%" y="${top}%" width="${w*0.8}%" height="${hPct}%" fill="${fill}" rx="1"/>
        <text x="${i*w+w/2}%" y="97%" text-anchor="middle" font-size="9" font-family="'JetBrains Mono',monospace" fill="var(--color-text-muted)">${d.dayName.slice(0,1)}</text>`;
    }).join('');
    const threshPct = 100 - Math.round(minThreshold / maxSpd * 100);
    chartEl.innerHTML = `
      <div class="fwc-label">WIND SPEED (km/h) — 09:00 morning · threshold ${minThreshold} km/h</div>
      <svg class="fwc-svg" viewBox="0 0 700 60" preserveAspectRatio="none">
        ${barsSvg}
        <line x1="0" y1="${threshPct}%" x2="100%" y2="${threshPct}%" stroke="var(--color-amber)" stroke-width="1" stroke-dasharray="4 3"/>
      </svg>`;
  }
}

// ── GOOGLE CALENDAR SIMULATION ────────────────────────────────────────────
// Simulated events — realistic for Eduardo's life as a retired tax auditor + developer
function buildGCalEvents() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  // Simulated calendar events for today
  const events = [
    {
      title: 'Morning Physical Block',
      start: { h: 9, m: 0 }, end: { h: 11, m: 30 },
      cal: 'Personal', color: '#3db4e8',
    },
    {
      title: 'Dog Training — Parque da Jaqueira',
      start: { h: 11, m: 30 }, end: { h: 12, m: 15 },
      cal: 'Personal', color: '#4cc96a',
    },
    {
      title: 'Lunch & Recovery',
      start: { h: 12, m: 30 }, end: { h: 14, m: 0 },
      cal: 'Personal', color: '#e8a43d',
    },
    {
      title: 'Deep Work — GMC Dashboard',
      start: { h: 14, m: 0 }, end: { h: 16, m: 0 },
      cal: 'AI Projects', color: '#a86fdf',
    },
    {
      title: 'MCP Integration — LM Studio',
      start: { h: 16, m: 0 }, end: { h: 17, m: 30 },
      cal: 'AI Projects', color: '#a86fdf',
    },
    {
      title: 'Evening Walk + Dog Training',
      start: { h: 18, m: 0 }, end: { h: 19, m: 0 },
      cal: 'Personal', color: '#4cc96a',
    },
    {
      title: 'Dinner',
      start: { h: 20, m: 0 }, end: { h: 21, m: 0 },
      cal: 'Personal', color: '#e8a43d',
    },
  ];

  const currentMins = h * 60 + m;

  const el = document.getElementById('gcalEvents');
  el.innerHTML = events.map(ev => {
    const startMins = ev.start.h * 60 + ev.start.m;
    const endMins   = ev.end.h   * 60 + ev.end.m;
    const isDone    = endMins < currentMins;
    const isNow     = startMins <= currentMins && endMins > currentMins;

    const fmt = (obj) => {
      const mm = String(obj.m).padStart(2, '0');
      return `${obj.h}:${mm}`;
    };

    return `
      <div class="gcal-event ${isNow ? 'gcal-now' : ''} ${isDone ? 'gcal-done' : ''}">
        <div class="gcal-event-dot" style="background:${ev.color}"></div>
        <div class="gcal-event-time">${fmt(ev.start)}</div>
        <div class="gcal-event-body">
          <div class="gcal-event-title">${ev.title}${isNow ? ' <span style="color:var(--color-success);font-size:0.65rem;font-weight:700;margin-left:4px;">NOW</span>' : ''}</div>
          <div class="gcal-event-cal">${ev.cal} · until ${fmt(ev.end)}</div>
        </div>
      </div>
    `;
  }).join('');

  // Update sync badge with realistic timestamp
  const syncTime = new Date(now - Math.floor(Math.random() * 3 + 1) * 60000);
  const syncMins = Math.round((now - syncTime) / 60000);
  document.getElementById('gcalSyncBadge').textContent =
    syncMins <= 1 ? 'Synced just now' : `Synced ${syncMins}m ago`;
}

// ── WEEKLY REVIEW ─────────────────────────────────────────────────────────
// Simulate realistic data for the past 7 days
// ── HABIT COMPLETION GRID 7×4 ─────────────────────────────────────────────
// Renders a table: rows = habits (GYM/KIT/MUA/DOG), columns = last 7 days.
// Each cell = green (done), red (missed), dark (blocked), amber outline (today).
function buildHabitCompletionGrid(last7, habitHistory) {
  const el = document.getElementById('habitCompletionGrid');
  if (!el) return;

  const dayNames   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const todayIdx   = 6; // last7[6] is always today

  // Column headers: day name + date
  const colHeaders = last7.map((d, i) => {
    const isToday  = i === todayIdx;
    const dayLabel = dayNames[d.getDay()];
    const dateLabel = `${d.getDate()} ${monthNames[d.getMonth()]}`;
    return `<th class="hcg-th${isToday ? ' hcg-th-today' : ''}">
      <span class="hcg-col-day">${dayLabel}</span>
      <span class="hcg-col-date">${dateLabel}</span>
    </th>`;
  }).join('');

  // Habit rows
  const habitsOrdered = [
    { id: 'gym',  tag: 'GYM',  name: 'Gym'         },
    { id: 'kite', tag: 'KIT',  name: 'Kite'        },
    { id: 'muay', tag: 'MUA',  name: 'Muay Thai'   },
    { id: 'dogs', tag: 'DOG',  name: 'Dogs'        },
  ];

  const rows = habitsOrdered.map(hab => {
    const stateHabit = STATE.habits.find(h => h.id === hab.id);
    const isBlocked  = stateHabit?.blocked ?? false;
    const history    = habitHistory[hab.id] ?? Array(7).fill(false);

    // Streak: count consecutive done days from today backwards
    let streak = 0;
    for (let i = todayIdx; i >= 0; i--) {
      if (!isBlocked && history[i]) streak++;
      else break;
    }

    // Completion rate this week
    const doneCount  = isBlocked ? 0 : history.filter(Boolean).length;
    const available  = isBlocked ? 0 : history.length;
    const pct        = available > 0 ? Math.round(doneCount / available * 100) : 0;

    const cells = history.map((done, i) => {
      const isToday = i === todayIdx;
      let cellClass = 'hcg-cell';
      let label     = '';
      let title     = '';

      if (isBlocked) {
        cellClass += ' hcg-cell-blocked';
        title      = `${hab.name}: blocked`;
        label      = '—';
      } else if (done) {
        cellClass += ' hcg-cell-done';
        title      = `${hab.name}: done`;
        label      = '✓';
      } else {
        cellClass += ' hcg-cell-missed';
        title      = `${hab.name}: missed`;
        label      = '×';
      }
      if (isToday) cellClass += ' hcg-cell-today';

      return `<td class="${cellClass}" title="${title}">${label}</td>`;
    }).join('');

    const streakBadge = streak >= 2
      ? `<span class="hcg-streak">${streak}d</span>`
      : '';
    const pctColor = pct >= 70 ? 'var(--color-success)' : pct >= 40 ? 'var(--color-amber)' : 'var(--color-error)';

    return `
      <tr class="hcg-row">
        <td class="hcg-habit-label">
          <span class="hcg-tag">${hab.tag}</span>
          <span class="hcg-habit-name">${hab.name}</span>
          ${streakBadge}
        </td>
        ${cells}
        <td class="hcg-pct" style="color:${pctColor}">${isBlocked ? '—' : pct + '%'}</td>
      </tr>`;
  }).join('');

  // Day-column score bar (how many habits done per day)
  const dayScores = last7.map((_, i) => {
    return habitsOrdered.reduce((sum, hab) => {
      const isBlocked = STATE.habits.find(h => h.id === hab.id)?.blocked ?? false;
      return sum + (!isBlocked && (habitHistory[hab.id]?.[i] ?? false) ? 1 : 0);
    }, 0);
  });
  const maxScore   = habitsOrdered.filter(h => !(STATE.habits.find(s=>s.id===h.id)?.blocked)).length || 1;
  const scoreRow   = last7.map((_, i) => {
    const s   = dayScores[i];
    const pct = Math.round(s / maxScore * 100);
    const col = pct === 100 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-amber)' : 'var(--color-error)';
    const isToday = i === todayIdx;
    return `<td class="hcg-score-cell${isToday ? ' hcg-score-today' : ''}">
      <div class="hcg-score-bar-wrap">
        <div class="hcg-score-bar" style="height:${pct}%;background:${col}"></div>
      </div>
      <div class="hcg-score-num" style="color:${col}">${s}/${maxScore}</div>
    </td>`;
  }).join('');

  el.innerHTML = `
    <table class="hcg-table">
      <thead>
        <tr>
          <th class="hcg-th hcg-habit-col">HABIT</th>
          ${colHeaders}
          <th class="hcg-th hcg-pct-col">RATE</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="hcg-score-row">
          <td class="hcg-habit-label" style="color:var(--color-text-muted);font-size:0.62rem;letter-spacing:0.08em">DAILY SCORE</td>
          ${scoreRow}
          <td></td>
        </tr>
      </tbody>
    </table>`;
}

function buildWeekView() {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const today = new Date();

  // Last 7 days (oldest to newest)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  // Per-habit per-day history matrix [habit][day 0..6]
  // day 6 = today (uses live STATE.habits[].done)
  // Realistic simulation: GYM consistent, KITE rare (repair), MUA blocked, DOG good
  const habitHistory = {
    gym:  [true,  false, true,  true,  true,  false, STATE.habits.find(h=>h.id==='gym')?.done  ?? false],
    kite: [false, false, false, false, false, false, STATE.habits.find(h=>h.id==='kite')?.done ?? false],
    muay: [false, false, false, false, false, false, STATE.habits.find(h=>h.id==='muay')?.done ?? false],
    dogs: [true,  true,  false, true,  true,  true,  STATE.habits.find(h=>h.id==='dogs')?.done ?? false],
  };

  // Habit completion grid 7×4
  buildHabitCompletionGrid(last7, habitHistory);

  // Simulate realistic habit completion for each day
  // (today uses real STATE data for the last cell)
  const simHabitScores = [3, 2, 4, 4, 3, 2, STATE.habits.filter(h => h.done).length];
  const maxHabits = STATE.habits.filter(h => !h.blocked).length || 3;

  // Simulate session hours per day (0–3h, today partial)
  const simSessionHours = [1.5, 2.0, 0.0, 2.5, 1.0, 3.0, STATE.session.elapsed ? +(STATE.session.elapsed / 3600).toFixed(1) : 0.5];

  // Simulate kite vs gym split over the 7 days
  const simKite = 1;
  const simGym  = 4;
  const simRest = 2; // rest / neither

  // ── KPIs ──
  const totalHabits = simHabitScores.reduce((a, b) => a + b, 0);
  const maxPossible = maxHabits * 7;
  const habitPct = Math.min(100, Math.round(totalHabits / maxPossible * 100));
  const totalHours = simSessionHours.reduce((a, b) => a + b, 0).toFixed(1);
  const bestStreak = Math.max(...STATE.habits.map(h => h.streak));

  document.getElementById('weekKpis').innerHTML = `
    <div class="week-kpi">
      <div class="week-kpi-value">${habitPct}%</div>
      <div class="week-kpi-label">Habit completion rate</div>
      <div class="week-kpi-delta up">↑ vs last week</div>
    </div>
    <div class="week-kpi">
      <div class="week-kpi-value">${totalHours}h</div>
      <div class="week-kpi-label">AI project sessions</div>
      <div class="week-kpi-delta up">↑ 1.5h vs last week</div>
    </div>
    <div class="week-kpi">
      <div class="week-kpi-value">${bestStreak}d</div>
      <div class="week-kpi-label">Best current streak</div>
      <div class="week-kpi-delta ${bestStreak >= 3 ? 'up' : 'flat'}">${bestStreak >= 3 ? 'ON FIRE' : 'KEEP GOING'}</div>
    </div>
    <div class="week-kpi">
      <div class="week-kpi-value">${simKite}/${simKite + simGym}</div>
      <div class="week-kpi-label">Kite days this week</div>
      <div class="week-kpi-delta flat">Wind season starting</div>
    </div>
  `;

  // ── HABIT BARS ──
  const habitData = STATE.habits.map(h => {
    // Simulate how many days out of 7 they were completed
    const sim = h.blocked ? 0 : Math.floor(Math.random() * 4) + 2;
    return { ...h, weekDays: Math.min(sim, 7) };
  });

  document.getElementById('weekHabitBars').innerHTML = habitData.map(h => {
    const pct = Math.round(h.weekDays / 7 * 100);
    return `
      <div class="week-habit-bar-row">
        <div class="week-habit-bar-label">${h.name}</div>
        <div class="week-habit-bar-track">
          <div class="week-habit-bar-fill ${pct === 100 ? 'full' : ''}" style="width:${pct}%"></div>
        </div>
        <div class="week-habit-bar-pct">${pct}%</div>
      </div>
    `;
  }).join('');

  // ── DAILY HEATMAP (7-day row) ──
  document.getElementById('weekHeatmapRow').innerHTML = last7.map((d, i) => {
    const score = Math.min(simHabitScores[i], 4);
    const dayName = days[d.getDay()];
    const isToday = i === 6;
    return `
      <div class="week-heatmap-cell">
        <div class="week-heatmap-day" style="${isToday ? 'color:var(--color-primary);font-weight:800' : ''}">${dayName}</div>
        <div class="week-heatmap-square" data-score="${score}" title="${score}/${maxHabits} habits"></div>
        <div class="week-heatmap-num">${simHabitScores[i]}</div>
      </div>
    `;
  }).join('');

  // ── SESSION HOURS CHART ──
  const maxHrs = Math.max(...simSessionHours, 1);
  document.getElementById('weekSessionChart').innerHTML = last7.map((d, i) => {
    const hrs = simSessionHours[i];
    const heightPct = Math.round(hrs / maxHrs * 100);
    const isToday = i === 6;
    const dayName = days[d.getDay()];
    return `
      <div class="week-session-bar-wrap">
        <div class="week-session-bar-hrs">${hrs > 0 ? hrs + 'h' : ''}</div>
        <div class="week-session-bar ${isToday ? 'today' : ''}" style="height:${heightPct}%"></div>
        <div class="week-session-bar-day" style="${isToday ? 'color:var(--color-primary);font-weight:800' : ''}">${dayName}</div>
      </div>
    `;
  }).join('');

  const totalHrs = simSessionHours.reduce((a, b) => a + b, 0).toFixed(1);
  document.getElementById('weekSessionTotal').innerHTML =
    `Total this week: <strong>${totalHrs}h</strong> across AI projects`;

  // ── KITE / GYM DONUT ──
  const total = simKite + simGym + simRest;
  const kiteAngle = simKite / total * 360;
  const gymAngle  = simGym  / total * 360;
  const restAngle = simRest / total * 360;

  // Build SVG donut
  function describeArc(cx, cy, r, startAngle, endAngle) {
    const toRad = a => (a - 90) * Math.PI / 180;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(endAngle));
    const y2 = cy + r * Math.sin(toRad(endAngle));
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  }

  const cx = 50, cy = 50, r = 40, ri = 22;
  let a0 = 0;
  const kiteEnd  = a0 + kiteAngle; const gymEnd = kiteEnd + gymAngle; const restEnd = gymEnd + restAngle;

  const segments = [
    { start: a0, end: kiteEnd, fill: 'var(--color-primary)' },
    { start: kiteEnd, end: gymEnd, fill: 'var(--color-success)' },
    { start: gymEnd, end: restEnd, fill: 'var(--color-surface-offset)' },
  ].filter(s => s.end > s.start);

  const paths = segments.map(s =>
    `<path d="${describeArc(cx, cy, r, s.start, s.end)}" fill="${s.fill}" />`
  ).join('');

  document.getElementById('weekRatioChart').innerHTML = `
    <div class="week-ratio-donut-wrap">
      <svg class="week-ratio-donut" viewBox="0 0 100 100">
        ${paths}
        <circle cx="${cx}" cy="${cy}" r="${ri}" fill="var(--color-surface)" />
        <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"
          font-size="11" font-weight="800" fill="var(--color-text)" font-family="'Cabinet Grotesk',sans-serif">
          ${simKite + simGym}d
        </text>
      </svg>
      <div class="week-ratio-stats">
        <div class="week-ratio-stat">
          <div class="week-ratio-dot" style="background:var(--color-primary)"></div>
          <div>
            <div class="week-ratio-stat-label">🪁 Kite</div>
            <div class="week-ratio-stat-count">${simKite} day${simKite !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div class="week-ratio-stat">
          <div class="week-ratio-dot" style="background:var(--color-success)"></div>
          <div>
            <div class="week-ratio-stat-label">🏋️ Gym</div>
            <div class="week-ratio-stat-count">${simGym} day${simGym !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div class="week-ratio-stat">
          <div class="week-ratio-dot" style="background:var(--color-surface-offset)"></div>
          <div>
            <div class="week-ratio-stat-label">😴 Rest</div>
            <div class="week-ratio-stat-count">${simRest} day${simRest !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('weekRatioLegend').textContent =
    `Kite season is starting — wind is picking up. Target: 3+ kite days/week when kites are back from repair.`;

  // ── SUMMARY ──
  const topProject = STATE.projects.sort((a, b) => {
    const o = { high: 0, medium: 1, low: 2 };
    return o[a.priority] - o[b.priority];
  })[0];

  document.getElementById('weekSummaryText').innerHTML = `
    <div class="week-summary-item">
      <div class="week-summary-item-title">💪 Physical</div>
      <div class="week-summary-item-content">
        ${simKite} kite session${simKite !== 1 ? 's' : ''}, ${simGym} gym session${simGym !== 1 ? 's' : ''}.
        Shoulder recovery at ${STATE.settings.shoulderDaysLeft} days — Muay Thai soon.
        Kites still in repair but wind season is live.
      </div>
    </div>
    <div class="week-summary-item">
      <div class="week-summary-item-title">🤖 AI Work</div>
      <div class="week-summary-item-content">
        ${totalHrs}h across ${STATE.projects.length} project${STATE.projects.length !== 1 ? 's' : ''}.
        Top priority: ${topProject ? topProject.name : '—'}.
        Consistency building — push for 2h+ daily blocks.
      </div>
    </div>
    <div class="week-summary-item">
      <div class="week-summary-item-title">🐕 Habits</div>
      <div class="week-summary-item-content">
        ${habitPct}% overall completion rate.
        Dog training is the most consistent anchor habit this week.
        ${bestStreak >= 3 ? `Best streak: ${bestStreak} days 🔥` : 'Build longer streaks by anchoring to morning routine.'}
      </div>
    </div>
  `;
}

// ── TAB NAVIGATION ────────────────────────────────────────────────────────
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  const todayView = document.getElementById('mainArea');
  const weekView  = document.getElementById('weekView');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      if (tab.dataset.tab === 'week') {
        todayView.style.display = 'none';
        weekView.style.display = 'flex';
        buildWeekView();
      } else {
        todayView.style.display = '';
        weekView.style.display = 'none';
      }
    });
  });
}

// Patch init to include new features
const _origInit = init;
window.addEventListener('DOMContentLoaded', () => {
  buildGCalEvents();
  setInterval(buildGCalEvents, 5 * 60 * 1000);
  initTabs();
}, { once: true });
