/** In-app setup wizard for auto stats + quick log workflow */

import { loadPrefs, savePrefs } from './quicklog.js';
import { isBridgeUp, getRlDisplayName, saveRlDisplayName, applyBridgeSetup, fetchBridgeSetupStatus } from './rl-live.js';
import { refreshValorantStatus } from './valorant-live.js';
import { getAuthUser } from './auth.js';
import { getUserDisplay, state } from './state.js';
import { GAME_IDS } from './games.js';
import { showToast } from './ui.js';
import { refreshBridgeStatusUI } from './bridge-ui.js';
import { DESKTOP_APP } from './config.js';

const SETUP_KEY = 'rl-grind-setup';

export function renderLogSetupNudge() {
  const el = document.getElementById('log-setup-nudge');
  if (!el) return;

  if (isBridgeUp()) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }

  const isVal = state.activeGame === GAME_IDS.VALORANT;
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="log-setup-nudge-inner">
      <span class="log-setup-nudge-text">${isVal
        ? `Want Valorant auto-log? Run ${DESKTOP_APP.launcher} and set Riot ID + API key.`
        : `Want auto-log from Rocket League? Run ${DESKTOP_APP.launcher} on this PC.`}</span>
      <button type="button" class="btn-link" id="log-setup-nudge-link">Auto-Log Setup →</button>
    </div>`;
  document.getElementById('log-setup-nudge-link')?.addEventListener('click', () => {
    window.__navigate?.('setup', 'home');
  });
}

function renderValorantFields(riotIdValue, riotRegionValue) {
  return `
    <label>Riot ID <span class="setup-hint">(Name#TAG)</span></label>
    <input type="text" id="setup-riot-id" class="setup-input" placeholder="PlayerName#NA1" value="${escapeAttr(riotIdValue)}" autocomplete="off">
    <label>Riot API key <span class="setup-hint">(<a href="https://developer.riotgames.com/" target="_blank" rel="noopener">developer.riotgames.com</a>)</span></label>
    <input type="password" id="setup-riot-key" class="setup-input" placeholder="RGAPI-..." autocomplete="off">
    <p class="setup-hint setup-riot-key-note">Dev keys expire every <strong>24 hours</strong> — paste a fresh key from <a href="https://developer.riotgames.com/" target="_blank" rel="noopener">developer.riotgames.com</a> when you see a Riot API error.</p>
    <label>Region</label>
    <select id="setup-riot-region" class="setup-input">
      <option value="na"${riotRegionValue === 'na' ? ' selected' : ''}>NA</option>
      <option value="eu"${riotRegionValue === 'eu' ? ' selected' : ''}>EU</option>
      <option value="ap"${riotRegionValue === 'ap' ? ' selected' : ''}>AP</option>
      <option value="kr"${riotRegionValue === 'kr' ? ' selected' : ''}>KR</option>
      <option value="latam"${riotRegionValue === 'latam' ? ' selected' : ''}>LATAM</option>
      <option value="br"${riotRegionValue === 'br' ? ' selected' : ''}>BR</option>
    </select>
    <span class="setup-status-pill${riotIdValue ? ' ok' : ''}" id="setup-valorant-pill">${riotIdValue ? '● Riot ID saved locally' : '○ Add for Valorant auto-log'}</span>`;
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
  const bridge = isBridgeUp();
  const riotIdValue = quickPrefs.riotId ?? '';
  const riotRegionValue = quickPrefs.riotRegion ?? 'na';
  const allReady = bridge;
  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const compact = allReady && prefs.dismissedWhenReady;

  el.classList.remove('hidden');

  if (compact) {
    el.innerHTML = `
      <div class="setup-wizard setup-ready">
        <div class="setup-callout setup-callout-success">
          <strong>${DESKTOP_APP.name} is running.</strong>
          ${isVal
    ? 'Enter Riot ID + API key below, then Apply &amp; Go.'
    : 'Rocket League auto-log is ready. Expand setup for Valorant or RL name changes.'}
        </div>
        <button type="button" class="btn btn-secondary" id="setup-show-steps">Show all setup steps</button>
        <div class="setup-step-body setup-valorant-compact">
          <strong>Valorant auto-log</strong>
          <p>Saved locally in <code>grind-config.json</code> on this PC.</p>
          ${renderValorantFields(riotIdValue, riotRegionValue)}
          ${renderApplySection(false)}
        </div>
      </div>`;
    wireSetupWizard();
    wireSetupApplyGo();
    if (bridge) prefillRiotFromBridge();
    return;
  }

  el.innerHTML = `
    <div class="setup-wizard${allReady ? ' setup-ready' : ''}">
      ${allReady ? '' : `
      <div class="setup-banner">
        <span class="setup-banner-icon">👇</span>
        <div>
          <strong>One-time setup on your PC</strong>
          <p>Enter your name, run <code>${DESKTOP_APP.launcher}</code>, then click <strong>Apply &amp; Go</strong>.</p>
        </div>
      </div>`}
      <div class="setup-wizard-head">
        <div>
          <span class="setup-kicker">${allReady ? 'All set' : 'One-time setup'}</span>
          <h3>${allReady ? 'You\'re ready to grind' : 'Auto stats setup'}</h3>
          <p class="setup-desc">${allReady
    ? (isVal
      ? `${DESKTOP_APP.name} is running. Set your Riot ID below and Apply — then play with auto-log ON.`
      : 'Play a match — G/A/S fill in automatically. You only pick W/L and type your End MMR.')
    : (isVal
      ? `Enter Riot ID + API key, start ${DESKTOP_APP.launcher}, then hit Apply & Go.`
      : `Enter your RL name, start ${DESKTOP_APP.launcher}, then hit Apply & Go — no manual file editing.`)}
          </p>
        ${allReady ? `<button type="button" class="setup-dismiss" id="setup-dismiss">Got it</button>` : ''}
      </div>
      ${allReady ? `
      <div class="setup-callout setup-callout-success">
        <strong>While you play:</strong> keep <code>${DESKTOP_APP.launcher}</code> running in the system tray (look for the tray icon).
      </div>
      <div class="setup-callout setup-callout-workflow">
        <strong>After each ${isVal ? 'match' : 'game'}:</strong> ${isVal
    ? 'K/D/A fill automatically → confirm <strong>End RR</strong> on the card → tap tags → <span class="setup-log-chip">LOG</span> (or turn on auto-log in the dock)'
    : `tap <span class="setup-log-chip">W</span> or <span class="setup-log-chip setup-log-chip-loss">L</span>
        → check G/A/S → pick mode → tap tags if needed → enter <strong>End MMR</strong> → hit <span class="setup-log-chip">LOG</span>`}
      </div>` : ''}
      <ol class="setup-steps">
        <li class="setup-step${allReady || isVal ? ' hidden' : ''}${rlName ? ' done' : ''}" data-step="name">
          <span class="setup-step-num">1</span>
          <div class="setup-step-body">
            ${renderProfileNameStep(profile)}
          </div>
        </li>
        <li class="setup-step${allReady ? ' hidden' : ''}${bridge ? ' done' : ''}" data-step="bridge">
          <span class="setup-step-num">2</span>
          <div class="setup-step-body">
            <strong>Run ${DESKTOP_APP.name}</strong>
            <p>Double-click <code>${DESKTOP_APP.launcher}</code> in your tracker folder (small tray app — keep it running while you play):</p>
            <pre class="setup-code setup-code-highlight" id="setup-bridge-cmd">${DESKTOP_APP.launcher}</pre>
            <span class="setup-status-pill${bridge ? ' ok' : ''}" id="setup-bridge-pill">${bridge ? `● ${DESKTOP_APP.name} is running — ready for Apply & Go` : `○ Waiting for ${DESKTOP_APP.launcher}…`}</span>
          </div>
        </li>
        <li class="setup-step${allReady ? ' hidden' : ''}" data-step="apply">
          <span class="setup-step-num">3</span>
          <div class="setup-step-body">
            <strong>Apply &amp; Go</strong>
            <p>${isVal
    ? 'Saves your Riot ID and API key to <code>grind-config.json</code> on this PC — used for Valorant auto-log only.'
    : 'We write your name into <code>start-grind.bat</code> and set up the Rocket League Stats API file on this PC.'}</p>
            ${isVal ? renderApplySection(false) : renderApplySection(true)}
          </div>
        </li>
        <li class="setup-step${riotIdValue ? ' done' : ''}" data-step="valorant">
          <span class="setup-step-num">4</span>
          <div class="setup-step-body">
            <strong>Valorant auto-log${allReady ? '' : ' (optional)'}</strong>
            <p>Add your Riot ID and API key — saved locally in <code>grind-config.json</code> when you Apply.</p>
            ${renderValorantFields(riotIdValue, riotRegionValue)}
            ${allReady ? renderApplySection(false) : ''}
          </div>
        </li>
      </ol>
      <div class="setup-footer">
        ${!allReady ? `
        <div class="setup-callout setup-callout-workflow">
          <strong>After setup — between ${isVal ? 'matches' : 'games'}:</strong> ${isVal
    ? 'W/L → queue → K/D/A → tags → End RR → <span class="setup-log-chip">LOG</span>'
    : `W/L → mode (1's/2's/3's) → G/A/S → tags → End MMR → <span class="setup-log-chip">LOG</span>`}
        </div>` : ''}
      </div>
    </div>`;

  wireSetupWizard();
  updateBridgePill(bridge);
  if (bridge) prefillRiotFromBridge();
}

async function prefillRiotFromBridge() {
  try {
    const setup = await fetchBridgeSetupStatus();
    const cfg = setup.config ?? {};
    const riotInput = document.getElementById('setup-riot-id');
    const regionSel = document.getElementById('setup-riot-region');
    if (riotInput && !riotInput.value && cfg.riotId) {
      riotInput.value = cfg.riotId;
      savePrefs({ riotId: cfg.riotId });
    }
    if (regionSel && cfg.riotRegion) {
      regionSel.value = cfg.riotRegion;
      savePrefs({ riotRegion: cfg.riotRegion });
    }
    document.querySelector('.setup-step[data-step="valorant"]')?.classList.toggle('done', Boolean(riotInput?.value.trim()));
    const pill = document.getElementById('setup-valorant-pill');
    if (pill && riotInput?.value.trim()) {
      pill.textContent = '● Riot ID saved locally';
      pill.classList.add('ok');
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
}

function wireSetupApplyGo() {
  const btn = document.getElementById('setup-apply-go');
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = '1';

  btn.addEventListener('click', async () => {
    const input = document.getElementById('setup-rl-name');
    const name = input?.value.trim() ?? loadPrefs().rlDisplayName?.trim() ?? '';
    const riotId = document.getElementById('setup-riot-id')?.value.trim() ?? '';
    const riotApiKey = document.getElementById('setup-riot-key')?.value.trim() ?? '';
    const riotRegion = document.getElementById('setup-riot-region')?.value ?? 'na';
    const isVal = state.activeGame === GAME_IDS.VALORANT;
    if (isVal) {
      if (!riotId || !riotApiKey) {
        showToast('Enter Riot ID and API key for Valorant auto-log', 'error');
        (document.getElementById('setup-riot-id') ?? document.getElementById('setup-riot-key'))?.focus();
        return;
      }
    } else if (!name && !riotId) {
      showToast('Enter your Rocket League name or Riot ID first', 'error');
      (input ?? document.getElementById('setup-riot-id'))?.focus();
      return;
    }

    if (!isBridgeUp()) {
      showToast(`Run ${DESKTOP_APP.launcher} first, then click Apply & Go`, 'error');
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
        riotId,
        riotApiKey,
        riotRegion,
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
            result.files?.grindConfig ? '✓ Saved Riot ID + API key in grind-config.json' : null,
            riotId ? `✓ Linked Riot account: ${riotId}` : null,
            riotFailed
              ? `✗ Riot rejected this key: ${result.riotValidation.error}`
              : result.riotValidation?.ok
                ? '✓ Riot API key verified — play one match to sync'
                : '↻ Play one match to sync — your next finished match can auto-log',
            riotFailed
              ? '↻ On developer.riotgames.com click Regenerate API Key, paste the new RGAPI key above, Apply again'
              : null,
            ...(result.warnings ?? []).map(w => `⚠ ${w}`),
          ]
          : [
            result.files?.startGrindBat ? '✓ Updated start-grind.bat' : null,
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
      showToast(e.message || `Apply failed — is ${DESKTOP_APP.launcher} running?`, 'error');
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
      <img src="assets/setup/profile-name-example.png" alt="Profile example — the name next to your avatar is your display name" width="960" height="auto" loading="lazy">
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
  renderSetupWizard(displayName);
}

function updateBridgePill(bridge) {
  const pill = document.getElementById('setup-bridge-pill');
  if (pill) {
    pill.textContent = bridge ? `● ${DESKTOP_APP.name} is running — you're good` : `○ Waiting for ${DESKTOP_APP.launcher}…`;
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
  const up = isBridgeUp();
  updateBridgePill(up);
  refreshBridgeStatusUI();
  renderLogSetupNudge();
  if (up && !bridgeWasUpForSetup) {
    bridgeWasUpForSetup = true;
    refreshSetupWizard(displayNameFromAuth());
  }
  if (!up) bridgeWasUpForSetup = false;
}
