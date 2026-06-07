/** Unified auto-log status pill + hint banner for RL and Valorant */

import { state } from './state.js';
import { GAME_IDS, getGameMeta } from './games.js';
import { isBridgeUp, isBridgeProbeDone, getBridgeUrl, getLastBridgeFailure } from './bridge-client.js';
import { isAutoLogEnabled, loadPrefs, syncAutoLogToggleUI } from './quicklog.js';
import { setBridgeHintVisible, needsLocalTrackerForAutoLog, getLocalTrackerUrl, isLocalTrackerHost, isWrongLocalPort } from './env.js';
import { DESKTOP_APP, getDesktopLauncher } from './config.js';

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

export function getCachedValorantStatus() {
  return cachedValStatus;
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

  const launcher = getDesktopLauncher(isVal ? GAME_IDS.VALORANT : GAME_IDS.ROCKET_LEAGUE);

  if (!up) {
    if (!isBridgeProbeDone() && (isLocalTrackerHost() || isWrongLocalPort())) {
      el.textContent = 'Connecting…';
      el.title = `Looking for ${DESKTOP_APP.name} on this PC…`;
      el.dataset.bridgeState = 'connecting';
      setBridgeHintVisible(false);
      syncAutoLogToggleUI();
      return;
    }
    el.textContent = 'Auto-log off';
    if (isWrongLocalPort()) {
      el.title = `Open ${getLocalTrackerUrl()} — auto-log does not work from this port`;
    } else if (needsLocalTrackerForAutoLog()) {
      el.title = `Auto-log only works on this PC — open ${getLocalTrackerUrl()} while ${launcher} is running`;
    } else {
      el.title = isVal
        ? `Click for setup — run ${launcher} on this PC and add Riot ID + Henrik key`
        : `Click for setup — run ${launcher} on this PC and set your RL name`;
    }
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
  el.classList.toggle('in-match', Boolean(valStatus?.valorantRunning));

  if (!valStatus) {
    el.textContent = '● Connecting…';
    el.title = `${DESKTOP_APP.name} — checking Valorant link`;
    el.dataset.bridgeState = 'syncing';
    return;
  }

  if (!valStatus.configured) {
    const prefs = loadPrefs();
    el.textContent = prefs.riotId ? '● Needs Apply' : '● Setup auto-log';
    el.title = 'Run Twans Auto-Log + Overwolf app, or add Riot ID + Henrik key in Auto-Log Setup';
    el.classList.add('bridge-needs-setup');
    el.dataset.bridgeState = 'needs-setup';
    return;
  }

  if (valStatus.source === 'overwolf') {
    if (valStatus.valorantRunning && isAutoLogEnabled()) {
      el.textContent = '● Auto-log ON';
      el.title = 'Overwolf linked — finished matches save automatically';
    } else if (valStatus.valorantRunning) {
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
    el.textContent = '● Val API error';
    el.title = formatValApiErrorForUser(valStatus.lastError);
    el.classList.add('bridge-error');
    el.dataset.bridgeState = 'error';
    return;
  }

  if (valStatus.pollingArmed === false) {
    el.textContent = '● Waiting…';
    el.title = 'Open http://localhost:8080 to arm auto-log (or wait ~45s — it auto-arms)';
    el.dataset.bridgeState = 'syncing';
    return;
  }

  if (!valStatus.seeded) {
    el.textContent = '● Syncing…';
    el.title = `${DESKTOP_APP.name} is setting your match baseline — finish one game, then the next auto-logs`;
    el.dataset.bridgeState = 'syncing';
    return;
  }

  if (valStatus.valorantRunning && isAutoLogEnabled()) {
    el.textContent = '● Auto-log ON';
    el.title = 'Ready — when Henrik sees a new finished match, it saves automatically (1–3 min delay)';
  } else if (valStatus.valorantRunning) {
    el.textContent = '● Valorant live';
    el.title = 'Valorant is running — turn on auto-log or tap LOG after the match';
  } else if (isAutoLogEnabled()) {
    el.textContent = '● Waiting for Val';
    el.title = 'Bridge ready — open Valorant; auto-log saves after each finished match';
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

  const launcher = getDesktopLauncher(isVal ? GAME_IDS.VALORANT : GAME_IDS.ROCKET_LEAGUE);

  if (!appUp) {
    if (!isBridgeProbeDone() && (isLocalTrackerHost() || isWrongLocalPort())) {
      banner.classList.add('hidden');
      return;
    }
    banner.classList.remove('hidden');
    badge.textContent = 'Auto-log off';
    const setupLink = '<button type="button" class="btn-link bridge-hint-link" id="bridge-hint-setup-link">Auto-Log Setup →</button>';
    const localUrl = getLocalTrackerUrl();

    if (isWrongLocalPort()) {
      p.innerHTML = `Wrong tab — auto-log only works at `
        + `<a href="${localUrl}" class="btn-link">${localUrl}</a>. `
        + `Run <code>${launcher}</code>, use the tab it opens (or click the link), not Live Server / another port. `
        + setupLink;
      return;
    }

    if (needsLocalTrackerForAutoLog()) {
      p.innerHTML = `Auto-log can't connect from this bookmark. On your gaming PC, open `
        + `<a href="${localUrl}" class="btn-link">${localUrl}</a> `
        + `with <code>${launcher}</code> running (same stats — sign in once).`;
      return;
    }

    const failure = getLastBridgeFailure();
    if (failure === 'wrong_server') {
      p.innerHTML = `Port 8080 is serving files without the auto-log bridge — close Live Server, `
        + `<code>npx serve</code>, or other apps on port 8080, then restart <code>${launcher}</code>. `
        + setupLink;
      return;
    }
    if (failure === 'bridge_down') {
      p.innerHTML = `Tracker is up but the bridge on port 49200 is not running — check the `
        + `<code>${launcher}</code> console for errors (often a stale bridge window). `
        + `<a href="${localUrl}/api/bridge/status" class="btn-link" target="_blank" rel="noopener">test bridge</a> · `
        + setupLink;
      return;
    }

    p.innerHTML = isLocalTrackerHost()
      ? `Bridge not connected — keep <code>${launcher}</code> open, then `
        + `<a href="${window.location.origin}/api/bridge/status" class="btn-link" target="_blank" rel="noopener">test bridge</a> `
        + `(should show JSON, not 404). Hard refresh (Ctrl+F5). `
        + setupLink
      : `Run <code>${launcher}</code> on this PC while playing. `
        + setupLink;
    return;
  }

  if (appUp && isVal && valStatus && !valStatus.overwolfConnected && !valStatus.configured) {
    banner.classList.remove('hidden');
    badge.textContent = 'Overwolf setup';
    p.innerHTML = `${DESKTOP_APP.name} is running — load <strong>Twans Val Auto-Log</strong> in Overwolf (no API keys). `
      + '<button type="button" class="btn-link bridge-hint-link" id="bridge-hint-setup-link">Auto-Log Setup →</button>';
    return;
  }

  if (appUp && isVal && valStatus && !valStatus.configured) {
    banner.classList.remove('hidden');
    badge.textContent = 'Setup needed';
    p.innerHTML = `${DESKTOP_APP.name} is running but auto-log is not configured — use Overwolf or Henrik API in `
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

  if (appUp && isVal && valStatus?.configured && valStatus?.pollingArmed === false) {
    banner.classList.remove('hidden');
    badge.textContent = 'Safe mode';
    p.innerHTML = `${DESKTOP_APP.name} is waiting — open `
      + `<a href="${getLocalTrackerUrl()}" class="btn-link">${getLocalTrackerUrl()}</a> `
      + 'to arm auto-log, or wait ~45 seconds (it auto-arms). Auto-log runs <strong>after</strong> a match ends, not when Val opens.';
    return;
  }

  if (appUp && isVal && valStatus?.configured && !valStatus.seeded) {
    banner.classList.remove('hidden');
    badge.textContent = 'Almost ready';
    p.textContent = `${DESKTOP_APP.name} is connected — syncing your match baseline. Play one game if needed; the next finished match auto-logs.`;
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
