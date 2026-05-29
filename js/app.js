/**
 * RL Grind Tracker — main entry point
 * Orchestrates modules; keeps wiring logic here, business logic in feature modules.
 */

import { PLAYERS, getPlayerMeta } from './config.js';
import { state, subscribe, setData, setSyncStatus, setGoals } from './state.js';
import { loadData, loadSettings, saveSettings } from './supabase.js';
import { applyFilters, DEFAULT_FILTERS } from './filters.js';
import { calcStats } from './utils.js';
import { addGame, updateGame, deleteGame, getLastMMR } from './matches.js';
import { startSession, endSession, closeSessionModal, closeSessionModalAndContinue, initSessionUI, refreshSessionUI } from './sessions.js';
import { mmrChart, wlChart, sessionChart, teamChart } from './charts.js';
import { renderAnalytics } from './analytics.js';
import { renderReportsPage } from './reports-ui.js';
import { renderCoachingPage } from './coaching.js';
import { loadGoalsLocal } from './goals.js';
import {
  showToast, setSyncUI, renderStats, renderLog, renderTeamGrid,
  renderPlaylistTabs, renderFilterBar, showPage, setPlayerSelector,
  renderTagChips, showLoading,
} from './ui.js';

// ── Global handlers for inline HTML onclick fallbacks ─────────────────────────
window.__endSession = () => endSession();
window.showPage = (id, btn) => navigate(id, btn);
window.startNextSession = () => closeSessionModalAndContinue();
window.goToDashboardFromSession = () => {
  closeSessionModal();
  navigate('dashboard', document.querySelector('.tab[data-page="dashboard"]'));
};

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  showLoading(true);
  document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);

  subscribe(() => setSyncUI(state.syncStatus));
  setSyncUI(state.syncStatus);

  wireNavigation();
  wireLogForm();
  wireEditModal();
  wirePlayerSelectors();
  initSessionUI();

  try {
    const [data, settings] = await Promise.all([loadData(), loadSettings()]);
    setData(data);
    setGoals(settings.goals ?? loadGoalsLocal());
    renderAll();
    showLoading(false);
  } catch (e) {
    setSyncStatus('error');
    showLoading(false);
    document.getElementById('team-grid').innerHTML =
      '<div class="empty" style="color:#ff4444">Could not connect to Supabase.</div>';
    showToast('Connection failed', 'error');
  }
}

// ── Render pipeline ───────────────────────────────────────────────────────────

function getPlayerGames(playerId) {
  const all = state.data[playerId] ?? [];
  const playlist = state.playerPlaylist[playerId] ?? 'all';
  const filtered = applyFilters(all, { ...state.filters, playlist });
  return { all, filtered, playlist };
}

function renderAll() {
  renderTeamGrid(state.data, state.goals);
  teamChart(state.data.anthony ?? [], state.data.trystan ?? []);

  PLAYERS.forEach(p => {
    const { all, filtered, playlist } = getPlayerGames(p.id);
    const stats = calcStats(filtered);
    renderStats(`${p.id}-stats`, stats, playlist);
    renderLog(`${p.id}-log`, applyFilters(all, state.filters), 0, p.id);
    renderFilterBar(`${p.id}-filters`, all, { ...state.filters, playlist }, filters => {
      state.filters = { ...state.filters, ...filters };
      renderPlayerPage(p.id);
    });
    renderPlaylistTabs(p.id, playlist, (pl, btn) => setPlaylist(p.id, pl, btn));
    mmrChart(`${p.id}MMR`, filtered, p.color);
    wlChart(`${p.id}WL`, stats);
    sessionChart(`${p.id}Session`, filtered, p.color);
  });

  renderLog('log-preview', state.data[state.logPlayer] ?? [], 6, null);
  const lastMMR = getLastMMR(state.logPlayer);
  if (lastMMR !== '') document.getElementById('f-startmmr').value = lastMMR;

  renderAnalytics(getAnalyticsGames());
  const all = state.data[state.analyticsPlayer] ?? [];
  renderFilterBar('analytics-filters', all, state.filters, filters => {
    state.filters = { ...state.filters, ...filters };
    renderAnalytics(getAnalyticsGames());
  });
  refreshSessionUI();
  wireLogTableActions();
  renderReportsPageContent();
  renderCoachingPage(state.data, state.goals);
}

function renderReportsPageContent() {
  renderReportsPage(
    state.data,
    state.goals,
    state.reportsWeekOffset,
    offset => {
      state.reportsWeekOffset = offset;
      renderReportsPageContent();
    },
    async nextGoals => {
      setGoals(nextGoals);
      await saveSettings({ goals: nextGoals });
      renderTeamGrid(state.data, state.goals);
      renderCoachingPage(state.data, state.goals);
      showToast('Goals saved!');
    },
  );
}

function renderPlayerPage(playerId) {
  const { all, filtered, playlist } = getPlayerGames(playerId);
  const stats = calcStats(filtered);
  const meta = getPlayerMeta(playerId);
  renderStats(`${playerId}-stats`, stats, playlist);
  renderLog(`${playerId}-log`, applyFilters(all, state.filters), 0, playerId);
  mmrChart(`${playerId}MMR`, filtered, meta.color);
  wlChart(`${playerId}WL`, stats);
  sessionChart(`${playerId}Session`, filtered, meta.color);
  wireLogTableActions();
}

function getAnalyticsGames() {
  const all = state.data[state.analyticsPlayer] ?? [];
  return applyFilters(all, state.filters);
}

function setPlaylist(playerId, playlist, btn) {
  state.playerPlaylist[playerId] = playlist;
  document.querySelectorAll(`#${playerId}-pl-tabs .pl-tab`).forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
  renderPlayerPage(playerId);
}

// ── Navigation ────────────────────────────────────────────────────────────────

function navigate(pageId, btn) {
  state.activePage = pageId;
  showPage(pageId, btn);
  if (pageId === 'dashboard') teamChart(state.data.anthony ?? [], state.data.trystan ?? []);
  if (pageId === 'analytics') renderAnalytics(getAnalyticsGames());
  if (pageId === 'reports') renderReportsPageContent();
  if (pageId === 'coach') renderCoachingPage(state.data, state.goals);
  if (pageId === 'log') refreshSessionUI();
  PLAYERS.forEach(p => {
    if (pageId === p.id) renderPlayerPage(p.id);
  });
}

function wireNavigation() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const page = tab.dataset.page;
      if (page) navigate(page, tab);
    });
  });
}

// ── Log form ──────────────────────────────────────────────────────────────────

function wireLogForm() {
  renderTagChips('log-tags', state.ui.selectedTags, (tag, selected) => {
    if (selected) state.ui.selectedTags.push(tag);
    else state.ui.selectedTags = state.ui.selectedTags.filter(t => t !== tag);
  });

  document.getElementById('wl-win')?.addEventListener('click', () => setResult('W'));
  document.getElementById('wl-loss')?.addEventListener('click', () => setResult('L'));
  document.getElementById('add-btn')?.addEventListener('click', handleAddGame);
}

function setResult(r) {
  state.ui.currentResult = r;
  document.getElementById('wl-win').className = 'wl-btn win' + (r === 'W' ? ' active' : '');
  document.getElementById('wl-loss').className = 'wl-btn loss' + (r === 'L' ? ' active' : '');
}

async function handleAddGame() {
  const btn = document.getElementById('add-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  try {
    await addGame({
      date: document.getElementById('f-date').value,
      session: document.getElementById('f-session').value,
      mode: document.getElementById('f-mode').value,
      result: state.ui.currentResult,
      goals: document.getElementById('f-goals').value,
      assists: document.getElementById('f-assists').value,
      saves: document.getElementById('f-saves').value,
      startMMR: document.getElementById('f-startmmr').value,
      endMMR: document.getElementById('f-endmmr').value,
      notes: document.getElementById('f-notes').value,
    }, state.ui.selectedTags, () => {
      document.getElementById('f-goals').value = 0;
      document.getElementById('f-assists').value = 0;
      document.getElementById('f-saves').value = 0;
      document.getElementById('f-startmmr').value = getLastMMR(state.logPlayer);
      document.getElementById('f-endmmr').value = '';
      document.getElementById('f-notes').value = '';
      document.querySelectorAll('#log-tags .tag-chip.selected').forEach(c => c.classList.remove('selected'));
      state.ui.selectedTags = [];
      document.getElementById('f-endmmr').focus();
    });
    renderAll();
  } catch {
    showToast('Failed to save', 'error');
  }
  btn.disabled = false;
  btn.textContent = '+ Log Game';
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function wireEditModal() {
  document.getElementById('e-wl-win')?.addEventListener('click', () => setEditResult('W'));
  document.getElementById('e-wl-loss')?.addEventListener('click', () => setEditResult('L'));
  document.getElementById('save-edit-btn')?.addEventListener('click', handleSaveEdit);
  document.getElementById('edit-cancel-btn')?.addEventListener('click', closeEditModal);
}

function setEditResult(r) {
  document.getElementById('e-wl-win').className = 'edit-wl-btn win' + (r === 'W' ? ' active' : '');
  document.getElementById('e-wl-loss').className = 'edit-wl-btn loss' + (r === 'L' ? ' active' : '');
}

function openEditModal(player, matchNum) {
  const game = state.data[player]?.find(g => g.match === matchNum);
  if (!game) return;
  state.ui.editingPlayer = player;
  state.ui.editingMatch = matchNum;
  state.ui.editTags = [...(game.tags || [])];

  document.getElementById('edit-modal-sub').textContent =
    `${getPlayerMeta(player).name} · Match #${matchNum}`;
  const [mm, dd, yy] = game.date.split('/');
  document.getElementById('e-date').value = `20${yy}-${mm}-${dd}`;
  document.getElementById('e-session').value = game.session;
  document.getElementById('e-mode').value = game.mode;
  document.getElementById('e-goals').value = game.goals;
  document.getElementById('e-assists').value = game.assists || 0;
  document.getElementById('e-saves').value = game.saves;
  document.getElementById('e-startmmr').value = game.startMMR;
  document.getElementById('e-endmmr').value = game.endMMR;
  document.getElementById('e-notes').value = game.notes || '';
  setEditResult(game.result);

  renderEditTags();
  document.getElementById('edit-modal').classList.add('open');
}

function renderEditTags() {
  document.querySelectorAll('#edit-tags .tag-chip').forEach(chip => {
    chip.classList.toggle('selected', state.ui.editTags.includes(chip.dataset.tag));
    chip.onclick = () => {
      chip.classList.toggle('selected');
      const tag = chip.dataset.tag;
      if (chip.classList.contains('selected')) {
        if (!state.ui.editTags.includes(tag)) state.ui.editTags.push(tag);
      } else {
        state.ui.editTags = state.ui.editTags.filter(t => t !== tag);
      }
    };
  });
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('open');
  state.ui.editingPlayer = null;
  state.ui.editingMatch = null;
}

async function handleSaveEdit() {
  const { editingPlayer: player, editingMatch: matchNum, editTags } = state.ui;
  if (!player || !matchNum) return;
  const btn = document.getElementById('save-edit-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  try {
    await updateGame(player, matchNum, {
      date: document.getElementById('e-date').value,
      session: document.getElementById('e-session').value,
      mode: document.getElementById('e-mode').value,
      result: document.getElementById('e-wl-win').classList.contains('active') ? 'W' : 'L',
      goals: document.getElementById('e-goals').value,
      assists: document.getElementById('e-assists').value,
      saves: document.getElementById('e-saves').value,
      startMMR: document.getElementById('e-startmmr').value,
      endMMR: document.getElementById('e-endmmr').value,
      notes: document.getElementById('e-notes').value,
    }, editTags);
    closeEditModal();
    renderAll();
  } catch {
    showToast('Save failed', 'error');
  }
  btn.disabled = false;
  btn.textContent = 'Save Changes';
}

function wireLogTableActions() {
  document.querySelectorAll('.action-btn.edit').forEach(btn => {
    btn.onclick = () => openEditModal(btn.dataset.player, parseInt(btn.dataset.match, 10));
  });
  document.querySelectorAll('.action-btn.del').forEach(btn => {
    btn.onclick = async () => {
      const ok = await deleteGame(btn.dataset.player, parseInt(btn.dataset.match, 10));
      if (ok) renderAll();
    };
  });
}

// ── Player selectors ──────────────────────────────────────────────────────────

function wirePlayerSelectors() {
  PLAYERS.forEach(p => {
    document.getElementById(`ps-${p.id}`)?.addEventListener('click', () => selectLogPlayer(p.id));
    document.getElementById(`ap-${p.id}`)?.addEventListener('click', () => selectAnalyticsPlayer(p.id));
  });
}

function selectLogPlayer(id) {
  state.logPlayer = id;
  setPlayerSelector('ps', id);
  renderLog('log-preview', state.data[id] ?? [], 6, null);
  const lastMMR = getLastMMR(id);
  if (lastMMR !== '') document.getElementById('f-startmmr').value = lastMMR;
  refreshSessionUI();
}

function selectAnalyticsPlayer(id) {
  state.analyticsPlayer = id;
  setPlayerSelector('ap', id);
  const all = state.data[id] ?? [];
  renderFilterBar('analytics-filters', all, state.filters, filters => {
    state.filters = { ...state.filters, ...filters };
    renderAnalytics(getAnalyticsGames());
  });
  renderAnalytics(getAnalyticsGames());
}

// Reset filters helper
window.resetAllFilters = () => {
  state.filters = { ...DEFAULT_FILTERS };
  renderAll();
};

init();
