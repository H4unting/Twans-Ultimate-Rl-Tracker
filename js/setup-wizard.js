/** In-app setup wizard for auto stats + quick log workflow */

import { loadPrefs, savePrefs } from './quicklog.js';
import { getRlDisplayName, saveRlDisplayName, applyBridgeSetup, fetchBridgeSetupStatus } from './rl-live.js';
import { refreshValorantStatus } from './valorant-live.js';
import { getAuthUser } from './auth.js';
import { getUserDisplay, state } from './state.js';
import { GAME_IDS } from './games.js';
import { showToast } from './ui.js';
import { refreshBridgeStatusUI, getCachedValorantStatus } from './bridge-ui.js';
import { DESKTOP_APP, getDesktopLauncher } from './config.js';
import { clearGameHistory } from './matches.js';
import {
  getBridgeUrl,
  bridgeFetch,
  isBridgeReachable,
  isBridgeUp,
  getLastBridgeFailure,
  isBridgeProcessDetected,
} from './bridge-client.js';
import { getLocalTrackerUrl, getAssetUrl, isTwansAppHost } from './env.js';
import { openRankSetupModal } from './rank-setup-ui.js';

const SETUP_KEY = 'rl-grind-setup';

export function renderLogSetupNudge() {
  const el = document.getElementById('log-setup-nudge');
  if (!el) return;

  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const valStatus = getCachedValorantStatus();
  const bridge = isBridgeUp();
  const valReady = isVal && isValorantAutoLogReady(bridge, valStatus);

  if (valReady || (bridge && !isVal)) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }

  const launcher = getDesktopLauncher(state.activeGame);
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="log-setup-nudge-inner">
      <span class="log-setup-nudge-text">${isVal
        ? (bridge
          ? 'Finish Auto-Log Setup (Riot ID + Henrik key), then Apply & Go.'
          : `${DESKTOP_APP.name} is not connected — reopen it from the tray, then Apply & Go in setup.`)
        : `Want auto-log from Rocket League? Open ${DESKTOP_APP.name} on this PC.`}</span>
      <button type="button" class="btn-link" id="log-setup-nudge-link">Auto-Log Setup →</button>
    </div>`;
  document.getElementById('log-setup-nudge-link')?.addEventListener('click', () => {
    window.__navigate?.('setup', 'home');
  });
}

function renderRankBaselinesPanel() {
  return `
    <div class="setup-rank-baselines">
      <strong>Starting ranks (MMR / RR)</strong>
      <p class="setup-hint">Your current rank for each playlist — used before your first logged game in that mode.</p>
      <button type="button" class="btn btn-secondary" id="setup-edit-rank-baselines">Update starting ranks</button>
    </div>`;
}

function renderRlPanel(profile, { compact = false } = {}) {
  return `
    <div class="setup-game-panel setup-game-panel-rl" data-setup-game="rocket_league">
      <strong>Rocket League auto-log</strong>
      <p>${compact
    ? 'Update your in-game name or re-apply Stats API settings on this PC.'
    : 'Your Rocket League display name is sent to the local auto-log app when a match ends.'}</p>
      ${renderProfileNameStep(profile)}
      ${renderApplySection(true)}
      ${renderRankBaselinesPanel()}
    </div>`;
}

function renderHenrikStep(stepNum = 2, riotIdValue = '', riotRegionValue = '') {
  return `
    <li class="setup-step${riotIdValue ? ' done' : ''}" data-step="valorant">
      <span class="setup-step-num">${stepNum}</span>
      <div class="setup-step-body">
        <strong>Riot ID + Henrik API key</strong>
        <p class="setup-hint">Free key at <a href="https://api.henrikdev.xyz/dashboard/" target="_blank" rel="noopener">api.henrikdev.xyz/dashboard</a> — paste below, then <strong>Apply &amp; Go</strong>.</p>
        ${renderValorantFields(riotIdValue, riotRegionValue)}
        <div class="setup-apply-block">
          ${renderApplySection(false)}
        </div>
      </div>
    </li>`;
}

function renderOverwolfOptionalSection(overwolfLinked = false) {
  if (overwolfLinked) {
    return `
      <div class="setup-overwolf-callout setup-overwolf-ready">
        <strong>Overwolf linked</strong>
        <p>Turn <strong>Auto-log</strong> on in the dock below, play a Competitive match, and it logs when the match ends.</p>
      </div>`;
  }
  return `
    <details class="setup-overwolf-advanced">
      <summary>Advanced — Overwolf (optional)</summary>
      <p class="setup-hint">Requires Overwolf <a href="https://dev.overwolf.com/ow-native/getting-started/onboarding-resources/basic-sample-app/" target="_blank" rel="noopener">developer access</a> for unpacked apps — most users get <em>Unauthorized App</em>. Use Henrik API above instead.</p>
      <ol class="setup-substeps">
        <li>Install <a href="https://www.overwolf.com/" target="_blank" rel="noopener">Overwolf</a> and sign in</li>
        <li>Development options → <strong>Load unpacked extension</strong></li>
        <li>Select the folder below (not Desktop or repo root):
          <div class="setup-ow-path-row">
            <code class="setup-ow-path" id="setup-ow-path">integrations/overwolf</code>
            <button type="button" class="btn btn-secondary setup-ow-copy" id="setup-ow-copy-path">Copy path</button>
          </div>
          <p class="setup-hint setup-ow-folder-tip">Run <code>Load Overwolf Extension.bat</code> to open the correct folder. <strong>missing manifest.json</strong> = wrong folder.</p>
        </li>
        <li>Enable <strong>Twans Val Auto-Log</strong> in Overwolf</li>
      </ol>
      <span class="setup-status-pill" id="setup-overwolf-pill">○ Waiting for Overwolf extension…</span>
    </details>`;
}

function isWrongTrackerTab() {
  const failure = getLastBridgeFailure();
  return failure === 'wrong_tracker_alive'
    || (failure === 'wrong_server' && isBridgeProcessDetected());
}

function bridgeReadyForSetup() {
  return isBridgeReachable();
}

function isValorantAutoLogReady(bridge, valStatus = getCachedValorantStatus()) {
  if (!bridge) return false;
  if (valStatus?.overwolfConnected) return true;
  if (valStatus?.configured && valStatus?.source === 'henrik' && valStatus?.seeded) return true;
  return false;
}

function renderValPanel(riotIdValue, riotRegionValue, { compact = false, overwolfLinked = false } = {}) {
  return `
    <div class="setup-game-panel setup-game-panel-val" data-setup-game="valorant">
      <div class="setup-panel-head">
        <strong>Valorant auto-log</strong>
        <p class="setup-panel-desc">${compact
    ? (overwolfLinked ? 'Overwolf is linked — play with Auto-log ON.' : 'Update Riot ID or Henrik key, then Apply & Go.')
    : 'Henrik API (free key) — works for everyone. Overwolf is optional below.'}</p>
      </div>
      ${renderValorantFields(riotIdValue, riotRegionValue)}
      <div class="setup-apply-block">
        ${renderApplySection(false)}
      </div>
      ${renderOverwolfOptionalSection(overwolfLinked)}
      <div class="setup-danger-zone">
        <strong>Wrong match count?</strong>
        <p class="setup-hint">Removes every Valorant match from your account and resets auto-log baseline. Rocket League stats are not touched.</p>
        <button type="button" class="btn btn-cancel" id="setup-clear-val-history">Clear all Val match history</button>
      </div>
      ${renderRankBaselinesPanel()}
    </div>`;
}

function renderBridgeStep(bridge, stepNum = 1, gameId = GAME_IDS.ROCKET_LEAGUE) {
  const launcher = getDesktopLauncher(gameId);
  const isVal = gameId === GAME_IDS.VALORANT;
  const wrongTab = bridge && isWrongTrackerTab();
  const trackerUrl = getLocalTrackerUrl();
  return `
    <li class="setup-step${bridge ? ' done' : ''}" data-step="bridge">
      <span class="setup-step-num">${stepNum}</span>
      <div class="setup-step-body">
        <strong>Run ${DESKTOP_APP.name}</strong>
        <p>Double-click <code>${launcher}</code> in your tracker folder — leave it running while you play:</p>
        <pre class="setup-code setup-code-highlight" id="setup-bridge-cmd">${launcher}</pre>
        ${isVal
    ? (isTwansAppHost()
      ? `<p class="setup-hint">Keep <strong>${DESKTOP_APP.name}</strong> running while you play.</p>`
      : `<p class="setup-hint">Open <code>${trackerUrl}</code> in the tab the .bat opens — not Live Server, not GitHub Pages.</p>`)
    : (isTwansAppHost()
      ? `<p class="setup-hint">You're in <strong>${DESKTOP_APP.name}</strong> — leave it open while you play.</p>`
      : `<p class="setup-hint">Or double-click <code>${DESKTOP_APP.exe}</code> — no console window (build once with <code>build-tray-app.bat</code>).</p>`)}
        ${wrongTab ? `
        <p class="setup-callout setup-callout-important">Bridge is running, but this tab is not served by <code>${launcher}</code>. Close Live Server on port 8080, restart the .bat, then use the tab it opens.</p>
        <a href="${trackerUrl}" class="btn btn-secondary" id="setup-open-tracker-tab" target="_blank" rel="noopener">Open correct tracker tab</a>
        ` : ''}
        <span class="setup-status-pill${bridge ? ' ok' : ''}" id="setup-bridge-pill">${wrongTab
    ? `● Bridge running — open ${trackerUrl} for auto-log`
    : bridge
      ? `● ${DESKTOP_APP.name} is running — ready for Apply & Go`
      : `○ Waiting for ${launcher}…`}</span>
      </div>
    </li>`;
}

function renderRlSteps(profile, rlName, bridge, allReady) {
  if (allReady) return renderRlPanel(profile, { compact: true });
  return `
    <ol class="setup-steps setup-steps-rl">
      <li class="setup-step${rlName ? ' done' : ''}" data-step="name">
        <span class="setup-step-num">1</span>
        <div class="setup-step-body">${renderProfileNameStep(profile)}</div>
      </li>
      ${renderBridgeStep(bridge, 2, GAME_IDS.ROCKET_LEAGUE)}
      <li class="setup-step" data-step="apply">
        <span class="setup-step-num">3</span>
        <div class="setup-step-body">
          <strong>Apply &amp; Go</strong>
          <p>We write your name into <code>Rocket League Tracker.bat</code> and set up the Rocket League Stats API file on this PC.</p>
          ${renderApplySection(true)}
        </div>
      </li>
    </ol>`;
}

function renderValSteps(riotIdValue, riotRegionValue, bridge, allReady, overwolfLinked = false) {
  if (allReady) return renderValPanel(riotIdValue, riotRegionValue, { compact: true, overwolfLinked });
  return `
    <ol class="setup-steps setup-steps-val">
      ${renderBridgeStep(bridge, 1, GAME_IDS.VALORANT)}
      ${renderHenrikStep(2, riotIdValue, riotRegionValue)}
      <li class="setup-step" data-step="autolog">
        <span class="setup-step-num">3</span>
        <div class="setup-step-body">
          <strong>Play with Auto-log ON</strong>
          <p>Turn <strong>Auto-log</strong> on in the dock below, then play a Competitive match. Finished matches auto-log in 1–3 minutes.</p>
        </div>
      </li>
    </ol>
    ${renderOverwolfOptionalSection(overwolfLinked)}`;
}

function renderValorantFields(riotIdValue, riotRegionValue, { keyHint = '', keySaved = false, hasLegacyRiotKey = false } = {}) {
  const keyStatus = keySaved
    ? `<p class="setup-hint setup-riot-key-saved">Key on this PC: <code>${escapeHtml(keyHint || 'saved')}</code> — paste a new key above to replace it.</p>`
    : '';
  const legacyNote = hasLegacyRiotKey && !keySaved
    ? '<p class="setup-hint setup-riot-key-note">Your saved RGAPI key cannot load Val matches (Riot blocks dev keys). Add a Henrik key below instead.</p>'
    : '';
  return `
    <div class="setup-val-fields">
      <div class="setup-field">
        <label for="setup-riot-id">Riot ID <span class="setup-hint">(Name#TAG)</span></label>
        <input type="text" id="setup-riot-id" class="setup-input" placeholder="PlayerName#NA1" value="${escapeAttr(riotIdValue)}" autocomplete="off">
      </div>
      <div class="setup-field">
        <label for="setup-henrik-key">Henrik API key <span class="setup-hint">(<a href="https://api.henrikdev.xyz/dashboard/" target="_blank" rel="noopener">free — get key</a>)</span></label>
        <input type="password" id="setup-henrik-key" class="setup-input" placeholder="${keySaved ? 'Paste new key to replace saved key' : 'HDEV-… or your Henrik key'}" autocomplete="off">
        ${legacyNote}
        ${keyStatus}
        <p class="setup-hint setup-riot-key-note">Sign in at <a href="https://api.henrikdev.xyz/dashboard/" target="_blank" rel="noopener">api.henrikdev.xyz/dashboard</a>, copy your API key, paste here, then <strong>Apply &amp; Go</strong>. Does not expire like Riot dev keys.</p>
      </div>
      <div class="setup-field-row">
        <div class="setup-field setup-field-region">
          <label for="setup-riot-region">Region</label>
          <select id="setup-riot-region" class="setup-input">
            <option value="na"${riotRegionValue === 'na' ? ' selected' : ''}>NA</option>
            <option value="eu"${riotRegionValue === 'eu' ? ' selected' : ''}>EU</option>
            <option value="ap"${riotRegionValue === 'ap' ? ' selected' : ''}>AP</option>
            <option value="kr"${riotRegionValue === 'kr' ? ' selected' : ''}>KR</option>
            <option value="latam"${riotRegionValue === 'latam' ? ' selected' : ''}>LATAM</option>
            <option value="br"${riotRegionValue === 'br' ? ' selected' : ''}>BR</option>
          </select>
        </div>
        <span class="setup-status-pill${riotIdValue ? ' ok' : ''}" id="setup-valorant-pill">${riotIdValue ? '● Riot ID saved locally' : '○ Add for Valorant auto-log'}</span>
      </div>
    </div>`;
}

function renderApplySection(showPatchIni = true) {
  return `
    ${showPatchIni ? `
    <label class="setup-apply-check">
      <input type="checkbox" id="setup-patch-ini" checked>
      Enable <code>DefaultStatsAPI.ini</code> for me (Port 49123, PacketSendRate 10)
    </label>` : ''}
    <button type="button" class="btn btn-primary setup-apply-btn" id="setup-apply-go">Apply &amp; Go</button>
    <div id="setup-apply-result" class="setup-apply-result hidden" aria-live="polite"></div>`;
}

export function renderSetupWizard(displayName = '') {
  const el = document.getElementById('setup-wizard');
  if (!el) return;

  const prefs = loadSetupPrefs();
  const quickPrefs = loadPrefs();
  const profile = getProfileContext(displayName);
  const rlName = profile.rlName;
  const bridge = bridgeReadyForSetup();
  const valStatus = getCachedValorantStatus();
  const overwolfLinked = Boolean(valStatus?.overwolfConnected);
  const riotIdValue = quickPrefs.riotId ?? '';
  const riotRegionValue = quickPrefs.riotRegion ?? 'na';
  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const allReady = isVal ? isValorantAutoLogReady(isBridgeUp(), valStatus) : isBridgeUp();
  const launcher = getDesktopLauncher(state.activeGame);
  const compact = allReady && prefs.dismissedWhenReady;

  el.classList.remove('hidden');

  if (compact) {
    el.innerHTML = `
      <div class="setup-wizard setup-ready" data-setup-game="${state.activeGame}">
        <div class="setup-callout setup-callout-success">
          <strong>${DESKTOP_APP.name} is running.</strong>
          ${isVal
    ? (overwolfLinked
      ? 'Overwolf linked — turn Auto-log ON in the dock and play.'
      : 'Henrik API linked — turn Auto-log ON in the dock and play.')
    : 'Rocket League auto-log is ready on this PC.'}
        </div>
        <button type="button" class="btn btn-secondary" id="setup-show-steps">Show full setup steps</button>
        ${isVal
    ? renderValPanel(riotIdValue, riotRegionValue, { compact: true, overwolfLinked })
    : renderRlPanel(profile, { compact: true })}
      </div>`;
    wireSetupWizard();
    wireSetupApplyGo();
    if (bridge) {
      prefillRiotFromBridge();
      void updateOverwolfSetupUI();
    }
    return;
  }

  el.innerHTML = `
    <div class="setup-wizard${allReady ? ' setup-ready' : ''}" data-setup-game="${state.activeGame}">
      ${allReady ? '' : `
      <div class="setup-banner">
        <span class="setup-banner-icon">👇</span>
        <div>
          <strong>One-time setup on your PC — ${isVal ? 'Valorant' : 'Rocket League'}</strong>
          <p>${isVal
    ? `Open <strong>${DESKTOP_APP.name}</strong>, add Riot ID + Henrik key, then <strong>Apply &amp; Go</strong>.`
    : `Open <strong>${DESKTOP_APP.name}</strong>, then click <strong>Apply &amp; Go</strong>.`}</p>
        </div>
      </div>`}
      <div class="setup-wizard-head">
        <div>
          <span class="setup-kicker">${allReady ? 'All set' : 'One-time setup'} · ${isVal ? 'Valorant' : 'Rocket League'}</span>
          <h3>${allReady ? `You're ready — ${isVal ? 'Valorant' : 'Rocket League'}` : `${isVal ? 'Valorant' : 'Rocket League'} auto-log setup`}</h3>
          <p class="setup-desc">${allReady
    ? (isVal
      ? (overwolfLinked
        ? 'Overwolf is linked. Turn Auto-log ON and play Competitive — matches log when they end.'
        : 'Henrik API linked. Turn Auto-log ON and play — matches auto-log after they end.')
      : 'G/A/S fill in automatically. You pick W/L and enter End MMR after each game.')
    : (isVal
      ? `Open ${DESKTOP_APP.name}, add Riot ID + Henrik key, then Apply & Go.`
      : `Rocket League only — enter your RL name, keep ${DESKTOP_APP.name} running, then Apply & Go.`)}
          </p>
        ${allReady ? `<button type="button" class="setup-dismiss" id="setup-dismiss">Got it</button>` : ''}
      </div>
      ${allReady ? `
      <div class="setup-callout setup-callout-success">
        <strong>While you play:</strong> keep <code>${launcher}</code> running (leave the window open).
      </div>
      <div class="setup-callout setup-callout-workflow">
        <strong>After each ${isVal ? 'match' : 'game'}:</strong> ${isVal
    ? 'K/D/A fill automatically → confirm <strong>End RR</strong> → tap tags → <span class="setup-log-chip">LOG</span>'
    : `tap <span class="setup-log-chip">W</span> or <span class="setup-log-chip setup-log-chip-loss">L</span>
        → check G/A/S → tags → <strong>End MMR</strong> → <span class="setup-log-chip">LOG</span>`}
      </div>` : ''}
      ${isVal
    ? renderValSteps(riotIdValue, riotRegionValue, bridge, allReady, overwolfLinked)
    : renderRlSteps(profile, rlName, bridge, allReady)}
      <div class="setup-footer">
        ${!allReady ? `
        <div class="setup-callout setup-callout-workflow">
          <strong>After setup — between ${isVal ? 'matches' : 'games'}:</strong> ${isVal
    ? 'W/L → queue → K/D/A → tags → End RR → <span class="setup-log-chip">LOG</span>'
    : `W/L → mode → G/A/S → tags → End MMR → <span class="setup-log-chip">LOG</span>`}
        </div>` : ''}
        ${renderRankBaselinesPanel()}
      </div>
    </div>`;

  wireSetupWizard();
  updateBridgePill(bridge);
  if (bridge) {
    prefillRiotFromBridge();
    void updateOverwolfSetupUI();
  }
}

async function prefillRiotFromBridge() {
  try {
    const setup = await fetchBridgeSetupStatus();
    const cfg = setup.config ?? {};
    const riotInput = document.getElementById('setup-riot-id');
    const regionSel = document.getElementById('setup-riot-region');
    const keyField = document.getElementById('setup-henrik-key');
    if (riotInput && !riotInput.value && cfg.riotId) {
      riotInput.value = cfg.riotId;
      savePrefs({ riotId: cfg.riotId });
    }
    if (regionSel && cfg.riotRegion) {
      regionSel.value = cfg.riotRegion;
      savePrefs({ riotRegion: cfg.riotRegion });
    }
    if (keyField && cfg.henrikApiKeySet) {
      keyField.placeholder = 'Paste new key to replace saved key';
      const fieldWrap = keyField.closest('.setup-field');
      if (fieldWrap && !fieldWrap.querySelector('.setup-riot-key-saved')) {
        const note = document.createElement('p');
        note.className = 'setup-hint setup-riot-key-saved';
        note.textContent = cfg.henrikKeyViaEnv
          ? 'Henrik key loaded from environment on this PC — paste above only to replace the saved key.'
          : 'Henrik key saved on this PC — paste a new key above to replace it.';
        keyField.insertAdjacentElement('afterend', note);
      }
    } else if (keyField && cfg.hasLegacyRiotKey && !cfg.henrikApiKeySet) {
      const fieldWrap = keyField.closest('.setup-field');
      if (fieldWrap && !fieldWrap.querySelector('.setup-legacy-riot-note')) {
        const note = document.createElement('p');
        note.className = 'setup-hint setup-riot-key-note setup-legacy-riot-note';
        note.innerHTML = 'Your saved <code>RGAPI-</code> key cannot load Val matches. Get a free Henrik key at <a href="https://api.henrikdev.xyz/dashboard/" target="_blank" rel="noopener">api.henrikdev.xyz/dashboard</a>.';
        keyField.insertAdjacentElement('afterend', note);
      }
    }
    document.querySelector('.setup-step[data-step="valorant"]')?.classList.toggle('done', Boolean(riotInput?.value.trim()) && cfg.henrikApiKeySet);
    const pill = document.getElementById('setup-valorant-pill');
    if (pill && riotInput?.value.trim()) {
      pill.textContent = cfg.henrikApiKeySet ? '● Saved on this PC' : (cfg.hasLegacyRiotKey ? '○ Needs Henrik key' : '○ Add API key');
      pill.classList.toggle('ok', Boolean(cfg.henrikApiKeySet));
    }
  } catch {
    /* bridge not ready yet */
  }
}

function loadSetupPrefs() {
  try {
    return { iniDone: false, dismissedWhenReady: false, ...JSON.parse(localStorage.getItem(SETUP_KEY) ?? '{}') };
  } catch {
    return { iniDone: false, dismissedWhenReady: false };
  }
}

function saveSetupPrefs(partial) {
  const next = { ...loadSetupPrefs(), ...partial };
  localStorage.setItem(SETUP_KEY, JSON.stringify(next));
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function updateOverwolfSetupUI() {
  if (state.activeGame !== GAME_IDS.VALORANT) return;

  const pill = document.getElementById('setup-overwolf-pill');
  let status = getCachedValorantStatus();
  if (bridgeReadyForSetup()) {
    status = (await refreshValorantStatus()) ?? status;
  }
  const linked = Boolean(status?.overwolfConnected);
  if (pill) {
    pill.textContent = linked ? '● Overwolf linked' : '○ Waiting for Overwolf extension…';
    pill.classList.toggle('ok', linked);
  }
  if (linked) {
    document.querySelector('.setup-overwolf-advanced')?.setAttribute('open', '');
  }

  const pathEl = document.getElementById('setup-ow-path');
  if (pathEl && bridgeReadyForSetup()) {
    try {
      const setup = await fetchBridgeSetupStatus();
      const owPath = setup.paths?.overwolfExtension;
      if (owPath) pathEl.textContent = owPath;
    } catch { /* bridge starting */ }
  }
}

function wireOverwolfSetupActions() {
  const copyBtn = document.getElementById('setup-ow-copy-path');
  if (!copyBtn || copyBtn.dataset.wired) return;
  copyBtn.dataset.wired = '1';
  copyBtn.addEventListener('click', async () => {
    let finalPath = '';
    if (bridgeReadyForSetup()) {
      try {
        const setup = await fetchBridgeSetupStatus();
        finalPath = setup.paths?.overwolfExtension?.trim() || '';
        const pathEl = document.getElementById('setup-ow-path');
        if (finalPath && pathEl) pathEl.textContent = finalPath;
      } catch { /* fall through */ }
    }
    if (!finalPath) {
      const pathEl = document.getElementById('setup-ow-path');
      finalPath = pathEl?.textContent?.trim() || '';
    }
    if (!finalPath || /^integrations[/\\]/i.test(finalPath)) {
      showToast('Start Valorant Tracker.bat first, then click Copy path again', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(finalPath);
      showToast('Overwolf folder path copied');
    } catch {
      showToast('Could not copy — select the path and copy manually', 'error');
    }
  });
}

function wireSetupWizard() {
  document.getElementById('setup-dismiss')?.addEventListener('click', () => {
    saveSetupPrefs({ dismissedWhenReady: true });
    renderSetupWizard(displayNameFromAuth());
  });

  document.getElementById('setup-show-steps')?.addEventListener('click', () => {
    saveSetupPrefs({ dismissedWhenReady: false });
    renderSetupWizard(displayNameFromAuth());
  });

  document.querySelectorAll('.setup-mark').forEach(btn => {
    btn.addEventListener('click', () => {
      saveSetupPrefs({ [btn.dataset.mark]: true });
      btn.closest('.setup-step')?.classList.add('done');
      showToast('Step marked done');
    });
  });

  document.getElementById('setup-rl-name')?.addEventListener('change', e => {
    saveRlNameFromInput(e.target);
  });

  document.getElementById('setup-rl-name')?.addEventListener('blur', e => {
    saveRlNameFromInput(e.target);
  });

  wireProfileNameDropdown();
  wireSetupApplyGo();
  wireRankBaselinesButton();
  wireOverwolfSetupActions();

  const clearBtn = document.getElementById('setup-clear-val-history');
  if (clearBtn && !clearBtn.dataset.wired) {
    clearBtn.dataset.wired = '1';
    clearBtn.addEventListener('click', async () => {
      const ok = await clearGameHistory(GAME_IDS.VALORANT);
      if (!ok) return;
      try {
        await bridgeFetch('/valorant/reset-baseline', { method: 'POST' });
      } catch { /* bridge optional */ }
      refreshValorantStatus();
      document.dispatchEvent(new CustomEvent('tracker-data-changed'));
    });
  }
}

function wireRankBaselinesButton() {
  const btn = document.getElementById('setup-edit-rank-baselines');
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = '1';
  btn.addEventListener('click', () => {
    openRankSetupModal({
      onComplete: () => {
        document.dispatchEvent(new CustomEvent('tracker-data-changed'));
      },
    });
  });
}

function wireSetupApplyGo() {
  const btn = document.getElementById('setup-apply-go');
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = '1';

  btn.addEventListener('click', async () => {
    const input = document.getElementById('setup-rl-name');
    const name = input?.value.trim() ?? loadPrefs().rlDisplayName?.trim() ?? '';
    const riotId = document.getElementById('setup-riot-id')?.value.trim() ?? '';
    const henrikApiKey = document.getElementById('setup-henrik-key')?.value.trim() ?? '';
    const riotRegion = document.getElementById('setup-riot-region')?.value ?? 'na';
    const isVal = state.activeGame === GAME_IDS.VALORANT;
    let savedKeySet = false;
    if (isVal) {
      try {
        savedKeySet = Boolean((await fetchBridgeSetupStatus()).config?.henrikApiKeySet);
      } catch { /* bridge check below */ }
    }
    if (isVal) {
      if (!riotId) {
        showToast('Enter your Riot ID (Name#TAG) for Valorant auto-log', 'error');
        document.getElementById('setup-riot-id')?.focus();
        return;
      }
      if (henrikApiKey.startsWith('RGAPI-')) {
        showToast('Riot dev keys cannot load Val matches — use a Henrik key from api.henrikdev.xyz/dashboard', 'error');
        document.getElementById('setup-henrik-key')?.focus();
        return;
      }
      if (!henrikApiKey && !savedKeySet) {
        showToast('Paste your Henrik API key — free at api.henrikdev.xyz/dashboard', 'error');
        document.getElementById('setup-henrik-key')?.focus();
        return;
      }
    } else if (!name) {
      showToast('Enter your Rocket League display name first', 'error');
      input?.focus();
      return;
    }

    if (!bridgeReadyForSetup()) {
      const launcher = getDesktopLauncher(state.activeGame);
      showToast(`Run ${launcher} first, then click Apply & Go`, 'error');
      return;
    }

    if (input) saveRlNameFromInput(input);
    btn.disabled = true;
    btn.textContent = 'Applying…';

    const resultEl = document.getElementById('setup-apply-result');
    const patchIniEl = document.getElementById('setup-patch-ini');
    const patchIni = isVal ? false : (patchIniEl?.checked !== false);

    try {
      const result = await applyBridgeSetup({
        rlDisplayName: isVal ? '' : name,
        riotId: isVal ? riotId : '',
        henrikApiKey: isVal ? henrikApiKey : '',
        riotRegion: isVal ? riotRegion : undefined,
        patchIni,
      });
      if (riotId) savePrefs({ riotId, riotRegion });
      await refreshValorantStatus();
      refreshBridgeStatusUI();

      const riotFailed = isVal && result.riotValidation && !result.riotValidation.ok;
      if (resultEl) {
        resultEl.classList.remove('hidden');
        const lines = isVal
          ? [
            result.files?.grindConfig ? '✓ Saved Riot ID + settings to config/grind-config.json' : null,
            riotFailed
              ? `✗ ${result.riotValidation.error}`
              : result.riotValidation?.ok
                ? `✓ Riot account verified: ${result.riotValidation.riotId || riotId}`
                : '↻ Re-checking saved key…',
            !riotFailed && result.riotValidation?.ok
              ? '✓ Henrik connected — play one match to finish sync, then matches auto-log'
              : null,
            riotFailed && result.riotValidation?.error?.includes('Henrik')
              ? '↻ api.henrikdev.xyz/dashboard → copy API key → paste above → Apply again'
              : null,
            ...(result.warnings ?? []).map(w => `⚠ ${w}`),
          ]
          : [
            result.files?.startGrindBat ? '✓ Updated Rocket League Tracker.bat' : null,
            result.files?.statsApiIni ? '✓ Updated Rocket League Stats API file' : null,
            result.files?.grindConfig ? '✓ Saved local config' : null,
            `✓ Watching player: ${name || riotId}`,
            result.iniNeedsRlRestart ? '↻ Fully restart Rocket League once if it was already open' : null,
            ...(result.warnings ?? []).map(w => `⚠ ${w}`),
          ];
        resultEl.innerHTML = `<div class="setup-callout ${riotFailed ? 'setup-callout-important' : 'setup-callout-success'}">${lines.filter(Boolean).map(l => `<div>${escapeHtml(l)}</div>`).join('')}</div>`;
      }
      document.querySelector('.setup-step[data-step="apply"]')?.classList.toggle('done', !riotFailed);
      if (name && !isVal) document.querySelector('.setup-step[data-step="name"]')?.classList.add('done');
      document.querySelector('.setup-step[data-step="valorant"]')?.classList.toggle('done', Boolean(riotId) && !riotFailed);
      if (!riotFailed) saveSetupPrefs({ iniDone: true });
      showToast(
        riotFailed
          ? result.riotValidation.error
          : isVal ? 'Valorant auto-log linked on this PC!' : 'Settings applied on your PC!',
        riotFailed ? 'error' : undefined,
      );
    } catch (e) {
      if (resultEl) {
        resultEl.classList.remove('hidden');
        resultEl.innerHTML = `<div class="setup-callout setup-callout-important">${escapeHtml(e.message || 'Apply failed')}</div>`;
      }
      showToast(e.message || `Apply failed — is ${getDesktopLauncher(state.activeGame)} running?`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Apply & Go';
    }
  });
}

function getProfileContext(fallbackName = '') {
  const user = getAuthUser();
  const display = getUserDisplay(user);
  return {
    name: display.name,
    avatar: display.avatar,
    color: display.color,
    email: user?.email ?? '',
    googleName: display.name,
    rlName: getRlDisplayName() || fallbackName || '',
  };
}

function renderProfileNameStep(profile) {
  const googleSuggest = profile.googleName && profile.googleName !== profile.rlName
    ? `<button type="button" class="setup-profile-dropdown-item" data-suggest-name="${escapeAttr(profile.googleName)}">Use Google name: ${escapeHtml(profile.googleName)}</button>`
    : '';
  const showToggle = Boolean(googleSuggest);

  return `
    <strong>Your in-game name</strong>
    <p class="setup-name-intro">This is the name at the top of your profile — copy it <em>exactly</em> into the box below.</p>
    <figure class="setup-name-example">
      <img src="${getAssetUrl('assets/setup/profile-name-example.svg')}" alt="Profile example — the name next to your avatar is your display name" width="960" height="auto" loading="lazy">
      <figcaption>↑ Use this name — same spelling and caps as shown.</figcaption>
    </figure>
    <div class="setup-name-field-row">
      <input type="text" id="setup-rl-name" class="setup-input setup-name-input" placeholder="e.g. twan" value="${escapeAttr(profile.rlName)}" autocomplete="off" spellcheck="false">
      <div class="setup-name-suggest-wrap">
        <button type="button" class="setup-profile-name-toggle${showToggle ? '' : ' hidden'}" id="setup-rl-name-toggle" aria-expanded="false" aria-label="Name suggestions">▼</button>
        <div class="setup-profile-dropdown hidden" id="setup-rl-name-dropdown">${googleSuggest}</div>
      </div>
    </div>
    <p class="setup-callout setup-callout-tip">Must match your Rocket League display name <em>exactly</em> — same spelling and caps as in-game.</p>`;
}

function wireProfileNameDropdown() {
  const toggle = document.getElementById('setup-rl-name-toggle');
  const dropdown = document.getElementById('setup-rl-name-dropdown');
  if (!toggle || !dropdown) return;

  toggle.addEventListener('click', e => {
    e.stopPropagation();
    const opening = dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden', !opening);
    toggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
    if (opening) {
      setTimeout(() => {
        document.addEventListener('click', closeProfileDropdown, { once: true });
      }, 0);
    }
  });

  dropdown.querySelectorAll('[data-suggest-name]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const input = document.getElementById('setup-rl-name');
      const name = btn.dataset.suggestName ?? '';
      if (input) input.value = name;
      saveRlNameFromInput(input);
      closeProfileDropdown();
      showToast('RL name updated');
    });
  });
}

function closeProfileDropdown() {
  document.getElementById('setup-rl-name-dropdown')?.classList.add('hidden');
  document.getElementById('setup-rl-name-toggle')?.setAttribute('aria-expanded', 'false');
}

function saveRlNameFromInput(inputEl) {
  if (!inputEl) return;
  const name = inputEl.value.trim();
  saveRlDisplayName(name);
  savePrefs({ rlDisplayName: name });
  inputEl.closest('.setup-step')?.classList.toggle('done', Boolean(name));
}

export function refreshSetupWizard(displayName) {
  renderSetupWizard(displayName ?? displayNameFromAuth());
}

function updateBridgePill(bridge) {
  const pill = document.getElementById('setup-bridge-pill');
  const launcher = getDesktopLauncher(state.activeGame);
  const wrongTab = bridge && isWrongTrackerTab();
  const trackerUrl = getLocalTrackerUrl();
  if (pill) {
    pill.textContent = wrongTab
      ? `● Bridge running — open ${trackerUrl}`
      : bridge
        ? `● ${DESKTOP_APP.name} is running — you're good`
        : `○ Waiting for ${launcher}…`;
    pill.classList.toggle('ok', bridge);
  }
  if (bridge) {
    document.querySelector('.setup-step[data-step="bridge"]')?.classList.add('done');
  }
}

function displayNameFromAuth() {
  const u = getAuthUser();
  return u?.user_metadata?.full_name || u?.user_metadata?.name || u?.email?.split('@')[0] || '';
}

let bridgeWasUpForSetup = false;

export function onBridgeStatusChange() {
  const reachable = bridgeReadyForSetup();
  updateBridgePill(reachable);
  refreshBridgeStatusUI();
  renderLogSetupNudge();
  void updateOverwolfSetupUI();
  if (reachable && !bridgeWasUpForSetup) {
    bridgeWasUpForSetup = true;
    refreshSetupWizard(displayNameFromAuth());
  }
  if (!reachable) bridgeWasUpForSetup = false;
}
