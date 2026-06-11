/** Unified auto-log status pill + hint banner for RL and Valorant */

import { state } from './state.js';
import { GAME_IDS, getGameMeta } from './games.js';
import {
  isBridgeUp, isBridgeProbeDone, getLastBridgeFailure, getBridgeStatusPhase,
  getBridgeConnectAttempts, isBridgeInStartupPhase,
  getHeartbeatValorantProcessRunning,
  subscribeBridgeResumed,
} from './bridge-client.js';
import { isAutoLogEnabled, loadPrefs, syncAutoLogToggleUI } from './quicklog.js';
import {
  setBridgeHintVisible, needsLocalTrackerForAutoLog,
  isLocalTrackerHost, isWrongLocalPort,
} from './env.js';
import { DESKTOP_APP } from './config.js';
import {
  STATUS,
  waitingForGameLabel,
  formatStatusPill,
  logStatusDebug,
} from './status-copy.js';

let cachedValStatus = null;
let cachedRlInMatch = false;
let clickWired = false;
let resumeWired = false;

function formatValApiErrorForUser(message) {
  const raw = String(message ?? '');
  if (/RGAPI|riot dev keys/i.test(raw)) {
    return 'Riot dev keys cannot read Valorant match history. Get a free Henrik key at api.henrikdev.xyz/dashboard, paste it in Auto-Log Setup, and click Apply & Go.';
  }
  if (/henrik/i.test(raw) || /invalid api/i.test(raw) || raw.includes('401') || raw.includes('403')) {
    return 'Henrik API key problem — get a free key at api.henrikdev.xyz/dashboard, paste it below, and click Apply & Go.';
  }
  if (raw.includes('404') || /not found/i.test(raw)) {
    return 'Riot account not found — double-check Riot ID (Name#TAG) and region.';
  }
  return raw;
}

export function setCachedValorantStatus(status) {
  cachedValStatus = status;
}

export function clearCachedValorantStatus() {
  cachedValStatus = null;
}

export function getCachedValorantStatus() {
  return cachedValStatus;
}

/** Process-gated Tracking — heartbeat /status wins over stale /valorant/status cache. */
export function isValorantGameProcessRunning(valStatus) {
  const hb = getHeartbeatValorantProcessRunning();
  if (hb !== null) return hb;
  return Boolean(valStatus?.valorantProcessRunning ?? valStatus?.valorantRunning);
}

export function patchCachedValorantProcessRunning(running) {
  if (!cachedValStatus) return;
  const next = Boolean(running);
  const cached = Boolean(cachedValStatus.valorantProcessRunning ?? cachedValStatus.valorantRunning);
  if (cached === next) return;
  cachedValStatus = {
    ...cachedValStatus,
    valorantRunning: next,
    valorantProcessRunning: next,
  };
}

export function setCachedRlInMatch(inMatch) {
  cachedRlInMatch = Boolean(inMatch);
}

export function getCachedRlInMatch() {
  return cachedRlInMatch;
}

function applyUnifiedStatusLabel(el, phase, detailTitle) {
  const gameId = state.activeGame;
  const labels = {
    connecting: STATUS.starting,
    reconnecting: STATUS.reconnecting,
    waiting: waitingForGameLabel(gameId),
    tracking: STATUS.tracking,
    error: STATUS.connectionIssue,
  };
  el.textContent = labels[phase] || waitingForGameLabel(gameId);
  el.dataset.statusPhase = phase;
  if (detailTitle) {
    logStatusDebug('status-title', detailTitle);
    el.title = detailTitle.includes('localhost') || detailTitle.includes('bridge') || detailTitle.includes('8080')
      ? `${DESKTOP_APP.name} — ${labels[phase] || waitingForGameLabel(gameId)}`
      : detailTitle;
  }
}

export function refreshBridgeStatusUI() {
  const el = document.getElementById('live-bridge-status');
  if (!el) return;

  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const meta = getGameMeta(state.activeGame);
  const up = isBridgeUp();
  const phase = getBridgeStatusPhase();
  const loggedOut = document.body.classList.contains('logged-out');

  el.classList.remove('connected', 'in-match', 'bridge-needs-setup', 'bridge-error');
  el.dataset.bridgeState = up ? 'online' : 'offline';

  if (!up) {
    const booting = phase === 'connecting'
      && (isLocalTrackerHost() || isWrongLocalPort() || isBridgeInStartupPhase());
    if (booting) {
      applyUnifiedStatusLabel(el, 'connecting', `Starting ${DESKTOP_APP.name}…`);
      el.dataset.bridgeState = 'connecting';
      setBridgeHintVisible(false);
      syncAutoLogToggleUI();
      return;
    }
    if (phase === 'reconnecting') {
      applyUnifiedStatusLabel(el, 'reconnecting', STATUS.reconnecting);
      el.dataset.bridgeState = 'reconnecting';
      setBridgeHintVisible(false);
      syncAutoLogToggleUI();
      return;
    }
    const failure = getLastBridgeFailure();
    logStatusDebug('bridge-offline', { failure, phase, attempt: getBridgeConnectAttempts() });
    applyUnifiedStatusLabel(el, 'error', STATUS.connectionIssue);
    el.classList.add('bridge-error');
    el.title = `${DESKTOP_APP.name} — ${STATUS.connectionIssue}. Open Auto-Log Setup if this persists.`;
    setBridgeHintVisible(!loggedOut);
    updateDesktopAppBanner(isVal, false);
    syncAutoLogToggleUI();
    return;
  }

  el.classList.add('connected');
  setBridgeHintVisible(false);

  if (isVal) {
    renderValorantPill(el, cachedValStatus, meta);
  } else {
    renderRocketLeaguePill(el, cachedRlInMatch, meta);
  }
  updateDesktopAppBanner(isVal, true, cachedValStatus);
  syncAutoLogToggleUI();
  import('./sessions.js').then((m) => m.updateSessionBar?.()).catch(() => {});
}

function renderValorantPill(el, valStatus, meta) {
  const valProcessRunning = isValorantGameProcessRunning(valStatus);
  el.classList.toggle('in-match', valProcessRunning);

  if (!valStatus) {
    applyUnifiedStatusLabel(el, 'connecting', `${DESKTOP_APP.name} — checking Valorant link`);
    el.textContent = formatStatusPill('connecting');
    el.dataset.bridgeState = 'syncing';
    return;
  }

  if (!valStatus.configured) {
    const prefs = loadPrefs();
    el.textContent = prefs.riotId ? '● Needs Apply' : '● Setup auto-log';
    el.title = 'Add Riot ID + Henrik key in Auto-Log Setup, then Apply & Go';
    el.classList.add('bridge-needs-setup');
    el.dataset.bridgeState = 'needs-setup';
    return;
  }

  if (valStatus.source === 'overwolf') {
    if (valProcessRunning && isAutoLogEnabled()) {
      el.textContent = '● Auto-log ON';
      el.title = 'Overwolf linked — finished matches save automatically';
    } else if (valProcessRunning) {
      el.textContent = '● Valorant live';
      el.title = 'Overwolf sees Valorant — turn on auto-log or tap LOG after the match';
    } else if (isAutoLogEnabled()) {
      el.textContent = '● Overwolf ready';
      el.title = 'Overwolf linked — launch Valorant and your next match will auto-log';
    } else {
      el.textContent = '● Overwolf linked';
      el.title = 'Overwolf feeds match data — enable auto-log in the dock or log manually';
    }
    el.dataset.bridgeState = 'ready';
    return;
  }

  if (valStatus.lastError) {
    el.textContent = `● ${STATUS.connectionIssue}`;
    el.title = formatValApiErrorForUser(valStatus.lastError);
    el.classList.add('bridge-error');
    el.dataset.bridgeState = 'error';
    return;
  }

  if (valStatus.pollingArmed === false) {
    applyUnifiedStatusLabel(el, 'waiting', waitingForGameLabel(GAME_IDS.VALORANT));
    el.textContent = formatStatusPill('waiting', GAME_IDS.VALORANT);
    el.dataset.bridgeState = 'syncing';
    return;
  }

  if (!valStatus.seeded) {
    el.textContent = '● Syncing…';
    el.title = `${DESKTOP_APP.name} is setting your match baseline — finish one game, then the next auto-logs`;
    el.dataset.bridgeState = 'syncing';
    return;
  }

  if (valProcessRunning && isAutoLogEnabled()) {
    applyUnifiedStatusLabel(el, 'tracking', 'Auto-log ON — finished matches save in 1–3 min');
    el.textContent = formatStatusPill('tracking');
  } else if (valProcessRunning) {
    applyUnifiedStatusLabel(el, 'tracking', 'Valorant is running — turn on auto-log or tap LOG after the match');
    el.textContent = formatStatusPill('tracking');
  } else if (isAutoLogEnabled()) {
    applyUnifiedStatusLabel(el, 'waiting', waitingForGameLabel(GAME_IDS.VALORANT));
    el.textContent = formatStatusPill('waiting', GAME_IDS.VALORANT);
  } else {
    applyUnifiedStatusLabel(el, 'waiting', waitingForGameLabel(GAME_IDS.VALORANT));
    el.textContent = formatStatusPill('waiting', GAME_IDS.VALORANT);
  }
  el.dataset.bridgeState = 'ready';
}

function renderRocketLeaguePill(el, inMatch, meta) {
  el.classList.toggle('in-match', inMatch);

  if (inMatch) {
    applyUnifiedStatusLabel(el, 'tracking', `Live match — reading stats from ${meta.label}`);
    el.textContent = formatStatusPill('tracking');
    el.dataset.bridgeState = 'in-match';
    return;
  }

  const waitingHint = isAutoLogEnabled()
    ? 'Auto-log ON — launch Rocket League to start tracking'
    : waitingForGameLabel(GAME_IDS.ROCKET_LEAGUE);
  applyUnifiedStatusLabel(el, 'waiting', waitingHint);
  el.textContent = formatStatusPill('waiting', GAME_IDS.ROCKET_LEAGUE);
  el.dataset.bridgeState = 'ready';
}

function updateDesktopAppBanner(isVal, appUp, valStatus) {
  const banner = document.getElementById('bridge-hint-banner');
  if (!banner) return;

  const badge = banner.querySelector('.bridge-hint-badge');
  const p = banner.querySelector('p');
  if (!badge || !p) return;

  const setupLink = '<button type="button" class="btn-link bridge-hint-link" id="bridge-hint-setup-link">Auto-Log Setup →</button>';

  if (!appUp) {
    if ((isBridgeInStartupPhase() || !isBridgeProbeDone()) && (isLocalTrackerHost() || isWrongLocalPort())) {
      banner.classList.add('hidden');
      return;
    }
    banner.classList.remove('hidden');
    badge.textContent = STATUS.connectionIssue;
    logStatusDebug('banner-offline', {
      failure: getLastBridgeFailure(),
      wrongPort: isWrongLocalPort(),
      webOnly: needsLocalTrackerForAutoLog(),
    });

    if (needsLocalTrackerForAutoLog()) {
      badge.textContent = 'Manual log only';
      p.innerHTML = `This bookmark is for manual logging. Install <strong>${DESKTOP_APP.name}</strong> on your gaming PC for automatic match tracking. ${setupLink}`;
      return;
    }

    p.innerHTML = `${DESKTOP_APP.name} is not connected — reopen the app from the system tray, or finish ${setupLink}.`;
    return;
  }

  if (appUp && isVal && valStatus && !valStatus.configured) {
    banner.classList.remove('hidden');
    badge.textContent = 'Setup needed';
    p.innerHTML = `Add Riot ID and your free Henrik key in ${setupLink}, then click <strong>Apply &amp; Go</strong>.`;
    return;
  }

  if (appUp && isVal && valStatus?.lastError) {
    banner.classList.remove('hidden');
    badge.textContent = 'Valorant auto-log';
    p.innerHTML = `${formatValApiErrorForUser(valStatus.lastError)} ${setupLink}`;
    return;
  }

  if (appUp && isVal && valStatus?.configured && valStatus?.pollingArmed === false) {
    banner.classList.remove('hidden');
    badge.textContent = waitingForGameLabel(GAME_IDS.VALORANT);
    p.innerHTML = `${DESKTOP_APP.name} is ready — launch Valorant or tap <strong>Play</strong>. Matches auto-log after each round ends.`;
    return;
  }

  if (appUp && isVal && valStatus?.configured && !valStatus.seeded) {
    banner.classList.remove('hidden');
    badge.textContent = 'Almost ready';
    p.textContent = `${DESKTOP_APP.name} is connected — play one full match to finish setup; the next finished match auto-logs.`;
  }
}

export function wireBridgeStatusClick(onOpenSetup) {
  if (clickWired) return;
  clickWired = true;

  document.getElementById('live-bridge-status')?.addEventListener('click', () => {
    const pill = document.getElementById('live-bridge-status');
    const bridgeState = pill?.dataset.bridgeState;
    if (!pill || bridgeState === 'ready' || bridgeState === 'in-match' || bridgeState === 'syncing') return;
    onOpenSetup?.();
  });

  document.getElementById('bridge-hint-banner')?.addEventListener('click', (e) => {
    if (e.target.closest('#bridge-hint-setup-link')) onOpenSetup?.();
  });

  if (!resumeWired) {
    resumeWired = true;
    subscribeBridgeResumed(() => {
      import('./ui.js').then(({ showToast }) => {
        showToast(STATUS.trackingResumed);
      }).catch(() => {});
      refreshBridgeStatusUI();
    });
  }
}
