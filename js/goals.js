/** Personal goal targets */

import { getGamesInWeek, calcStats } from './utils.js';

export const DEFAULT_GOALS = {
  mmrTarget: 0,
  gamesPerWeek: 15,
  winRateTarget: 50,
  focusTag: '',
};

export function getGoalProgress(games, goals) {
  const g = goals ?? DEFAULT_GOALS;
  const weekGames = getGamesInWeek(games, 0);
  const stats = calcStats(games);
  const weekStats = calcStats(weekGames);
  const currentMMR = stats.currentMMR || 0;
  const items = [];

  if (g.mmrTarget > 0) {
    const pct = Math.min(100, Math.round(currentMMR / g.mmrTarget * 100));
    items.push({
      id: 'mmr', label: 'MMR Target', pct, met: currentMMR >= g.mmrTarget,
      display: `${currentMMR} / ${g.mmrTarget}`,
    });
  }
  if (g.gamesPerWeek > 0) {
    const count = weekGames.length;
    const pct = Math.min(100, Math.round(count / g.gamesPerWeek * 100));
    items.push({
      id: 'games', label: 'Games This Week', pct, met: count >= g.gamesPerWeek,
      display: `${count} / ${g.gamesPerWeek}`,
    });
  }
  if (g.winRateTarget > 0 && weekGames.length >= 3) {
    const pct = Math.min(100, Math.round(weekStats.winRate / g.winRateTarget * 100));
    items.push({
      id: 'wr', label: 'Weekly Win Rate', pct, met: weekStats.winRate >= g.winRateTarget,
      display: `${weekStats.winRate}% / ${g.winRateTarget}%`,
    });
  }
  if (g.focusTag) {
    const tagged = weekGames.filter(x => (x.tags || []).includes(g.focusTag)).length;
    items.push({
      id: 'focus', label: `Reduce "${g.focusTag}"`, pct: weekGames.length ? Math.max(0, 100 - Math.round(tagged / weekGames.length * 100)) : 100,
      met: tagged === 0, display: `${tagged}× this week`,
    });
  }
  return items;
}
