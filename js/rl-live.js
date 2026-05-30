/** Connect to local RL stats bridge for automatic G/A/S + auto-log from the game */

import { showToast } from './ui.js';
import { loadPrefs, savePrefs, isAutoLogEnabled } from './quicklog.js';

const BRIDGE = 'http://127.0.0.1:49200';
let pollId = null;
let bridgeUp = false;
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
  setLiveStatus(false);
}

async function pollBridge() {
  try {
    const res = await fetch(`${BRIDGE}/status`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) throw new Error('offline');
    const status = await res.json();
    bridgeUp = true;
    wasBridgeUp = true;
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
    callbacks.onStatusChange?.();
  } catch {
    if (wasBridgeUp) showToast('Game bridge disconnected', 'error');
    bridgeUp = false;
    wasBridgeUp = false;
    setLiveStatus(false);
    callbacks.onStatusChange?.();
  }
}

function setLiveStatus(up, inMatch = false) {
  const el = document.getElementById('live-bridge-status');
  if (!el) return;
  el.classList.toggle('connected', up);
  el.classList.toggle('in-match', up && inMatch);
  if (!up) {
    el.textContent = 'Auto stats off — run start-grind.bat';
    el.title = 'Double-click start-grind.bat on your PC, then use localhost:8080';
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
  setLiveStatus(bridgeUp);
}

export function isBridgeUp() {
  return bridgeUp;
}

export function saveRlDisplayName(name) {
  savePrefs({ rlDisplayName: name?.trim() || '' });
}

export function getRlDisplayName() {
  return loadPrefs().rlDisplayName ?? '';
}
