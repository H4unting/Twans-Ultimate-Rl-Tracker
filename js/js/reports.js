/** Weekly report generation — delegates to game modules */

import { DEFAULT_GAME } from './games.js';
import { getGameModule } from './games/registry.js';

export function buildWeeklyReport(games, weekOffset = 0, gameId = DEFAULT_GAME) {
  return getGameModule(gameId).buildWeeklyReport(games, weekOffset);
}

export function getWeeklyReports(games, count = 8, gameId = DEFAULT_GAME) {
  return getGameModule(gameId).getWeeklyReports(games, count);
}
