/** Unified auto-log status pill + hint banner for RL and Valorant */

import { state } from './state.js';
import { GAME_IDS, getGameMeta } from './games.js';
import { isBridgeUp } from './bridge-client.js';
import { isAutoLogEnabled, loadPrefs } from './quicklog.js';
import { setBridgeHintVisible, needsLocalTrackerForAutoLog, getLocalTrackerUrl } from './env.js';
import { DESKTOP_APP } from './config.js';

let cachedValStatus = null;
let cachedRlInMatch = false;
let clickWired = false;

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
    el.textContent = 'Auto-log off';
    if (needsLocalTrackerForAutoLog()) {
      el.title = `Auto-log only works on this PC — open ${getLocalTrackerUrl()} while ${DESKTOP_APP.launcher} is running`;
    } else {
      el.title = isVal
        ? `Click for setup — run ${DESKTOP_APP.launcher} on this PC and add Riot ID + Henrik key`
        : `Click for setup — run ${DESKTOP_APP.launcher} on this PC and set your RL name`;
    }
    setBridgeHintVisible(!loggedOut);
    updateDesktopAppBanner(isVal, false);
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
}

function renderValorantPill(el, valStatus, meta) {
  el.classList.toggle('in-match', Boolean(valStatus?.valorantRunning));

  if (!valStatus?.configured) {
    const prefs = loadPrefs();
    el.textContent = prefs.riotId ? '● Needs Apply' : '● Setup Riot ID';
    el.title = 'Riot ID + Henrik API key missing — click to open Auto-Log Setup → Apply & Go';
    el.classList.add('bridge-needs-setup');
    el.dataset.bridgeState = 'needs-setup';
    return;
  }

  if (valStatus.lastError) {
    el.textContent = '● Val API error';
    el.title = formatValApiErrorForUser(valStatus.lastError);
    el.classList.add('bridge-error');
    el.dataset.bridgeState = 'error';
    return;
  }

  if (!valStatus.seeded) {
    el.textContent = '● Syncing…';
    el.title = `${DESKTOP_APP.name} is linked — play one match to finish setup, then the next auto-logs`;
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
    el.title = `${DESKTOP_APP.name} is running — enable auto-log in the dock or log manually`;
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
    el.title = `${DESKTOP_APP.name} is running — stats fill in; you tap LOG`;
  }
  el.dataset.bridgeState = inMatch ? 'in-match' : 'ready';
}

function updateDesktopAppBanner(isVal, appUp, valStatus) {
  const banner = document.getElementById('bridge-hint-banner');
  if (!banner) return;

  const badge = banner.querySelector('.bridge-hint-badge');
  const p = banner.querySelector('p');
  if (!badge || !p) return;

  if (!appUp && needsLocalTrackerForAutoLog()) {
    banner.classList.remove('hidden');
    badge.textContent = 'Use local tracker';
    p.innerHTML = `Auto-log can't connect from this bookmark. On your gaming PC, open `
      + `<a href="${getLocalTrackerUrl()}" class="btn-link">${getLocalTrackerUrl()}</a> `
      + `with <code>${DESKTOP_APP.launcher}</code> running (same stats — sign in once).`;
    return;
  }

  if (!appUp) {
    banner.classList.remove('hidden');
    badge.textContent = 'Auto-log off';
    p.innerHTML = `Run <code>${DESKTOP_APP.launcher}</code> on this PC while playing. `
      + '<button type="button" class="btn-link bridge-hint-link" id="bridge-hint-setup-link">Auto-Log Setup →</button>';
    return;
  }

  if (appUp && isVal && valStatus && !valStatus.configured) {
    banner.classList.remove('hidden');
    badge.textContent = 'Setup needed';
    p.innerHTML = `${DESKTOP_APP.name} is running but Riot ID / Henrik key are not applied yet. `
      + '<button type="button" class="btn-link bridge-hint-link" id="bridge-hint-setup-link">Auto-Log Setup →</button>';
    return;
  }

  if (appUp && isVal && valStatus?.lastError) {
    banner.classList.remove('hidden');
    badge.textContent = 'Val auto-log';
    p.innerHTML = `${formatValApiErrorForUser(valStatus.lastError)} `
      + '<button type="button" class="btn-link bridge-hint-link" id="bridge-hint-setup-link">Auto-Log Setup →</button>';
    return;
  }

  if (appUp && isVal && valStatus?.configured && !valStatus.seeded) {
    banner.classList.remove('hidden');
    badge.textContent = 'Almost ready';
    p.textContent = `${DESKTOP_APP.name} is connected — play one match to sync. The next finished match will auto-log.`;
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
