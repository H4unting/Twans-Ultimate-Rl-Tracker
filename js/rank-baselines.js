/** Rank baseline helpers — modes, inference, first-sign-in detection */

import { state } from './state.js';
import { GAME_IDS } from './games/registry.js';
import { GAME_ID as RL_ID, RANK_SETUP_MODES as RL_MODES } from './games/rocketleague/config.js';
import { GAME_ID as VAL_ID, RANK_SETUP_MODES as VAL_MODES } from './games/valorant/config.js';
import {
  applyRankBaselinesFromSettings, setRankBaselines, rankBaselinesForSettings,
} from './rank-baseline-store.js';

export { applyRankBaselinesFromSettings, setRankBaselines, rankBaselinesForSettings };
export { getStoredRankBaseline } from './rank-baseline-store.js';

export function getRankSetupModes(gameId) {
  if (gameId === GAME_IDS.VALORANT) return VAL_MODES;
  return RL_MODES;
}

export function getRankSetupGameIds() {
  return [RL_ID, VAL_ID];
}

function priorEndFromGamesOnly(games, mode, endField) {
  for (let i = games.length - 1; i >= 0; i--) {
    const g = games[i];
    if (g.mode !== mode) continue;
    const end = g[endField];
    if (end != null && end !== '') return parseInt(end, 10);
  }
  return null;
}

/** Build baseline map from existing match history (for returning users). */
export function inferRankBaselinesFromGames(games = state.games) {
  const rlGames = games.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) === RL_ID);
  const valGames = games.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) === VAL_ID);
  const out = {
    [RL_ID]: {},
    [VAL_ID]: {},
  };

  for (const mode of RL_MODES) {
    const end = priorEndFromGamesOnly(rlGames, mode, 'endMMR');
    if (end != null) out[RL_ID][mode] = end;
  }
  for (const mode of VAL_MODES) {
    const end = priorEndFromGamesOnly(valGames, mode, 'endRR');
    if (end != null) out[VAL_ID][mode] = end;
  }

  return out;
}

export function needsRankSetup(games = state.games) {
  if (state.rankBaselinesComplete) return false;
  return games.length === 0;
}
