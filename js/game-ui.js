/** Game switcher + dock UI for RL / Valorant */

import { state, setActiveGame, subscribe } from './state.js';
import { GAMES, GAME_IDS, getGameMeta, getTagGroups, getPlaylists } from './games.js';
import { saveSettings } from './supabase.js';
import { savePrefs, loadPrefs } from './quicklog.js';

let onGameChange = null;

export function initGameSwitcher({ onChange, getSettingsPayload }) {
  onGameChange = onChange;
  renderGameSwitcher();
  subscribe(() => renderGameSwitcher());

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

function toggleDockLayouts(gameId) {
  document.querySelectorAll('[data-game-ui="rl"]').forEach(el => {
    el.classList.toggle('hidden', gameId !== GAME_IDS.ROCKET_LEAGUE);
  });
  document.querySelectorAll('[data-game-ui="valorant"]').forEach(el => {
    el.classList.toggle('hidden', gameId !== GAME_IDS.VALORANT);
  });

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
}

export { getTagGroups, getPlaylists };
