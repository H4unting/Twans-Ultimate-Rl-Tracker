/** Generic match-list stats — no game-specific fields */

import { parseDisplayDate, getWeekStart, getWeekEnd, getWeekKey } from './dates.js';

export function getGamesForMode(games, mode) {
  if (!mode) return games;
  return games.filter(g => g.mode === mode);
}

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

export function sumRankDiff(games, diffField = 'mmrDiff') {
  return games.reduce((sum, g) => sum + (g[diffField] || 0), 0);
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

export function groupBySession(games, diffField = 'mmrDiff') {
  const map = {};
  games.forEach(g => {
    const key = `${g.session}|${g.date}`;
    if (!map[key]) {
      map[key] = { key, session: g.session, date: g.date, games: [], wins: 0, losses: 0, gain: 0 };
    }
    map[key].games.push(g);
    map[key].gain += g[diffField] || 0;
    if (g.result === 'W') map[key].wins++;
    else map[key].losses++;
  });
  return Object.values(map);
}

export { getWeekStart, getWeekEnd, getWeekKey, parseDisplayDate };
