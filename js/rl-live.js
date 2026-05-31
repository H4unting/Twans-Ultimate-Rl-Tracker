/** Connect to local RL stats bridge for automatic G/A/S + auto-log from the game */



import { showToast } from './ui.js';

import { loadPrefs, savePrefs, isAutoLogEnabled } from './quicklog.js';

import { state } from './state.js';

import { GAME_IDS } from './games.js';

import { isBridgeUp, getBridgeUrl, fetchBridgeStatus } from './bridge-client.js';

import { setCachedRlInMatch, refreshBridgeStatusUI } from './bridge-ui.js';

import { DESKTOP_APP } from './config.js';



const BRIDGE = getBridgeUrl();

let pollId = null;

let wasBridgeUp = false;

let lastAppliedEnd = 0;

let autoLogInFlight = false;



const callbacks = { onMatchStats: null, onStatusChange: null, onAutoLog: null };



export function initRlLive(onMatchStats, onStatusChange, onAutoLog) {

  callbacks.onMatchStats = onMatchStats;

  callbacks.onStatusChange = onStatusChange;

  callbacks.onAutoLog = onAutoLog;

  pollId = setInterval(pollBridge, 1500);

  pollBridge();

}



export function stopRlLive() {

  if (pollId) clearInterval(pollId);

  pollId = null;

  setCachedRlInMatch(false);

  refreshBridgeStatusUI();

}



async function pollBridge() {

  const online = isBridgeUp();



  if (online !== wasBridgeUp) {

    wasBridgeUp = online;

    if (!online && state.activeGame === GAME_IDS.ROCKET_LEAGUE) {

      showToast(`${DESKTOP_APP.name} disconnected`, 'error');

    }

    callbacks.onStatusChange?.();

  }



  if (state.activeGame !== GAME_IDS.ROCKET_LEAGUE) {

    refreshBridgeStatusUI();

    return;

  }



  if (!online) {

    setCachedRlInMatch(false);

    refreshBridgeStatusUI();

    return;

  }



  try {

    const status = await fetchBridgeStatus();

    if (!status) {

      setCachedRlInMatch(false);

      refreshBridgeStatusUI();

      return;

    }



    setCachedRlInMatch(status.inMatch);

    refreshBridgeStatusUI();



    const lastRes = await fetch(`${BRIDGE}/last-match`, { signal: AbortSignal.timeout(3000) });

    const last = await lastRes.json();

    if (last && !last.consumed && last.endedAt > lastAppliedEnd) {

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

        await fetch(`${BRIDGE}/last-match/consume`, { method: 'POST' });

      } else if (last.result) {

        lastAppliedEnd = last.endedAt;

        showToast(`${last.result === 'W' ? 'Win' : 'Loss'} · G:${last.goals} A:${last.assists} S:${last.saves} — tap LOG`);

        await fetch(`${BRIDGE}/last-match/consume`, { method: 'POST' });

      } else {

        lastAppliedEnd = last.endedAt;

        showToast(`Stats ready — G:${last.goals} A:${last.assists} S:${last.saves}. Pick W/L + MMR.`);

        await fetch(`${BRIDGE}/last-match/consume`, { method: 'POST' });

      }

    }

  } catch {

    /* match fetch failed — heartbeat owns online/offline state */

  }

}



export function refreshLiveStatus() {

  refreshBridgeStatusUI();

}



export { isBridgeUp };



export function saveRlDisplayName(name) {

  savePrefs({ rlDisplayName: name?.trim() || '' });

}



export function getRlDisplayName() {

  return loadPrefs().rlDisplayName ?? '';

}



export async function fetchBridgeSetupStatus() {

  const res = await fetch(`${BRIDGE}/setup/status`, { signal: AbortSignal.timeout(3000) });

  if (!res.ok) throw new Error('Bridge offline');

  return res.json();

}



export async function applyBridgeSetup({

  rlDisplayName, riotId, henrikApiKey, riotApiKey, riotRegion, patchIni = true,

}) {

  const name = rlDisplayName?.trim();

  const riot = riotId?.trim();

  if (!name && !riot) throw new Error('Enter your Rocket League name or Riot ID first');



  const res = await fetch(`${BRIDGE}/setup/apply`, {

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


