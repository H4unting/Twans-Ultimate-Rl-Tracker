/** Connect to local RL stats bridge for automatic G/A/S + auto-log from the game */

import { showToast } from './ui.js';
import { loadPrefs, savePrefs, isAutoLogEnabled } from './quicklog.js';
import { isDashboardIdle } from './dash-context.js';
import { state } from './state.js';
import { GAME_IDS } from './games.js';
import {
  isBridgeUp, getBridgeUrl, fetchBridgeStatus, bridgeFetch, bridgeStatusSig, noteBridgeStatus,
  subscribeBridgeProcessState, markMatchEndPending, noteMatchEndDetected,
} from './bridge-client.js';
import { setCachedRlInMatch, refreshBridgeStatusUI } from './bridge-ui.js';
import { DESKTOP_APP } from './config.js';

const POLL_ACTIVE_MS = 1000;
const POLL_MATCH_END_MS = 500;
const POLL_IDLE_MS = 5000;
const POLL_DASH_IDLE_MS = 8000;
const POLL_HIDDEN_MS = 10000;
const MATCH_END_BURST_MS = 45000;

let pollTimer = null;
let wasBridgeUp = false;
let lastAppliedEnd = 0;
let autoLogInFlight = false;
let onVisibilityChange = null;
let dashEventWired = false;
let lastRlBridgeSig = '';
let lastRlProcessActive = false;
let lastInMatch = false;
let matchEndBurstUntil = 0;
let unsubBridgeProcess = null;

const callbacks = { onMatchStats: null, onStatusChange: null, onAutoLog: null };

function shouldPeriodicPoll() {
  if (document.visibilityState === 'hidden') return false;
  if (isDashboardIdle()) return false;
  return true;
}

function getPollIntervalMs() {
  if (state.activeGame !== GAME_IDS.ROCKET_LEAGUE) return POLL_IDLE_MS;
  if (!isBridgeUp()) return POLL_IDLE_MS;
  if (Date.now() < matchEndBurstUntil) return POLL_MATCH_END_MS;
  return POLL_ACTIVE_MS;
}

function schedulePoll() {
  if (pollTimer) clearTimeout(pollTimer);
  if (!shouldPeriodicPoll()) {
    pollTimer = null;
    return;
  }
  pollTimer = setTimeout(async () => {
    await pollBridge();
    if (pollTimer !== null) schedulePoll();
  }, getPollIntervalMs());
}

function onBridgeRlProcessChange({ rocketLeagueRunning, rlConnected, inMatch }) {
  const next = Boolean(rocketLeagueRunning || rlConnected);
  if (next !== lastRlProcessActive) {
    const started = next && !lastRlProcessActive;
    lastRlProcessActive = next;
    refreshBridgeStatusUI();
    if (started) {
      void pollBridge({ forceUi: true });
      schedulePoll();
    }
  }
  const nextInMatch = Boolean(inMatch);
  if (lastInMatch && !nextInMatch) {
    matchEndBurstUntil = Date.now() + MATCH_END_BURST_MS;
    markMatchEndPending();
    refreshBridgeStatusUI();
    void pollBridge({ forceUi: true });
    schedulePoll();
  }
  lastInMatch = nextInMatch;
}

function wireDashIdleResume() {
  if (dashEventWired) return;
  dashEventWired = true;
  const onDashEvent = () => {
    void pollBridge({ forceUi: true });
    schedulePoll();
  };
  document.addEventListener('tracker-data-changed', onDashEvent);
  document.addEventListener('rl-session-start', onDashEvent);
  document.addEventListener('rl-session-ui-refresh', onDashEvent);
}

function refreshRlBridgeUI(status, { force = false } = {}) {
  const sig = status ? bridgeStatusSig(status) : 'offline';
  if (!force && sig === lastRlBridgeSig && state.activeGame === GAME_IDS.ROCKET_LEAGUE) return;
  lastRlBridgeSig = sig;
  if (status) noteBridgeStatus(status);
  setCachedRlInMatch(Boolean(status?.inMatch));
  refreshBridgeStatusUI();
}

function stopPolling() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
}

export function initRlLive(onMatchStats, onStatusChange, onAutoLog) {
  callbacks.onMatchStats = onMatchStats;
  callbacks.onStatusChange = onStatusChange;
  callbacks.onAutoLog = onAutoLog;
  stopRlLive();
  lastRlProcessActive = false;
  lastInMatch = false;
  matchEndBurstUntil = 0;
  unsubBridgeProcess = subscribeBridgeProcessState(onBridgeRlProcessChange);
  wireDashIdleResume();
  schedulePoll();
  void pollBridge();
  onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      stopPolling();
      return;
    }
    schedulePoll();
    void pollBridge({ forceUi: true });
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
}

export function stopRlLive() {
  if (unsubBridgeProcess) {
    unsubBridgeProcess();
    unsubBridgeProcess = null;
  }
  stopPolling();
  if (onVisibilityChange) {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    onVisibilityChange = null;
  }
  lastRlProcessActive = false;
  lastInMatch = false;
  matchEndBurstUntil = 0;
  setCachedRlInMatch(false);
  refreshBridgeStatusUI();
}

async function pollBridge({ forceUi = false } = {}) {
  const online = isBridgeUp();

  if (online !== wasBridgeUp) {
    wasBridgeUp = online;
    if (!online && state.activeGame === GAME_IDS.ROCKET_LEAGUE) {
      showToast(`${DESKTOP_APP.name} disconnected`, 'error');
    }
    callbacks.onStatusChange?.();
  }

  if (state.activeGame !== GAME_IDS.ROCKET_LEAGUE) {
    refreshRlBridgeUI(null, { force: forceUi });
    return;
  }

  if (!online) {
    refreshRlBridgeUI(null, { force: forceUi || !lastRlBridgeSig });
    return;
  }

  try {
    const status = await fetchBridgeStatus();
    if (!status) {
      refreshRlBridgeUI(null, { force: forceUi || !lastRlBridgeSig });
      return;
    }

    refreshRlBridgeUI(status, { force: forceUi });
    lastInMatch = Boolean(status.inMatch);

    const lastRes = await fetch(`${getBridgeUrl()}/last-match`, { signal: AbortSignal.timeout(3000) });
    const last = await lastRes.json();
    if (last && !last.consumed && last.endedAt > lastAppliedEnd) {
      noteMatchEndDetected();
      callbacks.onMatchStats?.(last);

      let handled = false;
      if (isAutoLogEnabled() && last.result && callbacks.onAutoLog && !autoLogInFlight) {
        autoLogInFlight = true;
        try {
          const ok = await callbacks.onAutoLog(last);
          if (ok !== false) handled = true;
        } finally {
          autoLogInFlight = false;
        }
      }

      if (handled) {
        lastAppliedEnd = last.endedAt;
        await bridgeFetch('/last-match/consume', { method: 'POST' });
      } else if (last.result) {
        lastAppliedEnd = last.endedAt;
        showToast(`${last.result === 'W' ? 'Win' : 'Loss'} · G:${last.goals} A:${last.assists} S:${last.saves} — tap LOG`);
        await bridgeFetch('/last-match/consume', { method: 'POST' });
      } else {
        lastAppliedEnd = last.endedAt;
        showToast(`Stats ready — G:${last.goals} A:${last.assists} S:${last.saves}. Pick W/L + MMR.`);
        await bridgeFetch('/last-match/consume', { method: 'POST' });
      }
    }
  } catch {
    /* match fetch failed — heartbeat owns online/offline state */
  }
}

export function refreshLiveStatus() {
  void pollBridge({ forceUi: true });
}

export { isBridgeUp };

export function saveRlDisplayName(name) {
  savePrefs({ rlDisplayName: name?.trim() || '' });
}

export function getRlDisplayName() {
  return loadPrefs().rlDisplayName ?? '';
}

export async function fetchBridgeSetupStatus() {
  const res = await fetch(`${getBridgeUrl()}/setup/status`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error('Bridge offline');
  return res.json();
}

export async function applyBridgeSetup({
  rlDisplayName, riotId, henrikApiKey, riotApiKey, riotRegion, patchIni = true,
}) {
  const name = rlDisplayName?.trim();
  const riot = riotId?.trim();
  if (!name && !riot) throw new Error('Enter your Rocket League name or Riot ID first');

  const res = await bridgeFetch('/setup/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rlDisplayName: name,
      riotId: riot,
      henrikApiKey: (henrikApiKey ?? riotApiKey)?.trim() || undefined,
      riotRegion: riotRegion?.trim() || undefined,
      patchIni,
    }),
    signal: AbortSignal.timeout(15000),
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    throw new Error(data.error || 'Could not apply settings');
  }

  const prefsPatch = {};
  if (name) {
    saveRlDisplayName(name);
    prefsPatch.rlDisplayName = name;
  }
  if (riot) prefsPatch.riotId = riot;
  if (riotRegion) prefsPatch.riotRegion = riotRegion;
  if (Object.keys(prefsPatch).length) savePrefs(prefsPatch);
  return data;
}
