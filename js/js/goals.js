/** Personal goal targets — per-game (RL + Val) */

import { getGamesInWeek, calcStats, getPrimaryMode, getCurrentMMRForMode } from './utils.js';
import { GAME_IDS, getGameMeta, getTagDefinitions } from './games.js';
import { getRankDiff } from './games/registry.js';
import { state } from './state.js';
export const DEFAULT_GOALS = {
  mmrTarget: 0,
  gamesPerWeek: 15,
  winRateTarget: 50,
  focusTag: '',
};

const DEFAULT_GOALS_BY_GAME = {
  [GAME_IDS.ROCKET_LEAGUE]: { ...DEFAULT_GOALS },
  [GAME_IDS.VALORANT]: { ...DEFAULT_GOALS, gamesPerWeek: 20 },
};

/** Normalize legacy flat goals → per-game map */
export function normalizeGoalsStorage(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_GOALS_BY_GAME };
  if (raw[GAME_IDS.ROCKET_LEAGUE] || raw[GAME_IDS.VALORANT]) {
    return {
      [GAME_IDS.ROCKET_LEAGUE]: { ...DEFAULT_GOALS, ...DEFAULT_GOALS_BY_GAME[GAME_IDS.ROCKET_LEAGUE], ...(raw[GAME_IDS.ROCKET_LEAGUE] ?? {}) },
      [GAME_IDS.VALORANT]: { ...DEFAULT_GOALS, ...DEFAULT_GOALS_BY_GAME[GAME_IDS.VALORANT], ...(raw[GAME_IDS.VALORANT] ?? {}) },
    };
  }
  return {
    [GAME_IDS.ROCKET_LEAGUE]: { ...DEFAULT_GOALS, ...raw },
    [GAME_IDS.VALORANT]: { ...DEFAULT_GOALS, ...DEFAULT_GOALS_BY_GAME[GAME_IDS.VALORANT] },
  };
}

export function getActiveGoals(gameId = state.activeGame) {
  const all = normalizeGoalsStorage(state.goals);
  return all[gameId] ?? DEFAULT_GOALS;
}

export function mergeActiveGoals(patch, gameId = state.activeGame) {
  const all = normalizeGoalsStorage(state.goals);
  all[gameId] = { ...getActiveGoals(gameId), ...patch };
  return all;
}

export function weekRankGain(games, gameId = state.activeGame) {
  return getGamesInWeek(games, 0).reduce(
    (sum, g) => sum + (getRankDiff(g, gameId) || 0),
    0,
  );
}

export function getGoalProgress(games, goals, gameId = state.activeGame) {  const g = goals ?? getActiveGoals(gameId);
  const meta = getGameMeta(gameId);
  const isVal = gameId === GAME_IDS.VALORANT;
  const weekGames = getGamesInWeek(games, 0);
  const weekStats = calcStats(weekGames, gameId);
  const mode = getPrimaryMode(games, gameId);
  const currentRank = getCurrentMMRForMode(games, mode) || 0;
  const items = [];

  if (g.mmrTarget > 0) {
    if (isVal) {
      const gain = weekRankGain(weekGames, gameId);
      const pct = Math.min(100, Math.round(Math.max(0, gain) / g.mmrTarget * 100));
      items.push({
        id: 'mmr',
        label: 'Weekly RR Goal',
        pct,
        met: gain >= g.mmrTarget,
        display: `${gain >= 0 ? '+' : ''}${gain} / +${g.mmrTarget} RR`,
      });
    } else {
      const pct = Math.min(100, Math.round(currentRank / g.mmrTarget * 100));
      items.push({
        id: 'mmr',
        label: `${meta.rankLabel} Target`,
        pct,
        met: currentRank >= g.mmrTarget,
        display: `${currentRank} / ${g.mmrTarget}`,
      });
    }
  }  if (g.gamesPerWeek > 0) {
    const count = weekGames.length;
    const pct = Math.min(100, Math.round(count / g.gamesPerWeek * 100));
    items.push({
      id: 'games',
      label: isVal ? 'Matches This Week' : 'Games This Week',
      pct,
      met: count >= g.gamesPerWeek,
      display: `${count} / ${g.gamesPerWeek}`,
    });
  }
  if (g.winRateTarget > 0 && weekGames.length >= 3) {
    const pct = Math.min(100, Math.round(weekStats.winRate / g.winRateTarget * 100));
    items.push({
      id: 'wr',
      label: 'Weekly Win Rate',
      pct,
      met: weekStats.winRate >= g.winRateTarget,
      display: `${weekStats.winRate}% / ${g.winRateTarget}%`,
    });
  }
  if (g.focusTag) {
    const tagged = weekGames.filter(x => (x.tags || []).includes(g.focusTag)).length;
    items.push({
      id: 'focus',
      label: `Reduce "${g.focusTag}"`,
      pct: weekGames.length ? Math.max(0, 100 - Math.round(tagged / weekGames.length * 100)) : 100,
      met: tagged === 0,
      display: `${tagged}× this week`,
    });
  }
  return items;
}

export function getFocusTagOptions(gameId = state.activeGame) {
  return Object.keys(getTagDefinitions(gameId));
}
