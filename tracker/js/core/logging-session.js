/** Session numbers for logging — shared without importing sessions UI */

import { state, getActiveGames } from '../state.js';

export function getMaxSessionNum(games = getActiveGames()) {
  if (!games?.length) return 0;
  return games.reduce((max, g) => Math.max(max, parseInt(g.session, 10) || 1), 0);
}

export function getNextSessionNum(games = getActiveGames()) {
  return getMaxSessionNum(games) + 1;
}

/** Session number used when logging a game */
export function getLoggingSessionNum() {
  if (state.session.active && state.session.sessionNum) {
    return state.session.sessionNum;
  }
  const fromDock = parseInt(document.getElementById('dock-session-num')?.value, 10);
  if (fromDock) return fromDock;
  const fromForm = parseInt(document.getElementById('f-session')?.value, 10);
  if (fromForm) return fromForm;
  return getNextSessionNum(getActiveGames()) || 1;
}
