/** Game switcher + per-game dock shell (RL / Valorant stay separate) */

import { state, setActiveGame, subscribe, getActiveGames } from './state.js';
import { GAMES, GAME_IDS, getGameMeta, getTagGroups, getPlaylists, getAgents, getMaps, getPageCopy } from './games.js';
import { rankLadderSelectHTML } from './games/valorant/rank-ladder.js';
import { saveSettings } from './supabase.js';
import { savePrefs, loadPrefs, refreshQuickTagsOnGameSwitch } from './quicklog.js';
import { refreshBridgeStatusUI } from './bridge-ui.js';
import { DESKTOP_APP, LOCAL_TRACKER_URL, getDesktopLauncher } from './config.js';
import { APP_NAME } from './core/app-config.js';
import { isBridgeUp } from './bridge-client.js';
import { needsLocalTrackerForAutoLog } from './env.js';
import { waitingForGameLabel } from './status-copy.js';
import { refreshValorantStatus } from './valorant-live.js';
import { updateNavUI } from './nav.js';
import { restoreSessionFromStorage, refreshSessionUI } from './sessions.js';
import { renderLogSetupNudge, refreshSetupWizard } from './setup-wizard.js';
import { applyDockForGame } from './dock-ui.js';
import { routeActiveGame } from './games/router.js';
import { DEFAULT_FILTERS } from './filters.js';
import { resetQuickFilter } from './match-logs-ui.js';

let onGameChange = null;
let getSettingsPayloadFn = null;
let switcherWired = false;
let lastSwitcherGame = null;

export function initGameSwitcher({ onChange, getSettingsPayload }) {
  onGameChange = onChange;
  getSettingsPayloadFn = getSettingsPayload;
  lastSwitcherGame = state.activeGame;
  renderGameSwitcher();
  subscribe(() => {
    if (state.activeGame === lastSwitcherGame) return;
    lastSwitcherGame = state.activeGame;
    renderGameSwitcher();
  });

  if (switcherWired) return;
  switcherWired = true;

  document.getElementById('game-switcher')?.addEventListener('click', onGameSwitchClick);
  document.getElementById('v0-mobile-game-switch')?.addEventListener('click', onGameSwitchClick);
}

async function onGameSwitchClick(e) {
    const btn = e.target.closest('[data-game]');
    if (!btn || btn.dataset.game === state.activeGame) return;
    const next = btn.dataset.game;
    if (!GAMES[next]) return;

    setActiveGame(next);
    routeActiveGame(next);
    savePrefs({ activeGame: next });
    state.playlist = next === GAME_IDS.VALORANT ? 'comp' : 'all';
    state.filters = { ...DEFAULT_FILTERS };
    state.matchLogFilters = { ...DEFAULT_FILTERS };
    resetQuickFilter();

    if (getSettingsPayloadFn) {
      await saveSettings(getSettingsPayloadFn({ activeGame: next }));
    }

    applyGameShell(next);
    updateNavUI(state.activePage || document.body.dataset.page || 'dashboard', next);
    applyPageCopy(next);
    restoreSessionFromStorage(getActiveGames());
    refreshQuickTagsOnGameSwitch();
    refreshSessionUI();
    renderLogSetupNudge();
    if (document.body.dataset.page === 'setup') refreshSetupWizard();
    if (next === GAME_IDS.VALORANT) refreshValorantStatus();
    else refreshBridgeStatusUI();
    if (onGameChange) onGameChange(next);
}

function renderGameSwitcher() {
  const html = Object.values(GAMES).map(g => `
    <button type="button" class="game-switch-btn${state.activeGame === g.id ? ' active' : ''}"
      data-game="${g.id}" aria-pressed="${state.activeGame === g.id}">
      <span class="game-switch-emoji">${g.emoji}</span>
      <span class="game-switch-label">${g.shortLabel}</span>
    </button>
  `).join('');

  const el = document.getElementById('game-switcher');
  if (el) el.innerHTML = html;

  const mobile = document.getElementById('v0-mobile-game-switch');
  if (mobile) mobile.innerHTML = html;
}

export function applyGameShell(gameId = state.activeGame) {
  const meta = getGameMeta(gameId);

  document.body.dataset.activeGame = gameId;
  document.body.classList.toggle('theme-valorant', gameId === GAME_IDS.VALORANT);
  document.body.classList.toggle('theme-rocket-league', gameId === GAME_IDS.ROCKET_LEAGUE);

  if (gameId === GAME_IDS.VALORANT && (!state.playlist || state.playlist === 'all')) {
    state.playlist = 'comp';
  }

  document.title = APP_NAME;

  const bridgeStatus = document.getElementById('live-bridge-status');
  if (bridgeStatus) {
    bridgeStatus.title = `${DESKTOP_APP.name} — automatic stats from ${meta.bridgeLabel}`;
  }

  const banner = document.getElementById('bridge-hint-banner');
  if (banner && !isBridgeUp()) {
    const badge = banner.querySelector('.bridge-hint-badge');
    if (badge) badge.textContent = needsLocalTrackerForAutoLog() ? 'Manual log only' : 'Auto-log off';
    const p = banner.querySelector('p');
    if (p) {
      if (needsLocalTrackerForAutoLog()) {
        p.innerHTML = `Install <strong>${DESKTOP_APP.name}</strong> on your gaming PC for automatic match tracking. `
          + '<button type="button" class="btn-link bridge-hint-link" id="bridge-hint-setup-link">Auto-Log Setup →</button>';
      } else {
        p.innerHTML = gameId === GAME_IDS.VALORANT
          ? `${waitingForGameLabel(GAME_IDS.VALORANT)} — finish Auto-Log Setup (Riot ID + Henrik key). `
            + '<button type="button" class="btn-link bridge-hint-link" id="bridge-hint-setup-link">Auto-Log Setup →</button>'
          : `${waitingForGameLabel(GAME_IDS.ROCKET_LEAGUE)} — set your in-game name in `
            + '<button type="button" class="btn-link bridge-hint-link" id="bridge-hint-setup-link">Auto-Log Setup →</button>';
      }
    }
  }

  const autoLogBtn = document.getElementById('auto-log-toggle');
  if (autoLogBtn) {
    autoLogBtn.title = gameId === GAME_IDS.VALORANT
      ? 'Auto-save Valorant matches when a round ends'
      : 'Auto-save games when a match ends';
  }

  applyDockForGame(gameId);
  toggleGamePageChrome(gameId);
  syncEditModal(gameId);
  syncFullLogForm(gameId);
  applyPageCopy(gameId);
  refreshBridgeStatusUI();
}

function toggleGamePageChrome(gameId) {
  document.querySelectorAll('[data-game-ui="rl"]').forEach(el => {
    el.classList.toggle('hidden', gameId !== GAME_IDS.ROCKET_LEAGUE);
  });
  document.querySelectorAll('[data-game-ui="valorant"]').forEach(el => {
    el.classList.toggle('hidden', gameId !== GAME_IDS.VALORANT);
  });

  const rlCharts = document.querySelector('.home-charts-row.rl-only');
  const valCharts = document.querySelector('.val-charts-row');
  if (rlCharts) rlCharts.classList.toggle('hidden', gameId !== GAME_IDS.ROCKET_LEAGUE);
  if (valCharts) valCharts.classList.toggle('hidden', gameId !== GAME_IDS.VALORANT);

  /* Activity section title is static in index.html — game-specific feed styling only */
}

function fillRankSelect(el, selected) {
  if (!el) return;
  el.innerHTML = rankLadderSelectHTML(selected);
}

function syncValorantRankSelects() {
  fillRankSelect(document.getElementById('f-startrank'), 'Iron 1');
  fillRankSelect(document.getElementById('f-endrank'), 'Iron 1');
  fillRankSelect(document.getElementById('e-startrank'), 'Iron 1');
  fillRankSelect(document.getElementById('e-endrank'), 'Iron 1');
  fillRankSelect(document.getElementById('quick-endrank'), 'Iron 1');
}

export function syncEditModal(gameId = state.activeGame) {
  const meta = getGameMeta(gameId);
  const isVal = gameId === GAME_IDS.VALORANT;

  const title = document.getElementById('edit-modal-title');
  if (title) title.textContent = isVal ? 'Edit Match' : 'Edit Game';

  const startLbl = document.getElementById('e-start-label');
  const endLbl = document.getElementById('e-end-label');
  if (startLbl) startLbl.textContent = `Starting ${meta.rankLabel}`;
  if (endLbl) endLbl.textContent = `Ending ${meta.rankLabel}`;

  const modeSel = document.getElementById('e-mode');
  if (modeSel) {
    const modes = getPlaylists(gameId).filter(p => p.mode);
    modeSel.innerHTML = modes.map(p => `<option value="${p.mode}">${p.label}</option>`).join('');
  }

  const agentSel = document.getElementById('e-agent');
  if (isVal && agentSel) {
    agentSel.innerHTML = '<option value="">—</option>';
    getAgents(gameId).forEach(a => {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      agentSel.appendChild(opt);
    });
  }

  const mapSel = document.getElementById('e-map');
  if (isVal && mapSel) {
    mapSel.innerHTML = '<option value="">—</option>';
    getMaps(gameId).forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      mapSel.appendChild(opt);
    });
  }
  if (isVal) syncValorantRankSelects();
}

export function syncFullLogForm(gameId = state.activeGame) {
  const meta = getGameMeta(gameId);
  const isVal = gameId === GAME_IDS.VALORANT;

  const fMode = document.getElementById('f-mode');
  if (fMode) {
    const playlists = getPlaylists(gameId).filter(p => p.mode);
    const activeMode = loadPrefs().lastModes?.[gameId] ?? loadPrefs().lastMode;
    fMode.innerHTML = playlists.map(p => `<option value="${p.mode}">${p.label}</option>`).join('');
    fMode.value = playlists.some(p => p.mode === activeMode) ? activeMode : (playlists[0]?.mode ?? activeMode);
    const modeGroup = fMode.closest('.form-group');
    if (modeGroup) {
      modeGroup.classList.toggle('hidden', isVal && playlists.length <= 1);
    }
    if (isVal && playlists.length <= 1) fMode.value = 'Competitive';
  }

  const labelMap = isVal
    ? [['f-goals', 'Kills'], ['f-assists', 'Deaths'], ['f-saves', 'Assists'], ['f-startmmr', `Start ${meta.rankLabel}`], ['f-endmmr', `End ${meta.rankLabel}`], ['f-session', 'Block #']]
    : [['f-goals', 'Goals'], ['f-assists', 'Assists'], ['f-saves', 'Saves'], ['f-startmmr', 'Starting MMR'], ['f-endmmr', 'Ending MMR'], ['f-session', 'Session #']];
  labelMap.forEach(([id, text]) => {
    const input = document.getElementById(id);
    const label = input?.closest('.form-group')?.querySelector('label');
    if (label) label.textContent = text;
  });

  const addBtn = document.getElementById('add-btn');
  if (addBtn) addBtn.textContent = isVal ? '+ Log Match' : '+ Log Game';

  const agentSel = document.getElementById('f-agent');
  const mapSel = document.getElementById('f-map');
  if (isVal && agentSel) {
    agentSel.innerHTML = '<option value="">—</option>';
    getAgents(gameId).forEach(a => {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      agentSel.appendChild(opt);
    });
  }
  if (isVal && mapSel) {
    mapSel.innerHTML = '<option value="">—</option>';
    getMaps(gameId).forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      mapSel.appendChild(opt);
    });
  }
  if (isVal) syncValorantRankSelects();
}

export function restoreActiveGameFromPrefs(settingsActiveGame) {
  const prefs = loadPrefs();
  const game = settingsActiveGame || prefs.activeGame || GAME_IDS.ROCKET_LEAGUE;
  setActiveGame(GAMES[game] ? game : GAME_IDS.ROCKET_LEAGUE);
  applyGameShell(state.activeGame);
  applyPageCopy(state.activeGame);
  refreshQuickTagsOnGameSwitch();
}

/** Update static page headings for the active game */
export function applyPageCopy(gameId = state.activeGame) {
  const pages = ['log', 'setup', 'focus', 'sessions', 'analytics', 'reports', 'group'];
  pages.forEach(pageId => {
    const copy = getPageCopy(pageId, gameId);
    if (!copy) return;
    const page = document.getElementById(`page-${pageId}`);
    const heading = page?.querySelector('.page-heading');
    const desc = page?.querySelector('.page-desc');
    if (heading) heading.textContent = copy.heading;
    if (desc) desc.textContent = copy.desc;
  });

  const analyticsSections = document.querySelectorAll('#page-analytics .section-title');
  if (gameId === GAME_IDS.VALORANT) {
    if (analyticsSections[0]) analyticsSections[0].textContent = 'Intel Cards';
    if (analyticsSections[1]) analyticsSections[1].textContent = 'Coach Brief';
    const tagTrend = document.querySelector('#page-analytics .section-title-sm');
    if (tagTrend) tagTrend.textContent = 'Tag Trends (per 5 matches)';
  } else {
    if (analyticsSections[0]) analyticsSections[0].textContent = 'Insights';
    if (analyticsSections[1]) analyticsSections[1].textContent = 'Trends';
    const tagTrend = document.querySelector('#page-analytics .section-title-sm');
    if (tagTrend) tagTrend.textContent = 'Tag Trends (per 5 games)';
  }

  const isVal = gameId === GAME_IDS.VALORANT;
  if (!state.session.active) {
    const startBtn = document.getElementById('session-start-btn');
    if (startBtn) startBtn.textContent = isVal ? '▶ Start Block' : '▶ Start Session';
  }
  const nextBtn = document.querySelector('#session-modal .btn-primary');
  if (nextBtn) nextBtn.textContent = isVal ? 'Start Next Block' : 'Start Next Session';
}

export { getTagGroups, getPlaylists };
