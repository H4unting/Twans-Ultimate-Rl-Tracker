/** Auto-start grind sessions when a game process is detected (Windows) */

import { state } from './state.js';
import { GAME_IDS } from './games.js';
import { fetchBridgeStatus, isBridgeUp } from './bridge-client.js';
import { getCachedValorantStatus } from './bridge-ui.js';
import { startSession } from './sessions.js';
import { showToast } from './ui.js';

const POLL_MS = 5000;
const AUTO_SESSION_KEY = 'rl-grind-auto-session';

let pollId = null;
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
  if (!isBridgeUp() || !isAutoSessionEnabled() || state.session.active) return;

  const status = await fetchBridgeStatus();
  if (!status) return;

  const rlRunning = Boolean(status.rocketLeagueRunning || status.rlConnected);
  const valRunning = Boolean(status.valorantProcessRunning)
    || Boolean(getCachedValorantStatus()?.valorantRunning);

  const rlStarted = rlRunning && !lastRlRunning;
  const valStarted = valRunning && !lastValRunning;
  lastRlRunning = rlRunning;
  lastValRunning = valRunning;

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

export function startProcessSessionWatcher() {
  if (pollId) return;
  pollId = setInterval(() => { void pollGameProcesses(); }, POLL_MS);
  void pollGameProcesses();
}

export function stopProcessSessionWatcher() {
  if (pollId) clearInterval(pollId);
  pollId = null;
  lastRlRunning = false;
  lastValRunning = false;
}
