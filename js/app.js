/**
 * RL Grind Tracker — auth-first personal dashboard
 */

import { isGrindHost, isGlanceMode, applyAppMode } from './env.js';
import { state, subscribe, setGames, setSyncStatus, setGoals, setProfile, getUserDisplay } from './state.js';
import { initAuth, signInWithGoogle, signOut, onAuthChange, getAuthUser } from './auth.js';
import { loadUserData, saveSettings, claimLegacyData, createGroup, joinGroup, leaveGroup, loadUserGroups } from './supabase.js';
import { applyFilters, DEFAULT_FILTERS } from './filters.js';
import { calcStats } from './utils.js';
import { addGame, updateGame, deleteGame, getLastMMR, patchLastGame, undoLastGame } from './matches.js';
import { startSession, endSession, closeSessionModal, closeSessionModalAndContinue, initSessionUI, refreshSessionUI, restoreSessionFromStorage, getLoggingSessionNum } from './sessions.js';
import {
  initQuickLog, showQuickDock, hideQuickDock, getQuickLogPayload,
  resetQuickAfterLog, loadPrefs, syncFormFromQuick, applyLiveStats, flashAutoLogged,
  setQuickResult, setQuickMode,
} from './quicklog.js';
import { initRlLive, stopRlLive, refreshLiveStatus } from './rl-live.js';
import { renderSetupWizard, refreshSetupWizard, onBridgeStatusChange } from './setup-wizard.js';
import { mmrChart, wlChart, sessionChart } from './charts.js';
import { renderAnalytics } from './analytics.js';
import { renderReportsPage } from './reports-ui.js';
import { renderFocusPage } from './focus.js';
import { initPostMatch, showPostMatchCard } from './post-match.js';
import { renderGroupsPage, resetGroupsUI } from './groups.js';
import { renderSessionsPage } from './sessions-ui.js';
import { exportGamesCSV } from './export.js';
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

function getDashboardGames() {
  return applyFilters(state.games, { ...DEFAULT_FILTERS, playlist: state.playlist ?? 'all' });
}

function getMatchLogsGames() {
  return applyFilters(state.games, { ...state.filters, playlist: 'all' });
}

function getAnalyticsGames() {
  return applyFilters(state.games, { ...state.filters, playlist: state.playlist ?? 'all' });
}

function getFilteredGames() {
  return getDashboardGames();
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
    applyAppMode();
    applyLogPrefs();

    if (isGrindHost()) {
      showQuickDock();
      restoreSessionFromStorage(games);
      renderSetupWizard(getDisplay().name);
      initRlLive(applyLiveStats, onBridgeStatusChange, handleAutoLog);
    } else {
      hideQuickDock();
      document.getElementById('setup-wizard')?.replaceChildren();
      document.getElementById('setup-wizard')?.classList.add('hidden');
    }

    renderAll();
    showLoading(false);
  } catch (e) {
    console.error(e);
    setSyncStatus('error');
    showLoading(false);
    showLoginScreen(false);
    const msg = e?.message ?? 'Could not load your data';
    showToast(msg.includes('infinite recursion') ? 'Database policy error — run groups-schema-fix.sql in Supabase' : msg, 'error');
  }
}

function showLoggedOut() {
  showLoading(false);
  showLoginScreen(true);
  wireGoogleSignIn();
  const btn = document.getElementById('google-signin-btn');
  if (btn) btn.disabled = false;
}

async function handleGoogleSignIn() {
  const btn = document.getElementById('google-signin-btn');
  if (btn) btn.disabled = true;
  try {
    await signInWithGoogle();
  } catch (e) {
    console.error(e);
    showToast(e?.message || 'Sign in failed', 'error');
    if (btn) btn.disabled = false;
  }
}

function getGroupsCtx() {
  return {
    groups: state.groups,
    userId: getAuthUser()?.id,
    onCreate: createGroup,
    onJoin: joinGroup,
    onLeave: leaveGroup,
    onRefresh: refreshGroupsPage,
  };
}

async function refreshGroupsPage() {
  state.groups = await loadUserGroups();
  await renderGroupsPage(getGroupsCtx());
}

async function handleSignOut() {
  await signOut();
  state.games = [];
  state.profile = null;
  state.groups = [];
  resetGroupsUI();
  hideQuickDock();
  stopRlLive();
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

  renderStats('dash-stats', stats, state.playlist);
  mmrChart('dashMMR', filtered, display.color);
  wlChart('dashWL', stats);
  sessionChart('dashSession', filtered, display.color);
  renderLog('dash-log', getDashboardGames(), 10, false);

  renderMatchLogs();

  renderLog('log-preview', games, 6, false);
  const lastMMR = getLastMMR();
  if (lastMMR !== '') document.getElementById('f-startmmr').value = lastMMR;

  renderFilterBar('analytics-filters', games, state.filters, filters => {
    state.filters = { ...state.filters, ...filters };
    renderAnalytics(getAnalyticsGames());
    renderMatchLogs();
  });
  renderAnalytics(getAnalyticsGames());

  renderReportsPageContent();
  renderFocusPage(games, state.goals, display);
  renderGroupsPage(getGroupsCtx());
  renderSessionsPageContent();

  refreshSessionUI();
  wireLogTableActions();
}

function renderDashboard() {
  const filtered = getDashboardGames();
  const stats = calcStats(filtered);
  const display = getDisplay();
  renderStats('dash-stats', stats, state.playlist);
  mmrChart('dashMMR', filtered, display.color);
  wlChart('dashWL', stats);
  sessionChart('dashSession', filtered, display.color);
  renderLog('dash-log', filtered, 10, false);
}

function renderMatchLogs() {
  renderFilterBar('matchlogs-filters', state.games, state.filters, filters => {
    state.filters = { ...state.filters, ...filters };
    renderMatchLogs();
    renderAnalytics(getAnalyticsGames());
  });
  renderLog('matchlogs-log', getMatchLogsGames(), 0, isGrindHost());
  wireLogTableActions();
}

function renderSessionsPageContent() {
  renderSessionsPage(state.games, getDisplay().name, {
    onViewSession: sessionNum => {
      state.filters = { ...state.filters, session: String(sessionNum) };
      navigate('matchlogs', document.querySelector('.tab[data-page="matchlogs"]'));
    },
  });
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
  if (pageId === 'log' && isGlanceMode()) {
    showToast('Log games on localhost — run start-grind.bat', 'error');
    pageId = 'dashboard';
    btn = document.querySelector('.tab[data-page="dashboard"]');
  }
  state.activePage = pageId;
  showPage(pageId, btn);
  document.querySelectorAll('.mobile-nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === pageId);
  });
  if (pageId === 'dashboard') renderDashboard();
  if (pageId === 'matchlogs') renderMatchLogs();
  if (pageId === 'analytics') renderAnalytics(getAnalyticsGames());
  if (pageId === 'reports') renderReportsPageContent();
  if (pageId === 'focus') renderFocusPage(state.games, state.goals, getDisplay());
  if (pageId === 'group') renderGroupsPage(getGroupsCtx());
  if (pageId === 'sessions') renderSessionsPageContent();
  if (pageId === 'log' && isGrindHost()) refreshSetupWizard(getDisplay().name);
}

function wireNavigation() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const page = tab.dataset.page;
      if (page) navigate(page, tab);
    });
  });
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      const tab = document.querySelector(`.tab[data-page="${page}"]`);
      if (page) navigate(page, tab);
    });
  });
}

function applyLogPrefs() {
  const prefs = loadPrefs();
  const fMode = document.getElementById('f-mode');
  if (fMode && prefs.lastMode) fMode.value = prefs.lastMode;
}

function estimateMMRDelta(result) {
  const recent = state.games.slice(-15).filter(g => g.result === result && g.mmrDiff);
  if (recent.length >= 2) {
    return Math.round(recent.reduce((s, g) => s + g.mmrDiff, 0) / recent.length);
  }
  return result === 'W' ? 10 : -10;
}

async function handleAutoLog(match) {
  if (!isGrindHost()) return false;

  if (match.mode) setQuickMode(match.mode);
  if (match.result) setQuickResult(match.result);
  applyLiveStats(match);

  const startRaw = getLastMMR() || document.getElementById('f-startmmr')?.value || '';
  const startMMR = parseInt(startRaw, 10);
  if (!startRaw || Number.isNaN(startMMR)) {
    showToast('Type your MMR in the bar once — then auto-log takes over', 'error');
    document.getElementById('quick-endmmr')?.focus();
    return false;
  }

  const delta = estimateMMRDelta(match.result);
  const endMMR = Math.max(0, startMMR + delta);

  const fStart = document.getElementById('f-startmmr');
  const qEnd = document.getElementById('quick-endmmr');
  if (fStart) fStart.value = startMMR;
  if (qEnd) qEnd.value = endMMR;

  state.ui.autoLogNote = [
    !recentGamesHaveMMR() ? 'MMR estimated' : '',
    match.playlist ? (match.isRanked ? `Ranked · ${match.playlist}` : match.playlist) : '',
  ].filter(Boolean).join(' · ');

  if (!state.session.active) startSession();

  const ok = await submitGameLog('auto');
  if (!ok) return false;

  flashAutoLogged();
  refreshLiveStatus();
  return true;
}

function recentGamesHaveMMR() {
  return state.games.slice(-3).some(g => g.endMMR);
}

async function submitGameLog(source = 'form') {
  if (source === 'quick' || source === 'auto') {
    syncFormFromQuick();
    if (!state.session.active) startSession();
  }

  const endMMR = source === 'quick' || source === 'auto'
    ? document.getElementById('quick-endmmr')?.value
    : document.getElementById('f-endmmr')?.value;

  if (!endMMR) {
    showToast('Enter end MMR', 'error');
    document.getElementById(source === 'quick' || source === 'auto' ? 'quick-endmmr' : 'f-endmmr')?.focus();
    return false;
  }

  const btn = source === 'quick' || source === 'auto'
    ? document.getElementById('quick-log-btn')
    : document.getElementById('add-btn');

  if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = '…'; }

  try {
    const payload = source === 'quick' || source === 'auto' ? getQuickLogPayload() : {
      date: document.getElementById('f-date').value,
      session: getLoggingSessionNum(),
      mode: document.getElementById('f-mode').value,
      result: state.ui.currentResult,
      goals: document.getElementById('f-goals').value,
      assists: document.getElementById('f-assists').value,
      saves: document.getElementById('f-saves').value,
      startMMR: document.getElementById('f-startmmr').value,
      endMMR: document.getElementById('f-endmmr').value,
      notes: document.getElementById('f-notes').value,
    };

    const game = await addGame({
      ...payload,
      notes: [payload.notes, state.ui.autoLogNote].filter(Boolean).join(' · ') || payload.notes,
    }, state.ui.selectedTags, () => {
      document.getElementById('f-goals').value = 0;
      document.getElementById('f-assists').value = 0;
      document.getElementById('f-saves').value = 0;
      document.getElementById('f-startmmr').value = getLastMMR();
      document.getElementById('f-endmmr').value = '';
      document.getElementById('f-notes').value = '';
      document.querySelectorAll('#log-tags .tag-chip.selected').forEach(c => c.classList.remove('selected'));
      state.ui.selectedTags = [];
      state.ui.autoLogNote = '';
      resetQuickAfterLog();
    });
    renderAll();
    if (isGrindHost() && game) {
      showPostMatchCard(game, { estimated: (game.notes || '').includes('MMR estimated') });
    }
    return true;
  } catch {
    showToast('Failed to save', 'error');
    return false;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.dataset.label || (source === 'quick' || source === 'auto' ? 'LOG' : '+ Log Game');
    }
  }
}

function wireLogForm() {
  renderTagChips('log-tags', state.ui.selectedTags, (tag, selected) => {
    if (selected) state.ui.selectedTags.push(tag);
    else state.ui.selectedTags = state.ui.selectedTags.filter(t => t !== tag);
  });
  document.getElementById('wl-win')?.addEventListener('click', () => setResult('W'));
  document.getElementById('wl-loss')?.addEventListener('click', () => setResult('L'));
  document.getElementById('add-btn')?.addEventListener('click', () => submitGameLog('form'));
}

function setResult(r) {
  state.ui.currentResult = r;
  document.getElementById('wl-win').className = 'wl-btn win' + (r === 'W' ? ' active' : '');
  document.getElementById('wl-loss').className = 'wl-btn loss' + (r === 'L' ? ' active' : '');
  document.getElementById('quick-wl-win')?.classList.toggle('active', r === 'W');
  document.getElementById('quick-wl-loss')?.classList.toggle('active', r === 'L');
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

function wireGoogleSignIn() {
  const btn = document.getElementById('google-signin-btn');
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = '1';
  btn.addEventListener('click', handleGoogleSignIn);
}

async function init() {
  applyAppMode();
  wireGoogleSignIn();
  showLoggedOut();

  const dateEl = document.getElementById('f-date');
  if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);

  subscribe(() => setSyncUI(state.syncStatus));
  setSyncUI(state.syncStatus);

  wireNavigation();
  document.getElementById('dash-view-all-logs')?.addEventListener('click', () => {
    navigate('matchlogs', document.querySelector('.tab[data-page="matchlogs"]'));
  });
  document.getElementById('matchlogs-export-btn')?.addEventListener('click', () => {
    exportGamesCSV(getMatchLogsGames(), getDisplay().name);
    showToast('CSV downloaded');
  });
  wireLogForm();
  wireEditModal();
  initSessionUI();
  initQuickLog({
    submitQuick: () => submitGameLog('quick'),
    getLastMMR,
    setFormResult: setResult,
    setSelectedTags: tags => { state.ui.selectedTags = tags; },
    onAutoLogToggle: refreshLiveStatus,
  });
  if (isGrindHost()) {
    initPostMatch({
      onConfirmMMR: async (mmr) => {
        const game = await patchLastGame({ endMMR: mmr });
        if (game) { renderAll(); return true; }
        return false;
      },
      onTags: async (tags) => {
        await patchLastGame({ tags });
        renderAll();
        return true;
      },
      onUndo: async () => {
        const ok = await undoLastGame(true);
        if (ok) renderAll();
        return ok;
      },
      onOpen: () => refreshSessionUI(),
      onClose: () => refreshSessionUI(),
    });
  }
  onAuthChange(async (session) => {
    if (session) await bootApp();
    else showLoggedOut();
  });

  try {
    await initAuth();
    if (!getAuthUser()) showLoggedOut();
  } catch (e) {
    console.error(e);
    showLoggedOut();
    showToast('Auth setup error — try signing in again', 'error');
  }
}

init();
