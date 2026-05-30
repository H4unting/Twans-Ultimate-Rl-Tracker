/**
 * RL Grind Tracker — auth-first personal dashboard
 */

import { state, subscribe, setGames, setSyncStatus, setGoals, setProfile, getUserDisplay } from './state.js';
import { initAuth, signInWithGoogle, signOut, onAuthChange, getAuthUser } from './auth.js';
import { loadUserData, saveSettings, claimLegacyData } from './supabase.js';
import { applyFilters, DEFAULT_FILTERS } from './filters.js';
import { calcStats } from './utils.js';
import { addGame, updateGame, deleteGame, getLastMMR } from './matches.js';
import { startSession, endSession, closeSessionModal, closeSessionModalAndContinue, initSessionUI, refreshSessionUI } from './sessions.js';
import { mmrChart, wlChart, sessionChart } from './charts.js';
import { renderAnalytics } from './analytics.js';
import { renderReportsPage } from './reports-ui.js';
import { renderFocusPage } from './focus.js';
import { renderGroupsPage } from './groups.js';
import {
  showToast, setSyncUI, renderStats, renderLog, renderPlaylistTabs, renderFilterBar,
  showPage, renderTagChips, showLoading, showLoginScreen, renderAuthBar,
  renderWelcomeHeader, renderLegacyImportBanner, renderGoalProgress,
} from './ui.js';

window.__endSession = () => endSession();
window.showPage = (id, btn) => navigate(id, btn);
window.startNextSession = () => closeSessionModalAndContinue();
window.goToDashboardFromSession = () => {
  closeSessionModal();
  navigate('dashboard', document.querySelector('.tab[data-page="dashboard"]'));
};

function getFilteredGames() {
  const playlist = state.playlist ?? 'all';
  return applyFilters(state.games, { ...state.filters, playlist });
}

function getDisplay() {
  return getUserDisplay(getAuthUser());
}

async function bootApp() {
  showLoginScreen(false);
  showLoading(true);

  try {
    const { profile, games, goals, groups } = await loadUserData();
    setProfile(profile);
    setGames(games);
    setGoals(goals);
    state.groups = groups;
    state.filters = { ...DEFAULT_FILTERS };

    renderAuthBar(getDisplay(), handleSignOut);
    renderAll();
    showLoading(false);
  } catch (e) {
    console.error(e);
    setSyncStatus('error');
    showLoading(false);
    showToast('Could not load your data', 'error');
  }
}

function showLoggedOut() {
  showLoading(false);
  showLoginScreen(true);
  const btn = document.getElementById('google-signin-btn');
  if (btn) btn.onclick = handleGoogleSignIn;
}

async function handleGoogleSignIn() {
  try {
    await signInWithGoogle();
  } catch {
    showToast('Sign in failed', 'error');
  }
}

async function handleSignOut() {
  await signOut();
  state.games = [];
  state.profile = null;
  showLoginScreen(true);
}

async function handleLegacyClaim(legacyId) {
  try {
    showLoading(true);
    const games = await claimLegacyData(legacyId);
    setGames(games);
    const profile = { ...state.profile, legacy_claimed: legacyId };
    setProfile(profile);
    renderAll();
    showLoading(false);
    showToast('Stats imported!');
  } catch (e) {
    showLoading(false);
    showToast(e.message || 'Import failed', 'error');
  }
}

function renderAll() {
  const games = state.games;
  const filtered = getFilteredGames();
  const stats = calcStats(filtered);
  const display = getDisplay();

  renderWelcomeHeader(display, stats);
  renderLegacyImportBanner(state.profile, handleLegacyClaim);
  renderGoalProgress('dash-goals', games, state.goals);

  renderPlaylistTabs('pl-tabs', state.playlist, (pl, btn) => {
    state.playlist = pl;
    document.querySelectorAll('#pl-tabs .pl-tab').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
    renderDashboard();
  });

  renderFilterBar('dash-filters', games, { ...state.filters, playlist: state.playlist }, filters => {
    state.filters = { ...state.filters, ...filters };
    renderDashboard();
  });

  renderStats('dash-stats', stats, state.playlist);
  mmrChart('dashMMR', filtered, display.color);
  wlChart('dashWL', stats);
  sessionChart('dashSession', filtered, display.color);
  renderLog('dash-log', applyFilters(games, state.filters), 0, true);

  renderLog('log-preview', games, 6, false);
  const lastMMR = getLastMMR();
  if (lastMMR !== '') document.getElementById('f-startmmr').value = lastMMR;

  renderFilterBar('analytics-filters', games, state.filters, filters => {
    state.filters = { ...state.filters, ...filters };
    renderAnalytics(getFilteredGames());
  });
  renderAnalytics(getFilteredGames());

  renderReportsPageContent();
  renderFocusPage(games, state.goals, display);
  renderGroupsPage(state.groups);

  refreshSessionUI();
  wireLogTableActions();
}

function renderDashboard() {
  const filtered = getFilteredGames();
  const stats = calcStats(filtered);
  const display = getDisplay();
  renderStats('dash-stats', stats, state.playlist);
  mmrChart('dashMMR', filtered, display.color);
  wlChart('dashWL', stats);
  sessionChart('dashSession', filtered, display.color);
  renderLog('dash-log', applyFilters(state.games, state.filters), 0, true);
}

function renderReportsPageContent() {
  renderReportsPage(
    state.games,
    state.goals,
    getDisplay().name,
    state.reportsWeekOffset,
    offset => { state.reportsWeekOffset = offset; renderReportsPageContent(); },
    async nextGoals => {
      setGoals(nextGoals);
      await saveSettings({ goals: nextGoals });
      renderGoalProgress('dash-goals', state.games, state.goals);
      renderFocusPage(state.games, state.goals, getDisplay());
      showToast('Goals saved!');
    },
  );
}

function navigate(pageId, btn) {
  state.activePage = pageId;
  showPage(pageId, btn);
  if (pageId === 'dashboard') renderDashboard();
  if (pageId === 'analytics') renderAnalytics(getFilteredGames());
  if (pageId === 'reports') renderReportsPageContent();
  if (pageId === 'focus') renderFocusPage(state.games, state.goals, getDisplay());
  if (pageId === 'group') renderGroupsPage(state.groups);
  if (pageId === 'log') refreshSessionUI();
}

function wireNavigation() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const page = tab.dataset.page;
      if (page) navigate(page, tab);
    });
  });
}

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
      document.getElementById('f-startmmr').value = getLastMMR();
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

function openEditModal(matchNum) {
  const game = state.games.find(g => g.match === matchNum);
  if (!game) return;
  state.ui.editingMatch = matchNum;
  state.ui.editTags = [...(game.tags || [])];
  document.getElementById('edit-modal-sub').textContent = `Match #${matchNum}`;
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
  state.ui.editingMatch = null;
}

async function handleSaveEdit() {
  const matchNum = state.ui.editingMatch;
  if (!matchNum) return;
  const btn = document.getElementById('save-edit-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  try {
    await updateGame(matchNum, {
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
    }, state.ui.editTags);
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
    btn.onclick = () => openEditModal(parseInt(btn.dataset.match, 10));
  });
  document.querySelectorAll('.action-btn.del').forEach(btn => {
    btn.onclick = async () => {
      const ok = await deleteGame(parseInt(btn.dataset.match, 10));
      if (ok) renderAll();
    };
  });
}

async function init() {
  document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);
  subscribe(() => setSyncUI(state.syncStatus));
  setSyncUI(state.syncStatus);

  wireNavigation();
  wireLogForm();
  wireEditModal();
  initSessionUI();

  onAuthChange(async (session) => {
    if (session) await bootApp();
    else showLoggedOut();
  });

  await initAuth();
  if (!getAuthUser()) showLoggedOut();
}

init();
