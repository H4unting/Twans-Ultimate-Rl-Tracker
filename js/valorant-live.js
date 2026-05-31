/** Valorant live bridge client — polls local bridge for Henrik API auto-log */

import { state } from './state.js';
import { GAME_IDS } from './games.js';
import { showToast } from './ui.js';
import { isAutoLogEnabled } from './quicklog.js';
import { isBridgeUp, getBridgeUrl } from './bridge-client.js';
import { setCachedValorantStatus, refreshBridgeStatusUI } from './bridge-ui.js';

const BRIDGE = getBridgeUrl();
let pollId = null;
let wasBridgeUp = false;
let autoLogInFlight = false;
let onStats = null;
let onStatus = null;
let onAutoLog = null;

async function fetchJson(path, timeoutMs = 4000) {
  const res = await fetch(`${BRIDGE}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error('Auto-log app error');
  return res.json();
}

function setValorantLiveStatus(valStatus = null) {
  if (valStatus) setCachedValorantStatus(valStatus);
  refreshBridgeStatusUI();
}

async function poll() {
  const online = isBridgeUp();

  if (online !== wasBridgeUp) {
    wasBridgeUp = online;
    onStatus?.(online);
  }

  if (!online) {
    setValorantLiveStatus(null);
    return;
  }

  let valStatus = null;
  try {
    valStatus = await fetchJson('/valorant/status');
    setValorantLiveStatus(valStatus);
  } catch {
    /* val status failed — bridge may still be up */
    refreshBridgeStatusUI();
    return;
  }

  if (state.activeGame !== GAME_IDS.VALORANT) return;
  if (!valStatus?.configured) return;
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
    });

    if (!isAutoLogEnabled()) {
      showToast(`${last.result === 'W' ? 'Win' : 'Loss'} · K:${last.kills} D:${last.deaths} — tap LOG`);
      await fetch(`${BRIDGE}/valorant/last-match/consume`, { method: 'POST' });
      return;
    }

    if (autoLogInFlight || !onAutoLog) return;
    autoLogInFlight = true;
    try {
      const logged = await onAutoLog(last);
      if (logged) {
        await fetch(`${BRIDGE}/valorant/last-match/consume`, { method: 'POST' });
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
  pollId = setInterval(poll, 4000);
  poll();
}

export function stopValorantLive() {
  if (pollId) clearInterval(pollId);
  pollId = null;
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
