/** Win-rate trends — game-agnostic */

import { calculateWinrate } from './game-stats.js';

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

export function getPlaylistStats(games, diffField = 'mmrDiff') {
  const modes = {};
  games.forEach(g => {
    if (!modes[g.mode]) modes[g.mode] = { wins: 0, losses: 0, games: 0, mmrGain: 0 };
    modes[g.mode].games++;
    modes[g.mode].mmrGain += g[diffField] || 0;
    if (g.result === 'W') modes[g.mode].wins++;
    else modes[g.mode].losses++;
  });
  return Object.entries(modes).map(([mode, s]) => ({
    mode,
    ...s,
    winRate: s.games ? Math.round(s.wins / s.games * 100) : 0,
  })).sort((a, b) => b.winRate - a.winRate);
}

export function getImprovementTrend(games) {
  if (games.length < 6) return { direction: 'insufficient', delta: 0 };
  const mid = Math.floor(games.length / 2);
  const firstHalf = games.slice(0, mid);
  const secondHalf = games.slice(mid);
  const wr1 = firstHalf.filter(g => g.result === 'W').length / firstHalf.length;
  const wr2 = secondHalf.filter(g => g.result === 'W').length / secondHalf.length;
  const delta = Math.round((wr2 - wr1) * 100);
  return {
    direction: delta > 5 ? 'improving' : delta < -5 ? 'declining' : 'stable',
    delta,
    firstHalfWR: Math.round(wr1 * 100),
    secondHalfWR: Math.round(wr2 * 100),
  };
}
