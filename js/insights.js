/** Performance insight engine — delegates to game modules */

import { groupBySession } from './core/game-stats.js';
import { getImprovementTrend } from './core/trends.js';
import { DEFAULT_GAME } from './games.js';
import { getGameModule } from './games/registry.js';

export function getPerformanceInsights(games, gameId = DEFAULT_GAME) {
  return getGameModule(gameId).getPerformanceInsights(games);
}

export function calcInsights(games, gameId = DEFAULT_GAME) {
  return getGameModule(gameId).calcInsights(games);
}

export function getTagLossCorrelations(games, gameId = DEFAULT_GAME) {
  return getGameModule(gameId).getTagLossCorrelations(games);
}

export function getRecurringMistakes(games, windowSize = 5, gameId = DEFAULT_GAME) {
  return getGameModule(gameId).getRecurringMistakes(games, windowSize);
}

export function detectTilt(games, windowSize = 4, gameId = DEFAULT_GAME) {
  return getGameModule(gameId).detectTilt(games, windowSize);
}

export function getGrindRecommendation(games, stats, tilt, gameId = DEFAULT_GAME) {
  return getGameModule(gameId).getGrindRecommendation(games, stats, tilt);
}

export function getBestSessions(games, limit = 3, gameId = DEFAULT_GAME) {
  const diffField = getGameModule(gameId).META.diffField;
  return groupBySession(games, diffField)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, limit);
}

export { getImprovementTrend };
