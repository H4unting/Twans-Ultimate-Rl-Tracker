/** Pure data utilities — no DOM, no side effects. All stats flow through here. */

import { DEFAULT_GAME, GAME_IDS, getDefaultMode, getTagDefinitions } from './games.js';

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
  const game = raw.game ?? DEFAULT_GAME;
  const tagDefs = getTagDefinitions(game);
  const tags = Array.isArray(raw.tags) ? raw.tags.filter(t => tagDefs[t]) : [];
  const startMMR = raw.startMMR ?? raw.start_mmr ?? raw.startRR ?? 0;
  const endMMR = raw.endMMR ?? raw.end_mmr ?? raw.endRR ?? 0;

  const base = {
    game,
    date: raw.date ?? '',
    session: raw.session ?? 1,
    match: raw.match ?? 0,
    mode: raw.mode ?? getDefaultMode(game),
    result: raw.result === 'L' ? 'L' : 'W',
    notes: raw.notes ?? '',
    tags,
  };

  if (game === GAME_IDS.VALORANT) {
    const startRR = raw.startRR ?? startMMR ?? 0;
    const endRR = raw.endRR ?? endMMR ?? 0;
    const kills = raw.kills ?? raw.goals ?? 0;
    const deaths = raw.deaths ?? raw.assists ?? 0;
    const valAssists = raw.valAssists ?? raw.val_assists ?? 0;
    const acs = raw.acs ?? raw.saves ?? 0;
    const rrDiff = raw.rrDiff ?? endRR - startRR;
    return {
      ...base,
      kills,
      deaths,
      valAssists,
      acs,
      agent: raw.agent ?? '',
      map: raw.map ?? '',
      startRR,
      endRR,
      rrDiff,
      goals: kills,
      assists: deaths,
      saves: acs,
      startMMR: startRR,
      endMMR: endRR,
      mmrDiff: rrDiff,
    };
  }

  return {
    ...base,
    goals: raw.goals ?? 0,
    assists: raw.assists ?? 0,
    saves: raw.saves ?? 0,
    startMMR,
    endMMR,
    mmrDiff: raw.mmrDiff ?? endMMR - startMMR,
  };
}

export function normalizePlayerGames(games) {
  return (games ?? []).map(normalizeGame).sort((a, b) => {
    const ga = a.game ?? DEFAULT_GAME;
    const gb = b.game ?? DEFAULT_GAME;
    if (ga !== gb) return ga.localeCompare(gb);
    return a.match - b.match;
  });
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
export function getPlaylistMMRRows(games, gameId = DEFAULT_GAME) {
  if (gameId === GAME_IDS.VALORANT) return getValorantQueueRows(games);

  return MODES.map(mode => {
    const modeGames = getGamesForMode(games, mode);
    const weekGames = getGamesInWeek(modeGames, 0);
    return {
      mode,
      mmr: modeGames.length ? modeGames[modeGames.length - 1].endMMR : null,
      weekGain: calculateMMRGain(weekGames),
      weekGameCount: weekGames.length,
      totalGames: modeGames.length,
      wins: modeGames.filter(g => g.result === 'W').length,
      losses: modeGames.filter(g => g.result === 'L').length,
    };
  }).filter(r => r.mmr != null);
}

/** Valorant queue rows — one card per queue you've logged */
function getValorantQueueRows(games) {
  const modes = [...new Set(games.map(g => g.mode).filter(Boolean))];
  return modes.map(mode => {
    const modeGames = getGamesForMode(games, mode);
    const weekGames = getGamesInWeek(modeGames, 0);
    return {
      mode,
      mmr: modeGames.length ? modeGames[modeGames.length - 1].endMMR : null,
      weekGain: calculateMMRGain(weekGames),
      weekGameCount: weekGames.length,
      totalGames: modeGames.length,
      wins: modeGames.filter(g => g.result === 'W').length,
      losses: modeGames.filter(g => g.result === 'L').length,
    };
  }).filter(r => r.mmr != null);
}

/** Last ending MMR for a playlist before a given match number */
export function getPriorEndMMRForMode(games, mode, beforeMatch = Infinity) {
  for (let i = games.length - 1; i >= 0; i--) {
    const g = games[i];
    if (g.match >= beforeMatch) continue;
    if (g.mode === mode && g.endMMR != null && g.endMMR !== '') return g.endMMR;
  }
  return null;
}

/** Typical MMR swing for a playlist — used when no prior game exists in that mode */
export function estimateMMRDelta(games, result, mode) {
  const recent = games.filter(g =>
    g.result === result && g.mode === mode && g.mmrDiff,
  ).slice(-15);
  if (recent.length >= 2) {
    return Math.round(recent.reduce((s, g) => s + g.mmrDiff, 0) / recent.length);
  }
  return result === 'W' ? 10 : -10;
}

/** Resolve start MMR for a game — never bleed another playlist's rating into the chain */
export function resolveGameStartMMR(games, game) {
  const priorEnd = getPriorEndMMRForMode(games, game.mode, game.match);
  if (priorEnd != null) return priorEnd;

  const endMMR = parseInt(game.endMMR, 10);
  if (!endMMR) return parseInt(game.startMMR, 10) || 0;

  const priorGames = games.filter(g => g.match < game.match);
  const est = estimateMMRDelta(priorGames, game.result, game.mode);
  return Math.max(0, endMMR - est);
}

/** Fix games where start MMR was copied from the wrong playlist */
export function repairPlaylistMMRChain(games) {
  let changed = false;
  const sorted = [...games].sort((a, b) => a.match - b.match);
  const fixed = sorted.map(g => {
    const startMMR = resolveGameStartMMR(sorted, g);
    const endMMR = parseInt(g.endMMR, 10) || 0;
    const mmrDiff = endMMR - startMMR;
    if (g.startMMR !== startMMR || g.mmrDiff !== mmrDiff) {
      changed = true;
      return { ...g, startMMR, mmrDiff };
    }
    return g;
  });
  return { games: fixed, changed };
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

function mergedTagLookup(games) {
  const ids = [...new Set((games ?? []).map(g => g.game ?? DEFAULT_GAME))];
  if (!ids.length) ids.push(DEFAULT_GAME);
  const merged = {};
  ids.forEach(id => Object.assign(merged, getTagDefinitions(id)));
  return merged;
}

export function getTagCategoryBreakdown(games, gameId = DEFAULT_GAME) {
  const counts = countTags(games);
  const defs = getTagDefinitions(gameId);
  const order = gameId === GAME_IDS.VALORANT
    ? ['aim', 'util', 'team', 'men']
    : ['def', 'off', 'men'];
  const breakdown = Object.fromEntries(order.map(k => [k, 0]));
  Object.entries(counts).forEach(([tag, count]) => {
    const cat = defs[tag]?.cat;
    if (cat && breakdown[cat] != null) breakdown[cat] += count;
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

export function getPrimaryMode(games, gameId = DEFAULT_GAME) {
  if (!games.length) return getDefaultMode(gameId);
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

export function getTagTrendBuckets(games, gameId = DEFAULT_GAME, bucketSize = 5) {
  const defs = getTagDefinitions(gameId);
  const cats = gameId === GAME_IDS.VALORANT
    ? ['aim', 'util', 'team', 'men']
    : ['def', 'off', 'men'];
  const buckets = [];
  for (let i = 0; i < games.length; i += bucketSize) {
    const chunk = games.slice(i, i + bucketSize);
    const row = { label: `#${i + 1}-${Math.min(i + bucketSize, games.length)}` };
    cats.forEach(cat => {
      row[cat] = chunk.reduce((s, g) => s + (g.tags || []).filter(t => defs[t]?.cat === cat).length, 0);
    });
    buckets.push(row);
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
