/** Active game router — load the correct game module */

import { state } from '../core/state.js';
import { GAME_IDS, getGameModule, DEFAULT_GAME } from './registry.js';

export { GAME_IDS, DEFAULT_GAME, getGameModule };

export function getActiveGameModule() {
  return getGameModule(state.activeGame);
}

export function loadGame(gameId = state.activeGame) {
  const mod = getGameModule(gameId);
  mod.onLoad?.();
  return mod;
}

export function loadRocketLeague() {
  return loadGame(GAME_IDS.ROCKET_LEAGUE);
}

export function loadValorant() {
  return loadGame(GAME_IDS.VALORANT);
}

/** Route boot / game-switch initialization */
export function routeActiveGame(gameId = state.activeGame) {
  switch (gameId) {
    case GAME_IDS.VALORANT:
      return loadValorant();
    case GAME_IDS.ROCKET_LEAGUE:
    default:
      return loadRocketLeague();
  }
}
