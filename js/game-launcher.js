/** Play Rocket League / Valorant — launch via local bridge + start monitoring */

import { GAME_IDS } from './games.js';
import { state } from './state.js';
import { bridgeFetch, isBridgeUp } from './bridge-client.js';
import { showToast } from './ui.js';
import { startSession } from './sessions.js';
import { DESKTOP_APP } from './config.js';
import { STATUS } from './status-copy.js';

let wired = false;

export async function launchGame(gameId = state.activeGame) {
  if (!isBridgeUp()) {
    showToast(`Start ${DESKTOP_APP.exe} first, then try again`, 'error');
    return false;
  }

  const path = gameId === GAME_IDS.VALORANT
    ? '/launch/valorant'
    : '/launch/rocket-league';

  try {
    const res = await bridgeFetch(path, { method: 'POST' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) {
      showToast(json.error || 'Could not launch game', 'error');
      return false;
    }
    const label = gameId === GAME_IDS.VALORANT ? 'Valorant' : 'Rocket League';
    if (json.alreadyRunning) {
      showToast(json.focused
        ? `${label} is already running — switched to game`
        : `${label} is already running`);
    } else {
      showToast(`Launching ${label}…`);
    }
    if (!state.session.active) startSession({ silent: true });
    return true;
  } catch {
    showToast(`${STATUS.connectionIssue} — reopen ${DESKTOP_APP.name} from the tray`, 'error');
    return false;
  }
}

export function wirePlayButtons() {
  if (wired) return;
  wired = true;

  document.getElementById('play-rl-btn')?.addEventListener('click', () => {
    void launchGame(GAME_IDS.ROCKET_LEAGUE);
  });
  document.getElementById('play-val-btn')?.addEventListener('click', () => {
    void launchGame(GAME_IDS.VALORANT);
  });
  document.getElementById('session-play-btn')?.addEventListener('click', () => {
    void launchGame(state.activeGame);
  });
}
