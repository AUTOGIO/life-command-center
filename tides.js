/**
 * tides.js — DNPVN 2026 tide engine for João Pessoa / Porto de Cabedelo
 *
 * Source: Brazilian Navy (DNPVN), Porto de Cabedelo, PB
 *   44 harmonic components · UTC-3 · Carta 830
 *
 * Best practices applied:
 *  1. Data loaded once, cached in memory — zero repeated fetches
 *  2. Cosine interpolation between known tide events (better than linear;
 *     tidal curves are sinusoidal, not linear)
 *  3. All queries are O(log n) binary search on 1411 events
 *  4. Public API surface is intentionally minimal
 */

let _events = null; // cached array of { iso, height, type }

/**
 * Load tide data once. Returns the events array.
 * Subsequent calls return immediately from cache.
 */
export async function loadTides() {
  if (_events) return _events;
  const res = await fetch('./tides2026.json');
  const data = await res.json();
  _events = data.events; // already chronologically sorted
  return _events;
}

/**
 * Convert a local "YYYY-MM-DDTHH:MM" ISO string to epoch ms.
 * DNPVN times are UTC-3 (America/Fortaleza — no DST).
 */
function isoToMs(iso) {
  // "2026-04-23T09:06" → parse as UTC-3
  // Append -03:00 offset so Date.parse handles it correctly
  return Date.parse(iso + '-03:00');
}

/**
 * Binary search: find the index of the last event with ms <= targetMs.
 * Returns -1 if all events are after targetMs.
 */
function bisectRight(events, targetMs) {
  let lo = 0, hi = events.length - 1, result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = isoToMs(events[mid].iso);
    if (t <= targetMs) { result = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return result;
}

/**
 * Cosine interpolation between two tide extremes at time t.
 *
 * Tidal curves between adjacent high/low follow a nearly perfect cosine.
 * Standard harmonic tide formula between two extremes a and b:
 *
 *   h(t) = (a + b)/2 − (a − b)/2 · cos(π · (t − t_a) / (t_b − t_a))
 *
 * This is the admiralty "cosine rule" used by UKHO, SHOM, DHN, and NOAA
 * for manual tide calculations between tabulated extremes.
 */
function cosineInterp(h1, h2, fraction) {
  // fraction: 0 = at h1, 1 = at h2
  const mu = (1 - Math.cos(Math.PI * fraction)) / 2;
  return h1 + (h2 - h1) * mu;
}

/**
 * Get tide height at any moment in 2026.
 *
 * @param {Date|number} at — Date object or epoch ms. Defaults to now.
 * @returns {{ height: number, trend: 'rising'|'falling'|'high'|'low',
 *             prev: event, next: event, fraction: number } | null}
 */
export function getTideAt(at = Date.now()) {
  if (!_events) return null;

  const targetMs = at instanceof Date ? at.getTime() : at;
  const idx = bisectRight(_events, targetMs);

  if (idx < 0) {
    // Before first event — use first event
    return { height: _events[0].height, trend: 'unknown',
             prev: null, next: _events[0], fraction: 0 };
  }

  const prev = _events[idx];
  const next = _events[idx + 1] ?? null;

  if (!next) {
    // After last event
    return { height: prev.height, trend: 'unknown',
             prev, next: null, fraction: 1 };
  }

  const t0 = isoToMs(prev.iso);
  const t1 = isoToMs(next.iso);
  const fraction = (targetMs - t0) / (t1 - t0);
  const height = cosineInterp(prev.height, next.height, fraction);

  // Trend: prev=H next=L → falling; prev=L next=H → rising
  let trend;
  if (prev.type === 'H' && next.type === 'L') trend = 'falling';
  else if (prev.type === 'L' && next.type === 'H') trend = 'rising';
  else if (prev.type === 'H') trend = 'high'; // right at a high
  else trend = 'low';

  return { height, trend, prev, next, fraction };
}

/**
 * Get the next N tide extremes after a given time.
 *
 * @param {Date|number} after — starting time (default: now)
 * @param {number} count — how many extremes to return (default: 4)
 * @returns {Array<{ iso, height, type }>}
 */
export function getNextExtremes(after = Date.now(), count = 4) {
  if (!_events) return [];
  const targetMs = after instanceof Date ? after.getTime() : after;
  const idx = bisectRight(_events, targetMs);
  const startIdx = Math.max(0, idx + 1);
  return _events.slice(startIdx, startIdx + count);
}

/**
 * Get all tide events for a specific calendar date (local UTC-3).
 *
 * @param {string} dateStr — "YYYY-MM-DD"
 * @returns {Array<{ iso, height, type }>}
 */
export function getEventsForDate(dateStr) {
  if (!_events) return [];
  return _events.filter(e => e.iso.startsWith(dateStr));
}

/**
 * Get interpolated tide height at HH:MM on a specific date.
 * Used for the 7-day forecast strip morning window (09:00).
 *
 * @param {string} dateStr — "YYYY-MM-DD"
 * @param {string} timeStr — "HH:MM"  (local UTC-3)
 * @returns {{ height: number, trend: string } | null}
 */
export function getTideAtTime(dateStr, timeStr) {
  if (!_events) return null;
  const iso = `${dateStr}T${timeStr}`;
  const ms  = isoToMs(iso);
  const result = getTideAt(ms);
  return result ? { height: result.height, trend: result.trend, prev: result.prev, next: result.next } : null;
}

/**
 * Convenience: format a tide result for display.
 *
 * @returns {{ levelStr, trendLabel, trendArrow, nextExtremeLabel }}
 */
export function formatTide(tideResult) {
  if (!tideResult) {
    return { levelStr: '—', trendLabel: 'TIDE', trendArrow: '', nextExtremeLabel: '—' };
  }

  const { height, trend, next } = tideResult;
  const sign = height >= 0 ? '+' : '';
  const levelStr = `${sign}${height.toFixed(2)}m`;

  let trendLabel, trendArrow;
  switch (trend) {
    case 'rising':  trendLabel = 'RISING';  trendArrow = '↑'; break;
    case 'falling': trendLabel = 'FALLING'; trendArrow = '↓'; break;
    case 'high':    trendLabel = 'HIGH';    trendArrow = '';  break;
    case 'low':     trendLabel = 'LOW';     trendArrow = '';  break;
    default:        trendLabel = 'TIDE';    trendArrow = '';
  }

  let nextExtremeLabel = '—';
  if (next) {
    const t = new Date(isoToMs(next.iso));
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    nextExtremeLabel = `${next.type === 'H' ? 'High' : 'Low'} ${hh}:${mm}`;
  }

  return { levelStr, trendLabel, trendArrow, nextExtremeLabel };
}
