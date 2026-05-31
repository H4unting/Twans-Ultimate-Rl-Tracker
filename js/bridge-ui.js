/** Unified bridge status pill + hint banner for RL and Valorant */

import { state } from './state.js';
import { GAME_IDS, getGameMeta } from './games.js';
import { isBridgeUp } from './bridge-client.js';
import { isAutoLogEnabled, loadPrefs } from './quicklog.js';
import { setBridgeHintVisible } from './env.js';

let cachedValStatus = null;
let cachedRlInMatch = false;
let clickWired = false;

export function setCachedValorantStatus(status) {
  cachedValStatus = status;
}

export function setCachedRlInMatch(inMatch) {
  cachedRlInMatch = Boolean(inMatch);
}

export function refreshBridgeStatusUI() {
  const el = document.getElementById('live-bridge-status');
  if (!el) return;

  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const meta = getGameMeta(state.activeGame);
  const up = isBridgeUp();
  const loggedOut = document.body.classList.contains('logged-out');

  el.classList.remove('connected', 'in-match', 'bridge-needs-setup', 'bridge-error');
  el.dataset.bridgeState = up ? 'online' : 'offline';

  if (!up) {
    el.textContent = 'Auto stats off';
    el.title = isVal
      ? 'Click to open Bridge Setup — run Twans-Tracker-Bridge.exe and set Riot ID + API key'
      : 'Click to open Setup — run Twans-Tracker-Bridge.exe and set your RL name';
    setBridgeHintVisible(!loggedOut);
    updateBridgeBanner(isVal, false);
    return;
  }

  el.classList.add('connected');
  setBridgeHintVisible(false);

  if (isVal) {
    renderValorantPill(el, cachedValStatus, meta);
  } else {
    renderRocketLeaguePill(el, cachedRlInMatch, meta);
  }
  updateBridgeBanner(isVal, true, cachedValStatus);
}

function renderValorantPill(el, valStatus, meta) {
  el.classList.toggle('in-match', Boolean(valStatus?.valorantRunning));

  if (!valStatus?.configured) {
    const prefs = loadPrefs();
    el.textContent = prefs.riotId ? '● Apply in Setup' : '● Setup Riot ID';
    el.title = 'Riot ID + API key missing — click to open Bridge Setup → Apply & Go';
    el.classList.add('bridge-needs-setup');
    el.dataset.bridgeState = 'needs-setup';
    return;
  }

  if (valStatus.lastError) {
    el.textContent = '● Riot API error';
    el.title = `${valStatus.lastError} — click to check Bridge Setup`;
    el.classList.add('bridge-error');
    el.dataset.bridgeState = 'error';
    return;
  }

  if (!valStatus.seeded) {
    el.textContent = '● Syncing…';
    el.title = 'Bridge linked your account — play one match to seed, then the next auto-logs';
    el.dataset.bridgeState = 'syncing';
    return;
  }

  if (valStatus.valorantRunning && isAutoLogEnabled()) {
    el.textContent = '● Auto-log ON';
    el.title = `${meta.label} running — finished matches save automatically`;
  } else if (valStatus.valorantRunning) {
    el.textContent = '● Valorant live';
    el.title = 'Match running — turn on auto-log or tap LOG after the round';
  } else if (isAutoLogEnabled()) {
    el.textContent = '● Ready to log';
    el.title = 'Riot API connected — launch Valorant and your next match will auto-log';
  } else {
    el.textContent = '● Connected';
    el.title = 'Riot API connected — enable auto-log in the dock or log manually';
  }
  el.dataset.bridgeState = 'ready';
}

function renderRocketLeaguePill(el, inMatch, meta) {
  el.classList.toggle('in-match', inMatch);

  if (inMatch) {
    el.textContent = '● Live match';
    el.title = `Reading stats from ${meta.label}`;
  } else if (isAutoLogEnabled()) {
    el.textContent = '● Auto-log ON';
    el.title = 'Games log automatically when a match ends';
  } else {
    el.textContent = '● Stats ready';
    el.title = 'Stats fill in from the game — you tap LOG';
  }
  el.dataset.bridgeState = inMatch ? 'in-match' : 'ready';
}

function updateBridgeBanner(isVal, bridgeUp, valStatus) {
  const banner = document.getElementById('bridge-hint-banner');
  if (!banner) return;

  const badge = banner.querySelector('.bridge-hint-badge');
  const p = banner.querySelector('p');
  if (!badge || !p) return;

  if (bridgeUp && isVal && valStatus && !valStatus.configured) {
    banner.classList.remove('hidden');
    badge.textContent = 'Valorant setup needed';
    p.innerHTML = 'Bridge is running but Riot ID / API key are not applied yet. '
      + '<button type="button" class="btn-link bridge-hint-link" id="bridge-hint-setup-link">Bridge Setup →</button>';
    return;
  }

  if (bridgeUp && isVal && valStatus?.lastError) {
    banner.classList.remove('hidden');
    badge.textContent = 'Riot API error';
    p.textContent = valStatus.lastError;
    return;
  }

  if (bridgeUp && isVal && valStatus?.configured && !valStatus.seeded) {
    banner.classList.remove('hidden');
    badge.textContent = 'Almost ready';
    p.textContent = 'Bridge connected — play one match to sync. The next finished match will auto-log.';
    return;
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
}
