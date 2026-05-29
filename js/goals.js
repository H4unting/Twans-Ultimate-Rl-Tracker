/** Player goal system — targets + progress tracking */

import { PLAYERS } from './config.js';
import { getGamesInWeek, calcStats } from './utils.js';

const STORAGE_KEY = 'rl-grind-goals';

export const DEFAULT_GOALS = {
  mmrTarget: 0,
  gamesPerWeek: 15,
  winRateTarget: 50,
  focusTag: '',
};

export function getDefaultGoals() {
  return Object.fromEntries(PLAYERS.map(p => [p.id, { ...DEFAULT_GOALS }]));
}

export function loadGoalsLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultGoals();
    const parsed = JSON.parse(raw);
    const defaults = getDefaultGoals();
    PLAYERS.forEach(p => {
      defaults[p.id] = { ...DEFAULT_GOALS, ...parsed[p.id] };
    });
    return defaults;
  } catch {
    return getDefaultGoals();
  }
}

export function saveGoalsLocal(goals) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

export function getGoalProgress(games, goals) {
  const weekGames = getGamesInWeek(games, 0);
  const stats = calcStats(games);
  const weekStats = calcStats(weekGames);
  const currentMMR = stats.currentMMR || 0;

  const items = [];

  if (goals.mmrTarget > 0) {
    const pct = Math.min(100, Math.round(currentMMR / goals.mmrTarget * 100));
    items.push({
      id: 'mmr',
      label: 'MMR Target',
      current: currentMMR,
      target: goals.mmrTarget,
      pct,
      met: currentMMR >= goals.mmrTarget,
      display: `${currentMMR} / ${goals.mmrTarget}`,
    });
  }

  if (goals.gamesPerWeek > 0) {
    const count = weekGames.length;
    const pct = Math.min(100, Math.round(count / goals.gamesPerWeek * 100));
    items.push({
      id: 'games',
      label: 'Games This Week',
      current: count,
      target: goals.gamesPerWeek,
      pct,
      met: count >= goals.gamesPerWeek,
      display: `${count} / ${goals.gamesPerWeek}`,
    });
  }

  if (goals.winRateTarget > 0 && weekGames.length >= 3) {
    const pct = Math.min(100, Math.round(weekStats.winRate / goals.winRateTarget * 100));
    items.push({
      id: 'wr',
      label: 'Weekly Win Rate',
      current: weekStats.winRate,
      target: goals.winRateTarget,
      pct,
      met: weekStats.winRate >= goals.winRateTarget,
      display: `${weekStats.winRate}% / ${goals.winRateTarget}%`,
    });
  }

  if (goals.focusTag) {
    const tagged = weekGames.filter(g => (g.tags || []).includes(goals.focusTag)).length;
    items.push({
      id: 'focus',
      label: `Reduce "${goals.focusTag}"`,
      current: tagged,
      target: 0,
      pct: weekGames.length ? Math.max(0, 100 - Math.round(tagged / weekGames.length * 100)) : 100,
      met: tagged === 0,
      display: `${tagged}× this week`,
      invert: true,
    });
  }

  return items;
}
