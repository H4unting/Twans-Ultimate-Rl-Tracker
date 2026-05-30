/** Connect to local RL Stats bridge for automatic G/A/S from the game */

import { showToast } from './ui.js';
import { loadPrefs, savePrefs } from './quicklog.js';

const BRIDGE = 'http://127.0.0.1:49200';
let pollId = null;
let bridgeUp = false;
let wasBridgeUp = false;
let lastAppliedEnd = 0;

const callbacks = { onMatchStats: null, onStatusChange: null };

export function initRlLive(onMatchStats, onStatusChange) {
  callbacks.onMatchStats = onMatchStats;
  callbacks.onStatusChange = onStatusChange;
  pollId = setInterval(pollBridge, 2500);
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
      lastAppliedEnd = last.endedAt;
      callbacks.onMatchStats?.(last);
      await fetch(`${BRIDGE}/last-match/consume`, { method: 'POST' });
      showToast(`Stats ready — G:${last.goals} A:${last.assists} S:${last.saves}. Add MMR & LOG.`);
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
    el.textContent = '● Live match — stats updating';
    el.title = 'Reading stats from Rocket League';
  } else {
    el.textContent = '● Auto stats on';
    el.title = 'G/A/S will fill in when each match ends';
  }
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
