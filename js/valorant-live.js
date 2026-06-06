/** Valorant live bridge client — polls local bridge for Henrik API auto-log */

import { state } from './state.js';
import { GAME_IDS } from './games.js';
import { showToast } from './ui.js';
import { isAutoLogEnabled } from './quicklog.js';
import { isBridgeUp, getBridgeUrl, setBridgeOnline, bridgeFetch } from './bridge-client.js';
import { setCachedValorantStatus, refreshBridgeStatusUI } from './bridge-ui.js';

let pollId = null;
let pollMs = 5000;
let wasBridgeUp = false;
let autoLogInFlight = false;
let pollingArmSent = false;
let onStats = null;
let onStatus = null;
let onAutoLog = null;
let onVisibilityChange = null;
let onSessionStart = null;

async function fetchJson(path, timeoutMs = 4000) {
  const res = await fetch(`${getBridgeUrl()}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error('Auto-log app error');
  return res.json();
}

function setValorantLiveStatus(valStatus = null) {
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

async function poll() {
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
      setValorantLiveStatus(null);
      refreshBridgeStatusUI();
      return;
    }
  }

  if (online !== wasBridgeUp) {
    wasBridgeUp = online;
    onStatus?.(online);
  }

  if (!online) {
    setValorantLiveStatus(null);
    refreshBridgeStatusUI();
    return;
  }

  let valStatus = null;
  try {
    valStatus = await fetchJson('/valorant/status');
    setValorantLiveStatus(valStatus);
  } catch {
    refreshBridgeStatusUI();
    return;
  }

  if (state.activeGame !== GAME_IDS.VALORANT) return;
  if (!valStatus?.configured) return;
  if (!valStatus.pollingArmed && valStatus.source !== 'overwolf') return;
  if (!valStatus.seeded && valStatus.source !== 'overwolf') return;

  try {
    const last = await fetchJson('/valorant/last-match');
    if (!last || last.consumed || !last.matchId) return;

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

export function initValorantLive(applyStats, statusCb, autoLogCb) {
  onStats = applyStats;
  onStatus = statusCb;
  onAutoLog = autoLogCb;
  stopValorantLive();
  pollingArmSent = false;
  pollMs = 3000;
  pollId = setInterval(poll, pollMs);
  poll();
  onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      ensurePollingArmed();
      poll();
    }
  };
  onSessionStart = () => {
    if (state.activeGame === GAME_IDS.VALORANT) void armValorantPolling();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  document.addEventListener('rl-session-start', onSessionStart);
}

export function stopValorantLive() {
  if (pollId) clearInterval(pollId);
  pollId = null;
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
    setCachedValorantStatus(null);
    refreshBridgeStatusUI();
    return null;
  }
  try {
    const status = await fetchJson('/valorant/status');
    setCachedValorantStatus(status);
    refreshBridgeStatusUI();
    return status;
  } catch {
    refreshBridgeStatusUI();
    return null;
  }
}

export { isBridgeUp };
