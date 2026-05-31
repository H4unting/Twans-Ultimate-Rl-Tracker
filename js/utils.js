/** Pure data utilities — no DOM. Game-specific logic lives in games/ */

import { DEFAULT_GAME, getGameModule, getDefaultMode, RL } from './games/registry.js';
import {
  parseDisplayDate, formatDisplayDate, formatDuration,
  getWeekStart, getWeekEnd, formatWeekLabel, getWeekKey,
} from './core/dates.js';
import {
  countTags, getMostCommonTag, calcStreak as coreCalcStreak, calculateWinrate,
  sumRankDiff, getGamesForMode, getGamesInWeek, groupBySession as coreGroupBySession,
} from './core/game-stats.js';
import {
  getRollingWinrate, getTrendDirection, getPlaylistStats as corePlaylistStats,
} from './core/trends.js';

export {
  parseDisplayDate, formatDisplayDate, formatDuration,
  getWeekStart, getWeekEnd, formatWeekLabel, getWeekKey,
  countTags, getMostCommonTag, getGamesForMode, getGamesInWeek,
  getRollingWinrate, getTrendDirection,
  calculateWinrate, sumRankDiff,
};

export const calcStreak = coreCalcStreak;

export function normalizeGame(raw) {
  const gameId = raw.game ?? DEFAULT_GAME;
  return getGameModule(gameId).normalizeGame(raw);
}

export function normalizePlayerGames(games) {
  return (games ?? []).map(normalizeGame).sort((a, b) => {
    const ga = a.game ?? DEFAULT_GAME;
    const gb = b.game ?? DEFAULT_GAME;
    if (ga !== gb) return ga.localeCompare(gb);
    return a.match - b.match;
  });
}

export function getPlayerMatches(data, playerId) {
  return normalizePlayerGames(data?.[playerId] ?? []);
}

export function filterByPlaylist(games, playlist, gameId = DEFAULT_GAME) {
  return getGameModule(gameId).filterByPlaylist(games, playlist);
}

export const MODES = RL.MODES;

export function getCurrentMMRForMode(games, mode, gameId = DEFAULT_GAME) {
  return getGameModule(gameId).getCurrentRankForMode(games, mode);
}

export function getMostRecentMode(games, gameId = DEFAULT_GAME) {
  return getGameModule(gameId).getMostRecentMode(games);
}

export function getModeWeeklyGain(games, mode, weekOffset = 0, gameId = DEFAULT_GAME) {
  const diffField = getGameModule(gameId).META.diffField;
  return sumRankDiff(getGamesInWeek(getGamesForMode(games, mode), weekOffset), diffField);
}

export function getPlaylistMMRRows(games, gameId = DEFAULT_GAME) {
  return getGameModule(gameId).getPlaylistRankRows(games);
}

export function getPriorEndMMRForMode(games, mode, beforeMatch = Infinity) {
  return RL.getPriorEndMMRForMode(games, mode, beforeMatch);
}

export function estimateMMRDelta(games, result, mode, gameId = DEFAULT_GAME) {
  const mod = getGameModule(gameId);
  return mod.estimateMMRDelta?.(games, result, mode) ?? mod.estimateRankDelta(games, result, mode);
}

export function resolveGameStartMMR(games, game) {
  return RL.resolveGameStartMMR(games, game);
}

export function repairPlaylistMMRChain(games) {
  return RL.repairPlaylistMMRChain(games);
}

export function calculateMMRGain(games, gameId = DEFAULT_GAME) {
  const diffField = getGameModule(gameId).META.diffField;
  return sumRankDiff(games, diffField);
}

export function calcStats(games, gameId = games?.[0]?.game ?? DEFAULT_GAME) {
  if (!games?.length) {
    return {
      currentMMR: 0, totalGames: 0, wins: 0, losses: 0, winRate: 0,
      totalMMRGain: 0, avgMMRSession: 0, bestGame: '-', worstGame: '-',
      streak: { type: null, count: 0 },
    };
  }
  const mod = getGameModule(gameId);
  const rankField = mod.META.rankField;
  const diffField = mod.META.diffField;
  const wins = games.filter(g => g.result === 'W').length;
  const losses = games.filter(g => g.result === 'L').length;
  const totalMMRGain = sumRankDiff(games, diffField);
  const sessions = new Set(games.map(g => `${g.session}|${g.date}`)).size;
  const diffs = games.map(g => g[diffField] || 0);
  return {
    currentMMR: games[games.length - 1][rankField] ?? 0,
    totalGames: games.length,
    wins,
    losses,
    winRate: calculateWinrate(games),
    totalMMRGain,
    avgMMRSession: sessions ? Math.round(totalMMRGain / sessions * 10) / 10 : 0,
    bestGame: diffs.length ? Math.max(...diffs) : '-',
    worstGame: diffs.length ? Math.min(...diffs) : '-',
    streak: coreCalcStreak(games),
  };
}

export function groupBySession(games, gameId = games?.[0]?.game ?? DEFAULT_GAME) {
  return coreGroupBySession(games, getGameModule(gameId).META.diffField);
}

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
    .map(row => ({ ...row, ...getSessionStats(row.games) }))
    .sort((a, b) => b.sessionNum - a.sessionNum);
}

export function getSessionStats(games, sessionNum = null) {
  const gameId = games?.[0]?.game ?? DEFAULT_GAME;
  const mod = getGameModule(gameId);
  const diffField = mod.META.diffField;
  const rankField = mod.META.rankField;
  const filtered = sessionNum != null
    ? games.filter(g => parseInt(g.session, 10) === parseInt(sessionNum, 10))
    : games;
  const wins = filtered.filter(g => g.result === 'W').length;
  const losses = filtered.filter(g => g.result === 'L').length;
  const mmrGain = sumRankDiff(filtered, diffField);
  const tagCount = {};
  filtered.forEach(g => (g.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
  const topTag = Object.entries(tagCount).sort((a, b) => b[1] - a[1])[0] ?? null;
  return {
    games: filtered.length,
    wins,
    losses,
    winRate: filtered.length ? Math.round(wins / filtered.length * 100) : 0,
    mmrGain,
    endMMR: filtered.length ? filtered[filtered.length - 1][rankField] : 0,
    topTag,
    streak: coreCalcStreak(filtered),
  };
}

export function getTagCategoryBreakdown(games, gameId = DEFAULT_GAME) {
  return getGameModule(gameId).getTagCategoryBreakdown(games);
}

export function getTagTrendBuckets(games, gameId = DEFAULT_GAME, bucketSize = 5) {
  return getGameModule(gameId).getTagTrendBuckets(games, bucketSize);
}

export function getPlaylistStats(games, gameId = DEFAULT_GAME) {
  return corePlaylistStats(games, getGameModule(gameId).META.diffField);
}

export function getPrimaryMode(games, gameId = DEFAULT_GAME) {
  if (!games.length) return getDefaultMode(gameId);
  const counts = {};
  games.forEach(g => { counts[g.mode] = (counts[g.mode] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
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
