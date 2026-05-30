/** Pure data utilities — no DOM, no side effects. All stats flow through here. */

import { TAG_DEFINITIONS } from './config.js';

// ── Normalization ─────────────────────────────────────────────────────────────

export function parseDisplayDate(dateStr) {
  if (!dateStr) return null;
  const [mm, dd, yy] = dateStr.split('/');
  return new Date(2000 + parseInt(yy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
}

export function formatDisplayDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
}

export function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** Ensure every match has a consistent shape (handles legacy data) */
export function normalizeGame(raw) {
  const startMMR = raw.startMMR ?? raw.start_mmr ?? 0;
  const endMMR = raw.endMMR ?? raw.end_mmr ?? 0;
  const tags = Array.isArray(raw.tags) ? raw.tags.filter(t => TAG_DEFINITIONS[t]) : [];
  return {
    date: raw.date ?? '',
    session: raw.session ?? 1,
    match: raw.match ?? 0,
    mode: raw.mode ?? "2's",
    result: raw.result === 'L' ? 'L' : 'W',
    goals: raw.goals ?? 0,
    assists: raw.assists ?? 0,
    saves: raw.saves ?? 0,
    startMMR,
    endMMR,
    mmrDiff: raw.mmrDiff ?? endMMR - startMMR,
    notes: raw.notes ?? '',
    tags,
  };
}

export function normalizePlayerGames(games) {
  return (games ?? []).map(normalizeGame).sort((a, b) => a.match - b.match);
}

// ── Player / playlist access ──────────────────────────────────────────────────

export function getPlayerMatches(data, playerId) {
  return normalizePlayerGames(data?.[playerId] ?? []);
}

export function filterByPlaylist(games, playlist) {
  if (!playlist || playlist === 'all') return games;
  const map = { '1s': "1's", '2s': "2's", '3s': "3's" };
  const mode = map[playlist];
  return games.filter(g => g.mode === mode);
}

export const MODES = ["1's", "2's", "3's"];

export function getGamesForMode(games, mode) {
  if (!mode) return games;
  return games.filter(g => g.mode === mode);
}

export function getCurrentMMRForMode(games, mode) {
  const modeGames = getGamesForMode(games, mode);
  return modeGames.length ? modeGames[modeGames.length - 1].endMMR : null;
}

export function getMostRecentMode(games) {
  if (!games.length) return "2's";
  return games[games.length - 1].mode;
}

export function getModeWeeklyGain(games, mode, weekOffset = 0) {
  return calculateMMRGain(getGamesInWeek(getGamesForMode(games, mode), weekOffset));
}

/** Per-playlist MMR snapshot for Home — each mode tracked separately */
export function getPlaylistMMRRows(games) {
  return MODES.map(mode => {
    const modeGames = getGamesForMode(games, mode);
    const weekGames = getGamesInWeek(modeGames, 0);
    return {
      mode,
      mmr: modeGames.length ? modeGames[modeGames.length - 1].endMMR : null,
      weekGain: calculateMMRGain(weekGames),
      weekGameCount: weekGames.length,
      totalGames: modeGames.length,
    };
  }).filter(r => r.mmr != null);
}

// ── Core stats ────────────────────────────────────────────────────────────────

export function calcStreak(games) {
  if (!games.length) return { type: null, count: 0 };
  const last = games[games.length - 1].result;
  let count = 0;
  for (let i = games.length - 1; i >= 0; i--) {
    if (games[i].result === last) count++;
    else break;
  }
  return { type: last, count };
}

export function calculateWinrate(games) {
  const wins = games.filter(g => g.result === 'W').length;
  const total = games.length;
  return total ? Math.round(wins / total * 1000) / 10 : 0;
}

export function calculateMMRGain(games) {
  return games.reduce((sum, g) => sum + (g.mmrDiff || 0), 0);
}

export function calcStats(games) {
  if (!games?.length) {
    return {
      currentMMR: 0, totalGames: 0, wins: 0, losses: 0, winRate: 0,
      totalMMRGain: 0, avgMMRSession: 0, bestGame: '-', worstGame: '-',
      streak: { type: null, count: 0 },
    };
  }
  const wins = games.filter(g => g.result === 'W').length;
  const losses = games.filter(g => g.result === 'L').length;
  const totalMMRGain = calculateMMRGain(games);
  const sessions = new Set(games.map(g => `${g.session}|${g.date}`)).size;
  const diffs = games.map(g => g.mmrDiff || 0);
  return {
    currentMMR: games[games.length - 1].endMMR,
    totalGames: games.length,
    wins,
    losses,
    winRate: calculateWinrate(games),
    totalMMRGain,
    avgMMRSession: sessions ? Math.round(totalMMRGain / sessions * 10) / 10 : 0,
    bestGame: diffs.length ? Math.max(...diffs) : '-',
    worstGame: diffs.length ? Math.min(...diffs) : '-',
    streak: calcStreak(games),
  };
}

// ── Session stats ─────────────────────────────────────────────────────────────

export function groupBySession(games) {
  const map = {};
  games.forEach(g => {
    const key = `${g.session}|${g.date}`;
    if (!map[key]) {
      map[key] = { key, session: g.session, date: g.date, games: [], wins: 0, losses: 0, gain: 0 };
    }
    map[key].games.push(g);
    map[key].gain += g.mmrDiff || 0;
    if (g.result === 'W') map[key].wins++;
    else map[key].losses++;
  });
  return Object.values(map);
}

/** All games grouped by session number (for history page) */
export function groupSessionsForHistory(games) {
  const map = new Map();
  games.forEach(g => {
    const sn = parseInt(g.session, 10) || 1;
    if (!map.has(sn)) {
      map.set(sn, { sessionNum: sn, games: [], firstDate: g.date, lastDate: g.date });
    }
    const row = map.get(sn);
    row.games.push(g);
    if (g.date < row.firstDate) row.firstDate = g.date;
    if (g.date > row.lastDate) row.lastDate = g.date;
  });
  return [...map.values()]
    .map(row => {
      const stats = getSessionStats(row.games);
      return { ...row, ...stats };
    })
    .sort((a, b) => b.sessionNum - a.sessionNum);
}

export function getSessionStats(games, sessionNum = null) {
  const filtered = sessionNum != null
    ? games.filter(g => parseInt(g.session, 10) === parseInt(sessionNum, 10))
    : games;
  const wins = filtered.filter(g => g.result === 'W').length;
  const losses = filtered.filter(g => g.result === 'L').length;
  const mmrGain = calculateMMRGain(filtered);
  const tagCount = {};
  filtered.forEach(g => (g.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
  const topTag = Object.entries(tagCount).sort((a, b) => b[1] - a[1])[0] ?? null;
  return {
    games: filtered.length,
    wins,
    losses,
    winRate: filtered.length ? Math.round(wins / filtered.length * 100) : 0,
    mmrGain,
    endMMR: filtered.length ? filtered[filtered.length - 1].endMMR : 0,
    topTag,
    streak: calcStreak(filtered),
  };
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export function countTags(games, { lossesOnly = false } = {}) {
  const counts = {};
  games.forEach(g => {
    if (lossesOnly && g.result !== 'L') return;
    (g.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; });
  });
  return counts;
}

export function getMostCommonTag(games, options = {}) {
  const counts = countTags(games, options);
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0] ?? null;
}

export function getTagCategoryBreakdown(games) {
  const counts = countTags(games);
  const breakdown = { def: 0, off: 0, men: 0 };
  Object.entries(counts).forEach(([tag, count]) => {
    const cat = TAG_DEFINITIONS[tag]?.cat;
    if (cat) breakdown[cat] += count;
  });
  return { counts, breakdown, total: Object.values(counts).reduce((a, b) => a + b, 0) };
}

// ── Playlist stats ────────────────────────────────────────────────────────────

export function getPlaylistStats(games) {
  const modes = {};
  games.forEach(g => {
    if (!modes[g.mode]) modes[g.mode] = { wins: 0, losses: 0, games: 0, mmrGain: 0 };
    modes[g.mode].games++;
    modes[g.mode].mmrGain += g.mmrDiff || 0;
    if (g.result === 'W') modes[g.mode].wins++;
    else modes[g.mode].losses++;
  });
  return Object.entries(modes).map(([mode, s]) => ({
    mode,
    ...s,
    winRate: s.games ? Math.round(s.wins / s.games * 100) : 0,
  })).sort((a, b) => b.winRate - a.winRate);
}

export function getPrimaryMode(games) {
  if (!games.length) return "2's";
  const counts = {};
  games.forEach(g => { counts[g.mode] = (counts[g.mode] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ── Rolling / trends ──────────────────────────────────────────────────────────

export function getRollingWinrate(games, windowSize = 5) {
  if (games.length < 2) return [];
  const result = [];
  for (let i = 0; i < games.length; i++) {
    const slice = games.slice(Math.max(0, i - windowSize + 1), i + 1);
    result.push({
      index: i,
      label: `#${i + 1}`,
      winRate: Math.round(slice.filter(g => g.result === 'W').length / slice.length * 100),
    });
  }
  return result;
}

export function getTrendDirection(games, windowSize = 5) {
  const last = games.slice(-windowSize);
  const prev = games.slice(-windowSize * 2, -windowSize);
  if (!prev.length) return 'neutral';
  const lastWR = last.filter(g => g.result === 'W').length / last.length;
  const prevWR = prev.filter(g => g.result === 'W').length / prev.length;
  if (lastWR > prevWR + 0.1) return 'up';
  if (lastWR < prevWR - 0.1) return 'down';
  return 'stable';
}

export function getTagTrendBuckets(games, bucketSize = 5) {
  const buckets = [];
  for (let i = 0; i < games.length; i += bucketSize) {
    const chunk = games.slice(i, i + bucketSize);
    buckets.push({
      label: `#${i + 1}-${Math.min(i + bucketSize, games.length)}`,
      def: chunk.reduce((s, g) => s + (g.tags || []).filter(t => TAG_DEFINITIONS[t]?.cat === 'def').length, 0),
      off: chunk.reduce((s, g) => s + (g.tags || []).filter(t => TAG_DEFINITIONS[t]?.cat === 'off').length, 0),
      men: chunk.reduce((s, g) => s + (g.tags || []).filter(t => TAG_DEFINITIONS[t]?.cat === 'men').length, 0),
    });
  }
  return buckets;
}

// ── Weekly grouping ───────────────────────────────────────────────────────────

/** Monday-start week containing the given date */
export function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function getWeekEnd(weekStart) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d;
}

export function formatWeekLabel(weekStart, weekEnd) {
  const opts = { month: 'short', day: 'numeric' };
  const a = weekStart.toLocaleDateString('en-US', opts);
  const b = weekEnd.toLocaleDateString('en-US', { ...opts, year: weekStart.getFullYear() !== weekEnd.getFullYear() ? 'numeric' : undefined });
  return `${a} – ${b}`;
}

export function getWeekKey(date) {
  const ws = getWeekStart(date);
  return `${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, '0')}-${String(ws.getDate()).padStart(2, '0')}`;
}

export function groupGamesByWeek(games) {
  const map = {};
  games.forEach(g => {
    const d = parseDisplayDate(g.date);
    if (!d) return;
    const key = getWeekKey(d);
    if (!map[key]) {
      const ws = getWeekStart(d);
      map[key] = { key, weekStart: ws, weekEnd: getWeekEnd(ws), games: [] };
    }
    map[key].games.push(g);
  });
  return Object.values(map).sort((a, b) => b.weekStart - a.weekStart);
}

export function getGamesInWeek(games, weekOffset = 0) {
  const now = new Date();
  const targetStart = getWeekStart(now);
  targetStart.setDate(targetStart.getDate() - weekOffset * 7);
  const targetEnd = getWeekEnd(targetStart);
  return games.filter(g => {
    const d = parseDisplayDate(g.date);
    return d && d >= targetStart && d <= targetEnd;
  });
}
