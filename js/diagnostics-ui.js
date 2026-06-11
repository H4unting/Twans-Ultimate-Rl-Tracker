/** Connection diagnostics — player-friendly status on Auto-Log Setup (no ports / taskkill) */

import { state } from './state.js';
import { GAME_IDS } from './games.js';
import { DESKTOP_APP } from './config.js';
import {
  isBridgeUp,
  isBridgeReachable,
  isBridgeProbeDone,
  getBridgeStatusPhase,
  subscribeBridgeOnline,
  subscribeBridgeReachable,
} from './bridge-client.js';
import {
  getCachedValorantStatus, getCachedRlInMatch, isValorantGameProcessRunning,
} from './bridge-ui.js';
import { STATUS, waitingForGameLabel } from './status-copy.js';
import { needsLocalTrackerForAutoLog } from './env.js';

let wired = false;
let pollId = null;
let unsubOnline = null;
let unsubReachable = null;

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function syncStatusLabel(status) {
  const map = {
    live: { text: 'Connected', cls: 'ok' },
    saving: { text: 'Saving…', cls: 'pending' },
    connecting: { text: 'Connecting…', cls: 'pending' },
    error: { text: 'Issue', cls: 'warn' },
  };
  return map[status] ?? { text: 'Offline', cls: 'off' };
}

function overallStatus() {
  if (needsLocalTrackerForAutoLog()) {
    return { label: 'Manual log only', cls: 'off', hint: 'This bookmark does not run the desktop game monitor. Install Twans Ultimate Tracker on your gaming PC for automatic tracking.' };
  }

  const phase = getBridgeStatusPhase();
  const up = isBridgeUp();
  const reachable = isBridgeReachable();

  if (!isBridgeProbeDone() && (phase === 'connecting' || !reachable)) {
    return { label: STATUS.starting, cls: 'pending', hint: `Starting ${DESKTOP_APP.name}…` };
  }

  if (!reachable) {
    return {
      label: STATUS.connectionIssue,
      cls: 'warn',
      hint: `Reopen ${DESKTOP_APP.name} from the system tray, or finish Auto-Log Setup.`,
    };
  }

  if (!up) {
    return {
      label: STATUS.connectionIssue,
      cls: 'warn',
      hint: `${DESKTOP_APP.name} lost connection briefly — it should recover automatically.`,
    };
  }

  const isVal = state.activeGame === GAME_IDS.VALORANT;
  if (isVal) {
    const val = getCachedValorantStatus();
    if (isValorantGameProcessRunning(val)) {
      return { label: STATUS.tracking, cls: 'ok', hint: 'Match tracking is active for Valorant.' };
    }
    if (val?.configured && val?.seeded) {
      return { label: waitingForGameLabel(GAME_IDS.VALORANT), cls: 'pending', hint: 'Ready — launch Valorant or tap Play.' };
    }
    if (val?.configured) {
      return { label: 'Almost ready', cls: 'pending', hint: 'Finish one match to complete setup.' };
    }
    return { label: 'Setup needed', cls: 'warn', hint: 'Add Riot ID and Henrik key in Auto-Log Setup.' };
  }

  const inMatch = getCachedRlInMatch();
  if (inMatch) {
    return { label: STATUS.tracking, cls: 'ok', hint: 'Live match — stats update from the game export.' };
  }
  if (up) {
    return { label: waitingForGameLabel(GAME_IDS.ROCKET_LEAGUE), cls: 'pending', hint: 'Ready — launch Rocket League or tap Play.' };
  }

  return { label: STATUS.connectionIssue, cls: 'warn', hint: 'Check Auto-Log Setup.' };
}

function gameMonitorRow() {
  if (needsLocalTrackerForAutoLog()) {
    return { label: 'Not available here', cls: 'off', hint: 'Use the desktop app on your gaming PC.' };
  }
  if (!isBridgeReachable()) {
    return { label: 'Not connected', cls: 'warn', hint: `${DESKTOP_APP.name} is not running on this PC.` };
  }
  if (!isBridgeUp()) {
    return { label: 'Reconnecting…', cls: 'pending', hint: 'Temporary drop — no action needed yet.' };
  }
  return { label: 'Connected', cls: 'ok', hint: 'Local game monitor is running.' };
}

function matchTrackingRow() {
  if (needsLocalTrackerForAutoLog()) {
    return { label: 'Manual', cls: 'off', hint: 'Log matches with the dock after each game.' };
  }

  const isVal = state.activeGame === GAME_IDS.VALORANT;
  if (isVal) {
    const val = getCachedValorantStatus();
    if (!val?.configured) {
      return { label: 'Not configured', cls: 'warn', hint: 'Complete Auto-Log Setup for Valorant.' };
    }
    if (val.source === 'overwolf') {
      return { label: val.overwolfConnected ? 'Overwolf linked' : 'Overwolf idle', cls: val.overwolfConnected ? 'ok' : 'pending', hint: 'Optional live feed via Overwolf extension.' };
    }
    if (!val.seeded) {
      return { label: 'Syncing…', cls: 'pending', hint: 'Establishing match baseline.' };
    }
    const watching = isValorantGameProcessRunning(val);
    return { label: watching ? 'Watching' : 'Waiting', cls: watching ? 'ok' : 'pending', hint: 'Finished matches auto-log via match history API.' };
  }

  const inMatch = getCachedRlInMatch();
  if (inMatch) {
    return { label: 'Live match', cls: 'ok', hint: 'Reading stats from the approved game export.' };
  }
  if (isBridgeUp()) {
    return { label: 'Waiting', cls: 'pending', hint: 'Rocket League export connected — play a match to track.' };
  }
  return { label: 'Offline', cls: 'warn', hint: 'Start the desktop app and enable Stats API in setup.' };
}

function renderRow(name, row) {
  return `
    <div class="diag-row">
      <span class="diag-row-name">${escapeHtml(name)}</span>
      <span class="diag-row-status diag-status-${row.cls}" title="${escapeHtml(row.hint)}">${escapeHtml(row.label)}</span>
    </div>`;
}

export function renderDiagnosticsPanel() {
  const host = document.getElementById('setup-diagnostics');
  if (!host) return;

  const overall = overallStatus();
  const cloud = syncStatusLabel(state.syncStatus);
  const monitor = gameMonitorRow();
  const tracking = matchTrackingRow();

  host.innerHTML = `
    <section class="setup-diagnostics" aria-labelledby="setup-diagnostics-heading">
      <p class="section-title" id="setup-diagnostics-heading">Connection</p>
      <p class="form-hint setup-hint">Status of match tracking on this device. No technical details — reopen the app from the tray if something stays stuck.</p>
      <div class="diag-card">
        <div class="diag-overall diag-status-${overall.cls}">
          <span class="diag-overall-label">${escapeHtml(overall.label)}</span>
          <p class="diag-overall-hint">${escapeHtml(overall.hint)}</p>
        </div>
        ${renderRow('Game monitor', monitor)}
        ${renderRow('Match tracking', tracking)}
        ${renderRow('Cloud sync', { label: cloud.text, cls: cloud.cls, hint: 'Your account data on Twans cloud.' })}
      </div>
    </section>`;
}

export function wireDiagnosticsPanel() {
  if (wired) return;
  wired = true;

  const refresh = () => {
    if (document.getElementById('setup-diagnostics')) renderDiagnosticsPanel();
  };

  unsubOnline = subscribeBridgeOnline(refresh);
  unsubReachable = subscribeBridgeReachable(refresh);

  import('./state.js').then(({ subscribe }) => {
    subscribe(refresh);
  }).catch(() => {});

  pollId = setInterval(refresh, 4000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (pollId) {
        clearInterval(pollId);
        pollId = null;
      }
      return;
    }
    if (wired && !pollId) {
      refresh();
      pollId = setInterval(refresh, 4000);
    }
  });
}

export function stopDiagnosticsPanel() {
  if (pollId) clearInterval(pollId);
  pollId = null;
  unsubOnline?.();
  unsubReachable?.();
  unsubOnline = null;
  unsubReachable = null;
  wired = false;
}
