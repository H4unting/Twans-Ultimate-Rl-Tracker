/** Per-game log dock — RL and Valorant are separate DOM sections */

import { state } from './state.js';
import { GAME_IDS, getGameMeta, getPlaylists, getAgents, getMaps } from './games.js';

function getLastModeForGame(gameId) {
  try {
    const prefs = JSON.parse(localStorage.getItem('rl-grind-prefs') ?? '{}');
    return prefs.lastModes?.[gameId] ?? prefs.lastMode ?? (gameId === GAME_IDS.VALORANT ? 'Competitive' : "2's");
  } catch {
    return gameId === GAME_IDS.VALORANT ? 'Competitive' : "2's";
  }
}

export function applyDockForGame(gameId = state.activeGame) {
  const meta = getGameMeta(gameId);
  const isVal = gameId === GAME_IDS.VALORANT;

  document.querySelectorAll('[data-dock-game]').forEach(el => {
    el.classList.toggle('hidden', el.dataset.dockGame !== gameId);
  });

  renderDockModePills(gameId);
  updateDockStatLabels(gameId);

  const rankInput = document.getElementById('quick-endmmr');
  if (rankInput) rankInput.placeholder = `End ${meta.rankLabel}`;

  const hint = document.querySelector('.quick-dock-hint');
  if (hint) {
    hint.textContent = isVal
      ? 'Match ends → auto-log saves · confirm RR on the card · tap tags · undo if wrong'
      : 'Match ends → auto-log saves · confirm MMR on the card · tap tags · undo if wrong';
  }

  if (isVal) populateValSelects();
}

function renderDockModePills(gameId) {
  const wrapId = gameId === GAME_IDS.VALORANT ? 'quick-mode-pills-val' : 'quick-mode-pills-rl';
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;

  const playlists = getPlaylists(gameId).filter(p => p.mode);
  const activeMode = getLastModeForGame(gameId);
  wrap.innerHTML = playlists.map(p => `
    <button type="button" data-mode="${p.mode}" class="${p.mode === activeMode ? 'active' : ''}">${p.label}</button>
  `).join('');
}

function updateDockStatLabels(gameId) {
  const section = document.querySelector(`[data-dock-game="${gameId}"]`);
  if (!section) return;
  const labels = gameId === GAME_IDS.VALORANT ? ['K', 'D', 'A'] : ['G', 'A', 'S'];
  section.querySelectorAll('.quick-advanced-stats .qs-label').forEach((el, i) => {
    if (labels[i]) el.textContent = labels[i];
  });
}

function populateValSelects() {
  const agentSel = document.getElementById('quick-agent');
  const mapSel = document.getElementById('quick-map');
  const agents = getAgents(GAME_IDS.VALORANT);
  const maps = getMaps(GAME_IDS.VALORANT);

  if (agentSel) {
    const current = agentSel.value;
    agentSel.innerHTML = '<option value="">Agent</option>';
    agents.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      agentSel.appendChild(opt);
    });
    if (current && agents.includes(current)) agentSel.value = current;
  }

  if (mapSel) {
    const current = mapSel.value;
    mapSel.innerHTML = '<option value="">Map</option>';
    maps.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      mapSel.appendChild(opt);
    });
    if (current && maps.includes(current)) mapSel.value = current;
  }
}

export function getDockTagsEl(gameId = state.activeGame) {
  return document.getElementById(gameId === GAME_IDS.VALORANT ? 'quick-tags-val' : 'quick-tags-rl');
}

export function getDockModePillsEl(gameId = state.activeGame) {
  return document.getElementById(gameId === GAME_IDS.VALORANT ? 'quick-mode-pills-val' : 'quick-mode-pills-rl');
}
