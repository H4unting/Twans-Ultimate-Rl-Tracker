/** Connect to local RL stats bridge for automatic G/A/S + auto-log from the game */

import { showToast } from './ui.js';
import { setBridgeHintVisible } from './env.js';
import { loadPrefs, savePrefs, isAutoLogEnabled } from './quicklog.js';
import { state } from './state.js';
import { GAME_IDS } from './games.js';
import { setBridgeOnline, isBridgeUp } from './bridge-client.js';

const BRIDGE = 'http://127.0.0.1:49200';
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
  setBridgeOnline(false);
  setLiveStatus(false);
  setBridgeHintVisible(false);
}

async function pingBridge() {
  try {
    const res = await fetch(`${BRIDGE}/status`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) throw new Error('offline');
    setBridgeOnline(true);
    return await res.json();
  } catch {
    setBridgeOnline(false);
    return null;
  }
}

async function pollBridge() {
  const status = await pingBridge();
  const online = Boolean(status);

  if (online !== wasBridgeUp) {
    wasBridgeUp = online;
    if (!online && state.activeGame === GAME_IDS.ROCKET_LEAGUE) {
      showToast('Game bridge disconnected', 'error');
    }
    callbacks.onStatusChange?.();
  }

  if (state.activeGame !== GAME_IDS.ROCKET_LEAGUE) {
    return;
  }

  if (!online) {
    setLiveStatus(false);
    return;
  }

  try {
    setLiveStatus(true, status.inMatch);

    const lastRes = await fetch(`${BRIDGE}/last-match`, { signal: AbortSignal.timeout(1500) });
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
    if (wasBridgeUp) {
      wasBridgeUp = false;
      setBridgeOnline(false);
      setLiveStatus(false);
      callbacks.onStatusChange?.();
    }
  }
}

function setLiveStatus(up, inMatch = false) {
  const el = document.getElementById('live-bridge-status');
  if (!el) return;
  el.classList.toggle('connected', up);
  el.classList.toggle('in-match', up && inMatch);
  setBridgeHintVisible(!up && !document.body.classList.contains('logged-out'));

  if (!up) {
    el.textContent = 'Auto stats off';
    el.title = 'Run Twans-Tracker-Bridge.exe on this PC while playing for auto-log from Rocket League';
  } else if (inMatch) {
    el.textContent = '● Live match';
    el.title = 'Reading stats from Rocket League';
  } else if (isAutoLogEnabled()) {
    el.textContent = '● Auto-log ON';
    el.title = 'Games log automatically when a match ends';
  } else {
    el.textContent = '● Stats only';
    el.title = 'Stats fill in — you tap LOG';
  }
}

export function refreshLiveStatus() {
  setLiveStatus(isBridgeUp() && state.activeGame === GAME_IDS.ROCKET_LEAGUE);
}

export { isBridgeUp };

export function saveRlDisplayName(name) {
  savePrefs({ rlDisplayName: name?.trim() || '' });
}

export function getRlDisplayName() {
  return loadPrefs().rlDisplayName ?? '';
}

export async function fetchBridgeSetupStatus() {
  const res = await fetch(`${BRIDGE}/setup/status`, { signal: AbortSignal.timeout(1500) });
  if (!res.ok) throw new Error('Bridge offline');
  return res.json();
}

export async function applyBridgeSetup({
  rlDisplayName, riotId, riotApiKey, riotRegion, patchIni = true,
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
      riotApiKey: riotApiKey?.trim() || undefined,
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
