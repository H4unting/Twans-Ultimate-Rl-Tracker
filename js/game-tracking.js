/**
 * Game tracking state machine — live process verify only (never localStorage restore).
 *
 * NOT RUNNING → ATTACHING → TRACKING → PROCESSING MATCH → IDLE
 */

import { state } from './state.js';
import { GAME_IDS } from './games.js';
import {
  subscribeBridgeProcessState,
  subscribeBridgeOnline,
  fetchBridgeStatus,
  isMatchEndPending,
  markMatchEndPending,
  getHeartbeatValorantProcessRunning,
  getHeartbeatRocketLeagueRunning,
  getHeartbeatRlConnected,
  getHeartbeatRiotClientRunning,
} from './bridge-client.js';
import { isDevOverlayEnabled } from './dev-overlay.js';

function refreshTrackingUI() {
  import('./bridge-ui.js').then((m) => m.refreshBridgeStatusUI?.()).catch(() => {});
}

export const TrackingPhase = {
  IDLE: 'idle',
  ATTACHING: 'attaching',
  TRACKING: 'tracking',
  PROCESSING: 'processing',
};

const phases = {
  [GAME_IDS.ROCKET_LEAGUE]: TrackingPhase.IDLE,
  [GAME_IDS.VALORANT]: TrackingPhase.IDLE,
};

let started = false;
let startupProbeDone = false;
let unsubProcess = null;
let unsubOnline = null;
let lastHeartbeatInMatch = null;

function logStartup(msg) {
  if (isDevOverlayEnabled()) console.info(`[Startup] ${msg}`);
}

function setPhase(gameId, next) {
  if (phases[gameId] === next) return;
  phases[gameId] = next;
  refreshTrackingUI();
}

export function getGameTrackingPhase(gameId) {
  let phase = phases[gameId] ?? TrackingPhase.IDLE;
  if (phase === TrackingPhase.PROCESSING && !isMatchEndPending()) {
    phase = TrackingPhase.IDLE;
    phases[gameId] = TrackingPhase.IDLE;
  }
  if (phases[gameId] === TrackingPhase.PROCESSING && isMatchEndPending()) {
    return TrackingPhase.PROCESSING;
  }
  if (gameId === state.activeGame && isMatchEndPending()) {
    const processUp = gameId === GAME_IDS.VALORANT
      ? Boolean(getHeartbeatValorantProcessRunning())
      : Boolean(getHeartbeatRocketLeagueRunning() || getHeartbeatRlConnected());
    if (!processUp && phases[gameId] !== TrackingPhase.ATTACHING) {
      return TrackingPhase.PROCESSING;
    }
  }
  return phases[gameId] ?? TrackingPhase.IDLE;
}

export function getActiveTrackingPhase() {
  return getGameTrackingPhase(state.activeGame);
}

export function isRiotClientOnlyWaiting() {
  const riot = getHeartbeatRiotClientRunning();
  const val = getHeartbeatValorantProcessRunning();
  if (riot === null || val === null) return false;
  return Boolean(riot) && !val;
}

function isRlProcessLive(status) {
  return Boolean(status?.rocketLeagueRunning || status?.rlConnected);
}

function isValProcessLive(status) {
  return Boolean(status?.valorantProcessRunning ?? status?.valorantRunning);
}

async function attachToGame(gameId, { startup = false } = {}) {
  setPhase(gameId, TrackingPhase.ATTACHING);

  if (gameId === GAME_IDS.VALORANT) {
    const { armValorantPolling } = await import('./valorant-live.js');
    await armValorantPolling();
    const { refreshValorantStatus } = await import('./valorant-live.js');
    await refreshValorantStatus();
  } else {
    const { refreshLiveStatus } = await import('./rl-live.js');
    refreshLiveStatus();
  }

  setPhase(gameId, TrackingPhase.TRACKING);
  if (startup) {
    logStartup('Attached to existing session');
    logStartup('Tracking enabled');
  }
  refreshTrackingUI();
}

async function startupProbe() {
  if (startupProbeDone) return;
  const status = await fetchBridgeStatus();
  if (!status) return;
  startupProbeDone = true;

  logStartup(`Rocket League detected: ${status.rocketLeagueRunning ? 'YES' : 'NO'}`);
  logStartup(`Valorant detected: ${status.valorantProcessRunning ? 'YES' : 'NO'}`);
  if (status.riotClientRunning && !status.valorantProcessRunning) {
    logStartup('Riot Client only - waiting for Valorant');
  }

  const active = state.activeGame;
  if (active === GAME_IDS.ROCKET_LEAGUE && isRlProcessLive(status)) {
    await attachToGame(GAME_IDS.ROCKET_LEAGUE, { startup: true });
  } else if (active === GAME_IDS.VALORANT && isValProcessLive(status)) {
    await attachToGame(GAME_IDS.VALORANT, { startup: true });
  } else {
    if (!isRlProcessLive(status)) setPhase(GAME_IDS.ROCKET_LEAGUE, TrackingPhase.IDLE);
    if (!isValProcessLive(status)) setPhase(GAME_IDS.VALORANT, TrackingPhase.IDLE);
  }
}

function onProcessChange(payload) {
  const rlActive = Boolean(payload.rocketLeagueRunning || payload.rlConnected);
  const valActive = Boolean(payload.valorantProcessRunning);
  const rlPhase = phases[GAME_IDS.ROCKET_LEAGUE];
  const valPhase = phases[GAME_IDS.VALORANT];
  const inMatch = payload.inMatch != null ? Boolean(payload.inMatch) : null;

  if (inMatch != null && lastHeartbeatInMatch && !inMatch && rlActive) {
    markMatchEndPending();
    if (state.activeGame === GAME_IDS.ROCKET_LEAGUE
      && (rlPhase === TrackingPhase.TRACKING || rlPhase === TrackingPhase.PROCESSING)) {
      setPhase(GAME_IDS.ROCKET_LEAGUE, TrackingPhase.PROCESSING);
    }
  }
  if (inMatch != null) lastHeartbeatInMatch = inMatch;

  if (rlActive && rlPhase === TrackingPhase.IDLE) {
    if (state.activeGame === GAME_IDS.ROCKET_LEAGUE) {
      void attachToGame(GAME_IDS.ROCKET_LEAGUE);
    }
  } else if (!rlActive) {
    if (rlPhase === TrackingPhase.TRACKING && isMatchEndPending()) {
      setPhase(GAME_IDS.ROCKET_LEAGUE, TrackingPhase.PROCESSING);
    } else if (rlPhase !== TrackingPhase.ATTACHING) {
      setPhase(GAME_IDS.ROCKET_LEAGUE, TrackingPhase.IDLE);
    }
  } else if (rlActive && rlPhase === TrackingPhase.ATTACHING) {
    setPhase(GAME_IDS.ROCKET_LEAGUE, TrackingPhase.TRACKING);
  }

  if (valActive && valPhase === TrackingPhase.IDLE) {
    if (state.activeGame === GAME_IDS.VALORANT) {
      void attachToGame(GAME_IDS.VALORANT);
    }
  } else if (!valActive) {
    if (valPhase === TrackingPhase.TRACKING && isMatchEndPending()) {
      setPhase(GAME_IDS.VALORANT, TrackingPhase.PROCESSING);
    } else if (valPhase !== TrackingPhase.ATTACHING) {
      setPhase(GAME_IDS.VALORANT, TrackingPhase.IDLE);
    }
  } else if (valActive && valPhase === TrackingPhase.ATTACHING) {
    setPhase(GAME_IDS.VALORANT, TrackingPhase.TRACKING);
  }

  if (isMatchEndPending()) return;
  if (rlPhase === TrackingPhase.PROCESSING && rlActive) {
    setPhase(GAME_IDS.ROCKET_LEAGUE, TrackingPhase.TRACKING);
  }
  if (valPhase === TrackingPhase.PROCESSING && valActive) {
    setPhase(GAME_IDS.VALORANT, TrackingPhase.TRACKING);
  }
}

export function startGameTracking() {
  if (started) return;
  started = true;
  phases[GAME_IDS.ROCKET_LEAGUE] = TrackingPhase.IDLE;
  phases[GAME_IDS.VALORANT] = TrackingPhase.IDLE;
  startupProbeDone = false;

  unsubOnline = subscribeBridgeOnline((online) => {
    if (online) void startupProbe();
  });
  unsubProcess = subscribeBridgeProcessState(onProcessChange);

  if (typeof document !== 'undefined') {
    document.addEventListener('match-end-pending', () => refreshTrackingUI());
  }
}

export function stopGameTracking() {
  if (unsubProcess) {
    unsubProcess();
    unsubProcess = null;
  }
  if (unsubOnline) {
    unsubOnline();
    unsubOnline = null;
  }
  started = false;
  startupProbeDone = false;
  phases[GAME_IDS.ROCKET_LEAGUE] = TrackingPhase.IDLE;
  phases[GAME_IDS.VALORANT] = TrackingPhase.IDLE;
}

export function resetGameTrackingForActiveGame() {
  const active = state.activeGame;
  phases[GAME_IDS.ROCKET_LEAGUE] = active === GAME_IDS.ROCKET_LEAGUE
    ? TrackingPhase.IDLE
    : phases[GAME_IDS.ROCKET_LEAGUE];
  phases[GAME_IDS.VALORANT] = active === GAME_IDS.VALORANT
    ? TrackingPhase.IDLE
    : phases[GAME_IDS.VALORANT];
  startupProbeDone = false;
  void startupProbe();
}
