/** Valorant live bridge client — polls local bridge for Riot API auto-log */

import { state } from './state.js';
import { GAME_IDS } from './games.js';
import { showToast } from './ui.js';
import { isAutoLogEnabled } from './quicklog.js';
import { setBridgeOnline, isBridgeUp } from './bridge-client.js';

const BRIDGE = 'http://127.0.0.1:49200';
let pollId = null;
let wasBridgeUp = false;
let autoLogInFlight = false;
let onStats = null;
let onStatus = null;
let onAutoLog = null;

async function fetchJson(path) {
  const res = await fetch(`${BRIDGE}${path}`, { signal: AbortSignal.timeout(2000) });
  if (!res.ok) throw new Error('Bridge error');
  return res.json();
}

function setValorantLiveStatus(online, valStatus = null) {
  if (state.activeGame !== GAME_IDS.VALORANT) return;
  const el = document.getElementById('live-bridge-status');
  if (!el) return;

  el.classList.toggle('connected', online);
  el.classList.toggle('in-match', online && Boolean(valStatus?.valorantRunning));

  if (!online) {
    el.textContent = 'Auto stats off';
    el.title = 'Run Twans-Tracker-Bridge.exe and set Riot ID in Setup';
    return;
  }

  if (!valStatus?.configured) {
    el.textContent = '● Bridge on';
    el.title = 'Add Riot ID + API key in Setup → Apply & Go';
    return;
  }

  if (valStatus.lastError) {
    el.textContent = '● Riot API error';
    el.title = valStatus.lastError;
    return;
  }

  if (!valStatus.seeded) {
    el.textContent = '● Syncing…';
    el.title = 'Bridge is catching up — your next match will auto-log';
    return;
  }

  if (valStatus.valorantRunning && isAutoLogEnabled()) {
    el.textContent = '● Auto-log ON';
    el.title = 'Valorant running — matches log when they end';
  } else if (valStatus.valorantRunning) {
    el.textContent = '● Valorant live';
    el.title = 'Turn on auto-log in the dock to save matches automatically';
  } else if (isAutoLogEnabled()) {
    el.textContent = '● Ready';
    el.title = 'Launch Valorant — next finished match will auto-log';
  } else {
    el.textContent = '● Stats ready';
    el.title = 'Riot API connected — enable auto-log or tap LOG manually';
  }
}

async function poll() {
  let valStatus = null;
  try {
    valStatus = await fetchJson('/valorant/status');
    setBridgeOnline(true);
    const bridgeUp = true;
    if (bridgeUp !== wasBridgeUp) {
      onStatus?.(bridgeUp, valStatus);
      wasBridgeUp = bridgeUp;
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
  if (state.activeGame !== GAME_IDS.VALORANT) return null;
  try {
    const status = await fetchJson('/valorant/status');
    setValorantLiveStatus(true, status);
    return status;
  } catch {
    setValorantLiveStatus(false);
    return null;
  }
}

export { isBridgeUp };