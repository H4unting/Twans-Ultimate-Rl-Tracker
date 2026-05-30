/** In-app setup wizard for auto stats + quick log workflow */

import { loadPrefs, savePrefs } from './quicklog.js';
import { isBridgeUp, getRlDisplayName, saveRlDisplayName } from './rl-live.js';
import { getAuthUser } from './auth.js';
import { getUserDisplay } from './state.js';
import { showToast } from './ui.js';

const SETUP_KEY = 'rl-grind-setup';

export function renderLogSetupNudge() {
  const el = document.getElementById('log-setup-nudge');
  if (!el) return;

  if (isBridgeUp()) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }

  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="log-setup-nudge-inner">
      <span class="log-setup-nudge-text">Want auto-log from Rocket League?</span>
      <button type="button" class="btn-link" id="log-setup-nudge-link">Open setup guide →</button>
    </div>`;
  document.getElementById('log-setup-nudge-link')?.addEventListener('click', () => {
    window.__navigate?.('setup', 'home');
  });
}

export function renderSetupWizard(displayName = '') {
  const el = document.getElementById('setup-wizard');
  if (!el) return;

  const prefs = loadSetupPrefs();
  const profile = getProfileContext(displayName);
  const rlName = profile.rlName;
  const bridge = isBridgeUp();
  const allReady = bridge;

  if (allReady && prefs.dismissedWhenReady) {
    el.innerHTML = '';
    el.classList.add('hidden');
    return;
  }

  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="setup-wizard${allReady ? ' setup-ready' : ''}">
      ${allReady ? '' : `
      <div class="setup-banner">
        <span class="setup-banner-icon">👇</span>
        <div>
          <strong>Read this once before you grind</strong>
          <p>Three quick steps on your PC. After that, logging each game takes a few seconds.</p>
        </div>
      </div>`}
      <div class="setup-wizard-head">
        <div>
          <span class="setup-kicker">${allReady ? 'All set' : 'One-time setup'}</span>
          <h3>${allReady ? 'You\'re ready to grind' : 'Auto stats setup'}</h3>
          <p class="setup-desc">${allReady
    ? 'Play a match — G/A/S fill in automatically. You only pick W/L and type your End MMR.'
    : 'Follow steps 1–3 below. Auto-log kicks in once the bridge connects.'}</p>
        </div>
        ${allReady ? `<button type="button" class="setup-dismiss" id="setup-dismiss">Got it</button>` : ''}
      </div>
      ${allReady ? `
      <div class="setup-callout setup-callout-success">
        <strong>While you play:</strong> keep the black <code>start-grind.bat</code> window open.
        Close it only when you\'re done for the day.
      </div>
      <div class="setup-callout setup-callout-workflow">
        <strong>After each game:</strong> tap <span class="setup-log-chip">W</span> or <span class="setup-log-chip setup-log-chip-loss">L</span>
        → check G/A/S → pick mode → tap tags if needed → enter <strong>End MMR</strong> → hit <span class="setup-log-chip">LOG</span>
      </div>` : ''}
      <ol class="setup-steps${allReady ? ' setup-steps-collapsed hidden' : ''}">
        <li class="setup-step${prefs.iniDone ? ' done' : ''}" data-step="ini">
          <span class="setup-step-num">1</span>
          <div class="setup-step-body">
            <strong>Enable RL Stats API</strong>
            <p>Open this file in Notepad:</p>
            <pre class="setup-code setup-code-path">Rocket League\\TAGame\\Config\\DefaultStatsAPI.ini</pre>
            <p>Paste or set these lines (change <code>PacketSendRate</code> to <strong>10</strong> if it says 0):</p>
            <pre class="setup-code">[TAGame.MatchStatsExporter_TA]
Port=49123
PacketSendRate=10</pre>
            <p class="setup-callout setup-callout-tip">Save the file, then fully restart Rocket League.</p>
            <button type="button" class="btn btn-cancel btn-sm setup-mark" data-mark="iniDone">Mark done</button>
          </div>
        </li>
        <li class="setup-step${rlName ? ' done' : ''}" data-step="name">
          <span class="setup-step-num">2</span>
          <div class="setup-step-body">
            ${renderProfileNameStep(profile)}
          </div>
        </li>
        <li class="setup-step${bridge ? ' done' : ''}" data-step="bridge">
          <span class="setup-step-num">3</span>
          <div class="setup-step-body">
            <strong>Start the tracker</strong>
            <p>Double-click this file in your tracker folder:</p>
            <pre class="setup-code setup-code-highlight" id="setup-bridge-cmd">start-grind.bat</pre>
            <div class="setup-callout setup-callout-important">
              <strong>One black window opens.</strong> Leave it open the whole time you play.
              Your browser opens automatically — same tracker, auto-stats when RL is running.
            </div>
            <span class="setup-status-pill${bridge ? ' ok' : ''}" id="setup-bridge-pill">${bridge ? '● Bridge connected — you\'re good' : '○ Waiting for start-grind.bat…'}</span>
          </div>
        </li>
      </ol>
      <div class="setup-footer">
        ${!allReady ? `
        <div class="setup-callout setup-callout-workflow">
          <strong>After setup — between games:</strong>
          W/L → mode (1's/2's/3's) → G/A/S → tags → End MMR → <span class="setup-log-chip">LOG</span>
        </div>` : ''}
      </div>
    </div>`;

  wireSetupWizard();
  updateBridgePill(bridge);
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
    document.getElementById('setup-wizard')?.classList.add('hidden');
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
    <p class="setup-callout setup-callout-tip">Must match your Rocket League display name <em>exactly</em> — the bridge uses this to find your stats in-game.</p>`;
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
    pill.textContent = bridge ? '● Bridge connected — you\'re good' : '○ Waiting for start-grind.bat…';
    pill.classList.toggle('ok', bridge);
  }
  if (bridge) {
    document.querySelector('.setup-step[data-step="bridge"]')?.classList.add('done');
    const wizard = document.querySelector('.setup-wizard');
    if (wizard && !wizard.classList.contains('setup-ready')) {
      renderSetupWizard(displayNameFromAuth());
    }
  }
}

function displayNameFromAuth() {
  const u = getAuthUser();
  return u?.user_metadata?.full_name || u?.user_metadata?.name || u?.email?.split('@')[0] || '';
}

export function onBridgeStatusChange() {
  updateBridgePill(isBridgeUp());
  renderLogSetupNudge();
  if (isBridgeUp()) renderSetupWizard(displayNameFromAuth());
}
