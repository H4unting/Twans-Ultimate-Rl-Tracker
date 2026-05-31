/** Game switcher + dock UI for RL / Valorant */

import { state, setActiveGame, subscribe } from './state.js';
import { GAMES, GAME_IDS, getGameMeta, getTagGroups, getPlaylists, getAgents, getMaps, getPageCopy } from './games.js';
import { saveSettings } from './supabase.js';
import { savePrefs, loadPrefs } from './quicklog.js';
import { refreshLiveStatus } from './rl-live.js';
import { refreshValorantStatus } from './valorant-live.js';
import { updateNavUI } from './nav.js';

let onGameChange = null;
let switcherWired = false;

export function initGameSwitcher({ onChange, getSettingsPayload }) {
  onGameChange = onChange;
  renderGameSwitcher();
  subscribe(() => renderGameSwitcher());

  if (switcherWired) return;
  switcherWired = true;

  document.getElementById('game-switcher')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-game]');
    if (!btn || btn.dataset.game === state.activeGame) return;
    const next = btn.dataset.game;
    if (!GAMES[next]) return;

    setActiveGame(next);
    savePrefs({ activeGame: next });

    if (getSettingsPayload) {
      await saveSettings(getSettingsPayload({ activeGame: next }));
    }

    applyGameShell(next);
    updateNavUI(document.body.dataset.page || 'dashboard', next);
    applyPageCopy(next);
    if (next === GAME_IDS.VALORANT) refreshValorantStatus();
    else refreshLiveStatus();
    if (onGameChange) onGameChange(next);
  });
}

function renderGameSwitcher() {
  const el = document.getElementById('game-switcher');
  if (!el) return;
  el.innerHTML = Object.values(GAMES).map(g => `
    <button type="button" class="game-switch-btn${state.activeGame === g.id ? ' active' : ''}"
      data-game="${g.id}" aria-pressed="${state.activeGame === g.id}">
      <span class="game-switch-emoji">${g.emoji}</span>
      <span class="game-switch-label">${g.shortLabel}</span>
    </button>
  `).join('');
}

export function applyGameShell(gameId = state.activeGame) {
  const meta = getGameMeta(gameId);
  document.body.dataset.activeGame = gameId;
  document.body.classList.toggle('theme-valorant', gameId === GAME_IDS.VALORANT);
  document.body.classList.toggle('theme-rocket-league', gameId === GAME_IDS.ROCKET_LEAGUE);

  document.title = gameId === GAME_IDS.VALORANT
    ? 'Twans VAL Tracker'
    : 'Twans Ultimate Tracker';

  const logoBtn = document.getElementById('logo-home-btn');
  if (logoBtn) {
    logoBtn.innerHTML = gameId === GAME_IDS.VALORANT
      ? 'TWANS <span class="val-logo-accent">VAL</span> TRACKER'
      : 'Twans <span>Ultimate Tracker</span>';
  }

  const rankInput = document.getElementById('quick-endmmr');
  if (rankInput) rankInput.placeholder = `End ${meta.rankLabel}`;

  const hint = document.querySelector('.quick-dock-hint');
  if (hint) {
    hint.textContent = gameId === GAME_IDS.VALORANT
      ? 'Match ends → auto-log saves · confirm RR on the card · tap tags · undo if wrong'
      : 'Match ends → auto-log saves · confirm MMR on the card · tap tags · undo if wrong';
  }

  const bridgeStatus = document.getElementById('live-bridge-status');
  if (bridgeStatus) {
    bridgeStatus.title = `Automatic stats from ${meta.bridgeLabel}`;
  }

  const banner = document.getElementById('bridge-hint-banner');
  if (banner) {
    const p = banner.querySelector('p');
    if (p) {
      p.innerHTML = gameId === GAME_IDS.VALORANT
        ? 'Run <code>Twans-Tracker-Bridge.exe</code> on this PC while playing for Valorant auto-log. Set Riot ID in <button type="button" class="btn-link bridge-hint-link" id="bridge-hint-setup-link">Setup guide →</button>'
        : 'Run <code>Twans-Tracker-Bridge.exe</code> on this PC while playing for auto-log from Rocket League. <button type="button" class="btn-link bridge-hint-link" id="bridge-hint-setup-link">Setup guide →</button>';
    }
  }

  renderQuickModePills(gameId);
  toggleDockLayouts(gameId);
  toggleGamePageChrome(gameId);
  applyPageCopy(gameId);

  const agentSel = document.getElementById('quick-agent');
  const mapSel = document.getElementById('quick-map');
  if (agentSel && agentSel.options.length <= 1) {
    getAgents().forEach(a => {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      agentSel.appendChild(opt);
    });
  }
  if (mapSel && mapSel.options.length <= 1) {
    getMaps().forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      mapSel.appendChild(opt);
    });
  }
}

function renderQuickModePills(gameId) {
  const wrap = document.getElementById('quick-mode-pills');
  if (!wrap) return;
  const playlists = getPlaylists(gameId).filter(p => p.mode);
  const prefs = loadPrefs();
  const activeMode = prefs.lastMode || getGameMeta(gameId).defaultMode;
  wrap.innerHTML = playlists.map(p => `
    <button type="button" data-mode="${p.mode}" class="${p.mode === activeMode ? 'active' : ''}">${p.label}</button>
  `).join('');
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

  const recentHead = document.querySelector('.dash-recent-head .section-title');
  if (recentHead) {
    recentHead.textContent = gameId === GAME_IDS.VALORANT ? 'Match Feed' : 'Recent activity';
  }
}

function toggleDockLayouts(gameId) {
  const adv = document.querySelector('.quick-advanced-stats .qs-label');
  if (gameId === GAME_IDS.VALORANT) {
    const labels = document.querySelectorAll('.quick-advanced-stats .qs-label');
    if (labels[0]) labels[0].textContent = 'K';
    if (labels[1]) labels[1].textContent = 'D';
    if (labels[2]) labels[2].textContent = 'A';
  } else {
    const labels = document.querySelectorAll('.quick-advanced-stats .qs-label');
    if (labels[0]) labels[0].textContent = 'G';
    if (labels[1]) labels[1].textContent = 'A';
    if (labels[2]) labels[2].textContent = 'S';
  }
}

export function restoreActiveGameFromPrefs(settingsActiveGame) {
  const prefs = loadPrefs();
  const game = settingsActiveGame || prefs.activeGame || GAME_IDS.ROCKET_LEAGUE;
  setActiveGame(GAMES[game] ? game : GAME_IDS.ROCKET_LEAGUE);
  applyGameShell(state.activeGame);
  applyPageCopy(state.activeGame);
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
  } else {
    if (analyticsSections[0]) analyticsSections[0].textContent = 'Insights';
    if (analyticsSections[1]) analyticsSections[1].textContent = 'Trends';
  }
}

export { getTagGroups, getPlaylists };
