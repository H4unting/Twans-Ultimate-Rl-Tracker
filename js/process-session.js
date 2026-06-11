/** Auto-start grind sessions when a game process is detected (Windows) */

import { state } from './state.js';
import { GAME_IDS } from './games.js';
import { fetchBridgeStatus, isBridgeUp } from './bridge-client.js';
import { startSession, endSession } from './sessions.js';
import { showToast } from './ui.js';

const POLL_ACTIVE_MS = 5000;
const POLL_HIDDEN_MS = 15000;
const AUTO_SESSION_KEY = 'rl-grind-auto-session';

let pollTimer = null;
let onVisibilityChange = null;
let lastRlRunning = false;
let lastValRunning = false;
let wiredPrefs = false;

function loadAutoSessionPref() {
  try {
    return JSON.parse(localStorage.getItem(AUTO_SESSION_KEY) ?? '{"enabled":true}');
  } catch {
    return { enabled: true };
  }
}

export function isAutoSessionEnabled() {
  return loadAutoSessionPref().enabled !== false;
}

export function setAutoSessionEnabled(enabled) {
  localStorage.setItem(AUTO_SESSION_KEY, JSON.stringify({ enabled: Boolean(enabled) }));
}

async function pollGameProcesses() {
  if (!isBridgeUp() || !isAutoSessionEnabled()) return;

  const status = await fetchBridgeStatus();
  if (!status) return;

  const rlRunning = Boolean(status.rocketLeagueRunning || status.rlConnected);
  const valRunning = Boolean(status.valorantProcessRunning);

  const rlStarted = rlRunning && !lastRlRunning;
  const valStarted = valRunning && !lastValRunning;
  const rlStopped = lastRlRunning && !rlRunning;
  const valStopped = lastValRunning && !valRunning;
  lastRlRunning = rlRunning;
  lastValRunning = valRunning;

  if (state.session.active) {
    if (state.activeGame === GAME_IDS.ROCKET_LEAGUE && rlStopped) {
      endSession({ auto: true });
      return;
    }
    if (state.activeGame === GAME_IDS.VALORANT && valStopped) {
      endSession({ auto: true });
      return;
    }
    return;
  }

  if (state.activeGame === GAME_IDS.VALORANT && valStarted) {
    startSession({ silent: true });
    showToast('Grind block started — Valorant detected');
    return;
  }
  if (state.activeGame === GAME_IDS.ROCKET_LEAGUE && rlStarted) {
    startSession({ silent: true });
    showToast('Session started — Rocket League detected');
  }
}

function getPollMs() {
  return document.visibilityState === 'hidden' ? POLL_HIDDEN_MS : POLL_ACTIVE_MS;
}

function schedulePoll() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = setTimeout(() => {
    void pollGameProcesses().finally(() => {
      if (pollTimer !== null) schedulePoll();
    });
  }, getPollMs());
}

export function startProcessSessionWatcher() {
  if (pollTimer !== null) return;
  schedulePoll();
  void pollGameProcesses();
  if (onVisibilityChange) return;
  onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = null;
      return;
    }
    schedulePoll();
    void pollGameProcesses();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
}

export function stopProcessSessionWatcher() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
  if (onVisibilityChange) {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    onVisibilityChange = null;
  }
  lastRlRunning = false;
  lastValRunning = false;
}
