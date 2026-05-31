/** Valorant live bridge client — polls local bridge for Riot API auto-log */

import { state } from './state.js';
import { GAME_IDS } from './games.js';
import { showToast } from './ui.js';
import { isAutoLogEnabled } from './quicklog.js';
import { setBridgeOnline, isBridgeUp } from './bridge-client.js';
import { setCachedValorantStatus, refreshBridgeStatusUI } from './bridge-ui.js';

const BRIDGE = 'http://127.0.0.1:49200';
let pollId = null;
let wasBridgeUp = false;
let autoLogInFlight = false;
let onStats = null;
let onStatus = null;
let onAutoLog = null;

async function fetchJson(path) {
  const res = await fetch(`${BRIDGE}${path}`, { signal: AbortSignal.timeout(2000) });
  if (!res.ok) throw new Error('Auto-log app error');
  return res.json();
}

function setValorantLiveStatus(online, valStatus = null) {
  if (valStatus) setCachedValorantStatus(valStatus);
  refreshBridgeStatusUI();
}

async function poll() {
  let valStatus = null;
  try {
    await fetchJson('/status');
    setBridgeOnline(true);
    valStatus = await fetchJson('/valorant/status');
    if (wasBridgeUp !== true) {
      onStatus?.(true, valStatus);
      wasBridgeUp = true;
    }
    setValorantLiveStatus(true, valStatus);
  } catch {
    setBridgeOnline(false);
    if (wasBridgeUp) {
      wasBridgeUp = false;
      onStatus?.(false);
    }
    setValorantLiveStatus(false);
    return;
  }

  if (state.activeGame !== GAME_IDS.VALORANT) return;
  if (!valStatus?.configured || !valStatus.seeded) return;

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
    /* match fetch failed — status pill already updated */
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
  try {
    const status = await fetchJson('/valorant/status');
    setBridgeOnline(true);
    setCachedValorantStatus(status);
    refreshBridgeStatusUI();
    return status;
  } catch {
    setBridgeOnline(false);
    setCachedValorantStatus(null);
    refreshBridgeStatusUI();
    return null;
  }
}

export { isBridgeUp };