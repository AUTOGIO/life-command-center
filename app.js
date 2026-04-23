/* =============================================
   LIFE COMMAND CENTER — app.js
   Eduardo Giovannini · life.giovannini.us
   =============================================
   All state is stored in memory (no localStorage — using
   a simple in-memory object that resets on refresh).
   For persistence that survives refresh, we use the
   sessionStorage fallback pattern.
   ============================================= */

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

// In-memory only — state persists for the browser session via JS memory.
// For true persistence across refreshes, connect a backend.
function restoreState() {
  ensureHeatmap();
}

function persistState() {
  // State lives in memory (STATE object) during the session.
  // No external storage needed.
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

// ── BLOCKERS / STATUS ──────────────────────────────────────────────────────
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
      <div class="habit-emoji">${h.emoji}</div>
      <div class="habit-name">${h.name}</div>
      <div class="habit-streak ${h.streak >= 3 ? 'hot' : ''}">
        ${h.streak > 0 ? `🔥 ${h.streak}-day streak` : (h.blocked ? '🔒 Blocked' : 'Not started')}
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

// ── LIVE CONDITIONS — Open-Meteo Wind + Marine ───────────────────────────
// Fetches both APIs in parallel. No API key required.
async function fetchConditions() {
  const { lat, lon, minWind } = STATE.settings;

  const windUrl   = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m&wind_speed_unit=kmh&timezone=America%2FFortaleza`;
  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,swell_wave_height,swell_wave_direction,swell_wave_period,sea_level_height_msl&hourly=sea_level_height_msl&forecast_hours=24&timezone=America%2FFortaleza`;

  try {
    const [windRes, marineRes] = await Promise.all([fetch(windUrl), fetch(marineUrl)]);
    const [windData, marineData] = await Promise.all([windRes.json(), marineRes.json()]);

    // ── Wind ──
    const w = windData.current;
    const speed  = Math.round(w.wind_speed_10m);
    const gusts  = Math.round(w.wind_gusts_10m);
    const dirDeg = w.wind_direction_10m;
    const dir    = windDirLabel(dirDeg);
    const temp   = Math.round(w.temperature_2m);

    document.getElementById('windSpeed').textContent = speed;
    document.getElementById('windGusts').textContent = gusts;
    document.getElementById('windDir').textContent   = dir;

    // ── Marine ──
    const m = marineData.current;
    const waveH   = m.wave_height.toFixed(1);
    const swellH  = m.swell_wave_height.toFixed(1);
    const swellDir = windDirLabel(m.swell_wave_direction);
    const swellPer = m.swell_wave_period.toFixed(0);
    const seaLevel = m.sea_level_height_msl; // metres MSL, real tidal data

    document.getElementById('waveHeight').textContent  = waveH;
    document.getElementById('swellHeight').textContent = swellH;

    // ── Real tide from sea_level_height_msl hourly series ──
    const hourlyTimes  = marineData.hourly.time;
    const hourlyLevels = marineData.hourly.sea_level_height_msl;
    const nowStr = new Date().toISOString().slice(0, 13); // "2026-04-23T10"
    const currentIdx = hourlyTimes.findIndex(t => t.startsWith(nowStr));

    // Range for normalised bar (local min/max in 24h window)
    const validLevels = hourlyLevels.filter(v => v !== null);
    const minL = Math.min(...validLevels);
    const maxL = Math.max(...validLevels);
    const range = maxL - minL || 1;
    const normPct = currentIdx >= 0
      ? Math.round(((hourlyLevels[currentIdx] - minL) / range) * 100)
      : 50;

    // Determine rising vs falling from adjacent hours
    let tideLabel = 'Tide';
    let tideArrow = '';
    if (currentIdx > 0 && currentIdx < hourlyLevels.length - 1) {
      const prev = hourlyLevels[currentIdx - 1];
      const next = hourlyLevels[currentIdx + 1];
      const current = hourlyLevels[currentIdx];
      if (current > prev && current > next) { tideLabel = 'High tide'; tideArrow = ''; }
      else if (current < prev && current < next) { tideLabel = 'Low tide'; tideArrow = ''; }
      else if (next > current) { tideLabel = 'Rising'; tideArrow = '↑'; }
      else { tideLabel = 'Falling'; tideArrow = '↓'; }
    }

    const levelM = currentIdx >= 0 ? hourlyLevels[currentIdx] : seaLevel;
    document.getElementById('tideCurrent').textContent =
      levelM !== null ? `${levelM > 0 ? '+' : ''}${levelM.toFixed(2)}m` : '—';

    // Find next extreme in hourly series
    let nextExtremeLabel = '—';
    if (currentIdx >= 0 && currentIdx < hourlyLevels.length - 2) {
      for (let i = currentIdx + 1; i < hourlyLevels.length - 1; i++) {
        const p = hourlyLevels[i - 1], c = hourlyLevels[i], n = hourlyLevels[i + 1];
        if (c !== null && p !== null && n !== null) {
          if (c > p && c > n) {
            const t = new Date(hourlyTimes[i]);
            nextExtremeLabel = `High ${t.getHours()}:00`;
            break;
          } else if (c < p && c < n) {
            const t = new Date(hourlyTimes[i]);
            nextExtremeLabel = `Low ${t.getHours()}:00`;
            break;
          }
        }
      }
    }

    document.getElementById('tideTrendLabel').textContent = `${tideLabel} ${tideArrow}`;
    document.getElementById('tideBarFill').style.width = `${normPct}%`;
    document.getElementById('tideTrendNext').textContent = `→ ${nextExtremeLabel}`;

    // ── Decision logic ──
    const kiteReady = STATE.settings.kiteStatus === 'ready';
    const windOk  = speed >= minWind;
    const gustsOk = gusts <= 45; // too gusty is dangerous
    const wavesOk = parseFloat(waveH) <= 2.0; // >2m is rough for most kiters
    STATE.conditionsOk = kiteReady && windOk;

    STATE.weather = { speed, gusts, dir, dirDeg, temp, waveH, swellH, swellDir, swellPer };
    STATE.tides   = { level: levelM, rising: tideArrow === '↑', tideLabel };

    updateConditionsIndicator(speed, gusts, dir, kiteReady, windOk, gustsOk, wavesOk, waveH);
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

function updateConditionsIndicator(speed, gusts, dir, kiteReady, windOk, gustsOk, wavesOk, waveH) {
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
  fetchConditions();
  setInterval(fetchConditions, 10 * 60 * 1000); // refresh every 10 min
  updateNudge();
  setInterval(updateNudge, 5 * 60 * 1000);
}

document.addEventListener('DOMContentLoaded', init);

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
function buildWeekView() {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const today = new Date();

  // Last 7 days (oldest to newest)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

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
      <div class="week-kpi-delta ${bestStreak >= 3 ? 'up' : 'flat'}">${bestStreak >= 3 ? '🔥 On fire' : 'Keep going'}</div>
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
        <div class="week-habit-bar-label">${h.emoji} ${h.name}</div>
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
