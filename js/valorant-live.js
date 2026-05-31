/** Valorant live bridge client — polls local bridge for Riot API auto-log */

import { state } from './state.js';
import { GAME_IDS } from './games.js';
import { showToast } from './ui.js';

const BRIDGE = 'http://127.0.0.1:49200';
let pollId = null;
let wasBridgeUp = false;
let onStats = null;
let onStatus = null;
let onAutoLog = null;

async function fetchJson(path) {
  const res = await fetch(`${BRIDGE}${path}`);
  if (!res.ok) throw new Error('Bridge error');
  return res.json();
}

async function poll() {
  if (state.activeGame !== GAME_IDS.VALORANT) return;

  try {
    const status = await fetchJson('/valorant/status');
    const bridgeUp = Boolean(status.configured);
    if (bridgeUp !== wasBridgeUp) {
      onStatus?.(bridgeUp, status);
      wasBridgeUp = bridgeUp;
    }
    if (!bridgeUp) return;

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

    const logged = await onAutoLog?.(last);
    if (logged) {
      await fetch(`${BRIDGE}/valorant/last-match/consume`, { method: 'POST' });
      showToast(`${last.result === 'W' ? 'Win' : 'Loss'} · K:${last.kills} D:${last.deaths} — logged`);
    }
  } catch {
    if (wasBridgeUp) {
      wasBridgeUp = false;
      onStatus?.(false);
    }
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
    return await fetchJson('/valorant/status');
  } catch {
    return null;
  }
}
