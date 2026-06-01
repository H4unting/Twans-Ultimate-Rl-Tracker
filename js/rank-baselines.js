/** Rank baseline helpers — modes, inference, first-sign-in detection */

import {
  RL_GAME_ID, VAL_GAME_ID, RL_RANK_SETUP_MODES, VAL_RANK_SETUP_MODES,
} from './game-rank-modes.js';
import {
  applyRankBaselinesFromSettings,
  setRankBaselines,
  rankBaselinesForSettings,
  getRankBaselinesSnapshot,
  isRankBaselinesComplete,
} from './rank-baseline-store.js';

export {
  applyRankBaselinesFromSettings,
  setRankBaselines,
  rankBaselinesForSettings,
  getStoredRankBaseline,
} from './rank-baseline-store.js';

export function getRankSetupModes(gameId) {
  if (gameId === VAL_GAME_ID) return VAL_RANK_SETUP_MODES;
  return RL_RANK_SETUP_MODES;
}

export function getRankSetupGameIds() {
  return [RL_GAME_ID, VAL_GAME_ID];
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
export function inferRankBaselinesFromGames(games = []) {
  const rlGames = games.filter(g => (g.game ?? RL_GAME_ID) === RL_GAME_ID);
  const valGames = games.filter(g => (g.game ?? RL_GAME_ID) === VAL_GAME_ID);
  const out = {
    [RL_GAME_ID]: {},
    [VAL_GAME_ID]: {},
  };

  for (const mode of RL_RANK_SETUP_MODES) {
    const end = priorEndFromGamesOnly(rlGames, mode, 'endMMR');
    if (end != null) out[RL_GAME_ID][mode] = end;
  }
  for (const mode of VAL_RANK_SETUP_MODES) {
    const end = priorEndFromGamesOnly(valGames, mode, 'endRR');
    if (end != null) out[VAL_GAME_ID][mode] = end;
  }

  return out;
}

export function needsRankSetup(games = []) {
  if (isRankBaselinesComplete()) return false;
  return games.length === 0;
}

export function getRankBaselinesForUI() {
  return getRankBaselinesSnapshot();
}
