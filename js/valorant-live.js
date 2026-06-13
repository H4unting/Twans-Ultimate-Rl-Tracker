/** Valorant live bridge client — polls local bridge for Henrik API auto-log */

import { isDashboardIdle } from './dash-context.js';
import { state } from './state.js';
import { GAME_IDS } from './games.js';
import { showToast } from './ui.js';
import { isAutoLogEnabled } from './quicklog.js';
import {
  isBridgeUp, getBridgeUrl, setBridgeOnline, bridgeFetch, subscribeBridgeProcessState,
  markMatchEndPending, noteMatchEndDetected,
} from './bridge-client.js';
import {
  setCachedValorantStatus, clearCachedValorantStatus, refreshBridgeStatusUI,
  patchCachedValorantProcessRunning,
} from './bridge-ui.js';

let pollTimer = null;
const POLL_TRACKING_MS = 2000;
const POLL_POST_MATCH_MS = 1500;
const POLL_WAITING_MS = 15000;
const POLL_IDLE_MS = 5000;
const POLL_HIDDEN_MS = 10000;
const POST_MATCH_WINDOW_MS = 180000;
let wasBridgeUp = false;
let autoLogInFlight = false;
let pollingArmSent = false;
let onStats = null;
let onStatus = null;
let onAutoLog = null;
let onVisibilityChange = null;
let onSessionStart = null;
let dashEventWired = false;
let lastValStatusSig = '';
let lastValorantProcessRunning = false;
let postExitBurstUntil = 0;
let postMatchPollUntil = 0;
let unsubBridgeProcess = null;

async function fetchJson(path, timeoutMs = 4000) {
  const res = await fetch(`${getBridgeUrl()}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error('Auto-log app error');
  return res.json();
}

function valStatusSig(valStatus) {
  if (!valStatus) return 'null';
  return [
    valStatus.configured ? 1 : 0,
    (valStatus.valorantProcessRunning ?? valStatus.valorantRunning) ? 1 : 0,
    valStatus.pollingArmed ? 1 : 0,
    valStatus.seeded ? 1 : 0,
    valStatus.source ?? '',
    valStatus.lastError ?? '',
  ].join(':');
}

function setValorantLiveStatus(valStatus = null, { force = false } = {}) {
  const sig = valStatusSig(valStatus);
  if (!force && sig === lastValStatusSig) return;
  lastValStatusSig = sig;
  if (valStatus) setCachedValorantStatus(valStatus);
  refreshBridgeStatusUI();
}

export async function armValorantPolling() {
  if (state.activeGame !== GAME_IDS.VALORANT) return false;
  if (!isBridgeUp()) return false;
  try {
    const res = await bridgeFetch('/valorant/arm', {
      method: 'POST',
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) pollingArmSent = true;
    return res.ok;
  } catch {
    return false;
  }
}

async function ensurePollingArmed() {
  if (pollingArmSent) return;
  if (state.activeGame !== GAME_IDS.VALORANT) return;
  if (!isBridgeUp()) return;
  await armValorantPolling();
}

async function poll({ forceUi = false } = {}) {
  await ensurePollingArmed();
  let online = isBridgeUp();

  if (!online) {
    try {
      const res = await fetch(`${getBridgeUrl()}/status`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        setBridgeOnline(true);
        online = true;
      }
    } catch {
      setValorantLiveStatus(null, { force: forceUi });
      return;
    }
  }

  if (online !== wasBridgeUp) {
    wasBridgeUp = online;
    onStatus?.(online);
  }

  if (!online) {
    setValorantLiveStatus(null, { force: forceUi || !lastValStatusSig });
    return;
  }

  let valStatus = null;
  try {
    valStatus = await fetchJson('/valorant/status');
    lastValorantProcessRunning = Boolean(valStatus?.valorantProcessRunning ?? valStatus?.valorantRunning);
    setValorantLiveStatus(valStatus, { force: forceUi });
  } catch {
    if (forceUi) refreshBridgeStatusUI();
    return;
  }

  if (state.activeGame !== GAME_IDS.VALORANT) return;
  if (!valStatus?.configured) return;
  if (!valStatus.pollingArmed && valStatus.source !== 'overwolf') return;
  if (!valStatus.seeded && valStatus.source !== 'overwolf') return;

  try {
    const last = await fetchJson('/valorant/last-match');
    if (!last || last.consumed || !last.matchId) return;
    if (shouldWaitForRankEnrichment(last)) return;

    noteMatchEndDetected();

    onStats?.({
      kills: last.kills,
      deaths: last.deaths,
      valAssists: last.valAssists,
      acs: last.acs,
      goals: last.kills,
      assists: last.deaths,
      saves: last.acs,
      result: last.result,
      mode: last.mode,
      agent: last.agent,
      map: last.map,
      matchId: last.matchId,
      rrChange: last.rrChange,
      endRR: last.endRR,
      endRank: last.endRank,
    });

    if (!isAutoLogEnabled()) {
      showToast(`${last.result === 'W' ? 'Win' : 'Loss'} · K:${last.kills} D:${last.deaths} — tap LOG`);
      await bridgeFetch('/valorant/last-match/consume', { method: 'POST' });
      return;
    }

    if (autoLogInFlight || !onAutoLog) return;
    autoLogInFlight = true;
    try {
      const logged = await onAutoLog(last);
      if (logged) {
        await bridgeFetch('/valorant/last-match/consume', { method: 'POST' });
        showToast(`${last.result === 'W' ? 'Win' : 'Loss'} · K:${last.kills} D:${last.deaths} — logged`);
      }
    } finally {
      autoLogInFlight = false;
    }
  } catch {
    /* match fetch failed */
  }
}

function shouldPeriodicPoll() {
  if (document.visibilityState === 'hidden') return false;
  if (state.activeGame === GAME_IDS.VALORANT) return true;
  if (isDashboardIdle()) return false;
  return true;
}

function getPollMs() {
  if (Date.now() < postMatchPollUntil) return POLL_POST_MATCH_MS;
  if (state.activeGame !== GAME_IDS.VALORANT) return POLL_IDLE_MS;
  if (!isBridgeUp()) return POLL_IDLE_MS;
  if (lastValorantProcessRunning) return POLL_TRACKING_MS;
  return POLL_WAITING_MS;
}

function schedulePoll() {
  if (pollTimer) clearTimeout(pollTimer);
  if (!shouldPeriodicPoll()) {
    pollTimer = null;
    return;
  }
  pollTimer = setTimeout(async () => {
    await poll();
    if (pollTimer !== null) schedulePoll();
  }, getPollMs());
}

function wireDashIdleResume() {
  if (dashEventWired) return;
  dashEventWired = true;
  const onDashEvent = () => {
    void poll({ forceUi: true });
    schedulePoll();
  };
  document.addEventListener('tracker-data-changed', onDashEvent);
  document.addEventListener('rl-session-start', onDashEvent);
  document.addEventListener('rl-session-ui-refresh', onDashEvent);
}

function onBridgeValorantProcessChange({ valorantProcessRunning }) {
  const next = Boolean(valorantProcessRunning);
  if (lastValorantProcessRunning && !next) {
    postMatchPollUntil = Date.now() + POST_MATCH_WINDOW_MS;
    void poll({ forceUi: true });
    schedulePoll();
  }
  if (next === lastValorantProcessRunning) return;
  lastValorantProcessRunning = next;
  patchCachedValorantProcessRunning(next);
  refreshBridgeStatusUI();
}

export function initValorantLive(applyStats, statusCb, autoLogCb) {
  onStats = applyStats;
  onStatus = statusCb;
  onAutoLog = autoLogCb;
  stopValorantLive();
  clearCachedValorantStatus();
  lastValStatusSig = '';
  lastValorantProcessRunning = false;
  postMatchPollUntil = 0;
  pollingArmSent = false;
  unsubBridgeProcess = subscribeBridgeProcessState(onBridgeValorantProcessChange);
  wireDashIdleResume();
  schedulePoll();
  void poll();
  onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = null;
      return;
    }
    schedulePoll();
    void ensurePollingArmed();
    void poll({ forceUi: true });
  };
  onSessionStart = () => {
    if (state.activeGame === GAME_IDS.VALORANT) void armValorantPolling();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  document.addEventListener('rl-session-start', onSessionStart);
}

export function stopValorantLive() {
  if (unsubBridgeProcess) {
    unsubBridgeProcess();
    unsubBridgeProcess = null;
  }
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
  if (onVisibilityChange) {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    onVisibilityChange = null;
  }
  if (onSessionStart) {
    document.removeEventListener('rl-session-start', onSessionStart);
    onSessionStart = null;
  }
}

export async function refreshValorantStatus() {
  if (!isBridgeUp()) {
    setValorantLiveStatus(null, { force: true });
    return null;
  }
  try {
    const status = await fetchJson('/valorant/status');
    setValorantLiveStatus(status, { force: true });
    return status;
  } catch {
    refreshBridgeStatusUI();
    return null;
  }
}

export { isBridgeUp };
