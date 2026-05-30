/**
 * Twans Ultimate Tracker — auth-first personal dashboard
 */

import { applyAppMode } from './env.js';
import { state, subscribe, setGames, setSyncStatus, setGoals, setProfile, getUserDisplay } from './state.js';
import { initAuth, signInWithGoogle, signOut, onAuthChange, getAuthUser } from './auth.js';
import { loadUserData, saveSettings, claimLegacyData, createGroup, joinGroup, leaveGroup, loadUserGroups, saveGames, saveProfile } from './supabase.js';
import { applyFilters, DEFAULT_FILTERS } from './filters.js';
import { calcStats, estimateMMRDelta, repairPlaylistMMRChain } from './utils.js';
import { addGame, updateGame, deleteGame, getLastMMR, patchLastGame, undoLastGame } from './matches.js';
import { startSession, endSession, closeSessionModal, closeSessionModalAndContinue, initSessionUI, refreshSessionUI, restoreSessionFromStorage, getLoggingSessionNum } from './sessions.js';
import {
  initQuickLog, showQuickDock, hideQuickDock, getQuickLogPayload,
  resetQuickAfterLog, loadPrefs, syncFormFromQuick, applyLiveStats, flashAutoLogged,
  setQuickResult, setQuickMode,
} from './quicklog.js';
import { renderProfilePage } from './profile-ui.js';
import {
  initRlLive, stopRlLive, refreshLiveStatus,
  saveRlDisplayName, getRlDisplayName,
} from './rl-live.js';
import { renderSetupWizard, refreshSetupWizard, onBridgeStatusChange, renderLogSetupNudge } from './setup-wizard.js';
import { mmrChart, wlChart } from './charts.js';
import { renderAnalytics } from './analytics.js';
import { renderReportsPage } from './reports-ui.js';
import { renderFocusPage } from './focus.js';
import { initPostMatch, showPostMatchCard } from './post-match.js';
import { renderGroupsPage, resetGroupsUI } from './groups.js';
import { renderSessionsPage } from './sessions-ui.js';
import { exportGamesCSV } from './export.js';
import { wireNavigation as wireSectionNav, updateNavUI, mountDock } from './nav.js';
import { renderHome, getHomeChartGames, getHomeChartModeLabel } from './home.js';
import {
  renderQuickFilters, applyQuickFilter,
  getActiveQuickFilter, getQuickFilterSessionNum,
} from './match-logs-ui.js';
import {
  showToast, setSyncUI, renderStats, renderLog, renderPlaylistTabs, renderFilterBar,
  showPage, renderTagChips, showLoading, showLoginScreen, renderAuthBar,
  renderLegacyImportBanner,
} from './ui.js';

window.__endSession = () => endSession();
window.__refreshHome = () => renderHomePage();
window.__navigate = (pageId, section) => navigate(pageId, section);
window.showPage = (id) => navigate(id);
window.startNextSession = () => closeSessionModalAndContinue();
window.goToDashboardFromSession = () => {
  closeSessionModal();
  navigate('dashboard');
};

function getDashboardGames() {
  return applyFilters(state.games, { ...DEFAULT_FILTERS, playlist: state.playlist ?? 'all' });
}

function getMatchLogsGames() {
  return applyFilters(state.games, { ...state.matchLogFilters, playlist: 'all' });
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
    const { profile, games, goals, groups, bio, rlDisplayName } = await loadUserData();
    setProfile(profile);
    const { games: repaired, changed } = repairPlaylistMMRChain(games);
    if (changed) await saveGames(repaired);
    setGames(repaired);
    setGoals(goals);
    state.profileBio = bio ?? '';
    state.groups = groups;
    if (rlDisplayName && !loadPrefs().rlDisplayName) {
      saveRlDisplayName(rlDisplayName);
      savePrefs({ rlDisplayName });
    }
    state.filters = { ...DEFAULT_FILTERS };
    state.matchLogFilters = { ...DEFAULT_FILTERS };
    state.activePage = 'dashboard';

    renderAuthBar(getDisplay(), handleSignOut, () => navigate('profile', 'home'));
    applyAppMode();
    applyLogPrefs();

    showQuickDock();
    restoreSessionFromStorage(games);
    renderSetupWizard(getDisplay().name);
    renderLogSetupNudge();
    initRlLive(applyLiveStats, onBridgeStatusChange, handleAutoLog);

    renderAll();
    showLoading(false);
  } catch (e) {
    console.error(e);
    setSyncStatus('error');
    showLoading(false);
    showLoginScreen(true);
    const msg = e?.message ?? 'Could not load your data';
    showToast(
      msg.includes('infinite recursion') ? 'Database policy error — run groups-schema-fix.sql in Supabase' : msg,
      'error',
    );
  }
}

function showLoggedOut() {
  showLoading(false);
  showLoginScreen(true);
  hideQuickDock();
  stopRlLive();
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
  state.profileBio = '';
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

function renderHomePage() {
  renderHome(state.games, state.goals);
  const modeGames = getHomeChartGames(state.games);
  const label = document.getElementById('home-charts-label');
  if (label) {
    label.textContent = modeGames.length
      ? `${getHomeChartModeLabel(state.games)} — tap a row above to switch`
      : '';
  }
  if (modeGames.length >= 1) {
    const stats = calcStats(modeGames);
    const display = getDisplay();
    mmrChart('homeMMR', modeGames.slice(-20), display.color);
    wlChart('homeWL', stats);
  }
}

function renderAnalyticsPage() {
  const filtered = getAnalyticsGames();
  const stats = calcStats(filtered);
  const display = getDisplay();
  renderStats('analytics-stats', stats, state.playlist);
  mmrChart('dashMMR', filtered, display.color);
  wlChart('dashWL', stats);
  renderAnalytics(filtered);
}

function renderAll() {
  const games = state.games;
  const display = getDisplay();

  renderLegacyImportBanner(state.profile, handleLegacyClaim);
  renderHomePage();

  renderPlaylistTabs('pl-tabs', state.playlist, (pl, btn) => {
    state.playlist = pl;
    document.querySelectorAll('#pl-tabs .pl-tab').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
    renderAnalyticsPage();
  });

  renderMatchLogs();

  const logMode = document.getElementById('f-mode')?.value || loadPrefs().lastMode || "2's";
  const lastMMR = getLastMMR(logMode);
  const fStart = document.getElementById('f-startmmr');
  if (fStart) fStart.value = lastMMR !== '' ? lastMMR : '';

  renderFilterBar('analytics-filters', games, state.filters, filters => {
    state.filters = { ...state.filters, ...filters };
    renderAnalyticsPage();
  });
  renderAnalyticsPage();

  renderReportsPageContent();
  renderFocusPage(games, state.goals, display);
  renderGroupsPage(getGroupsCtx());
  renderSessionsPageContent();

  refreshSessionUI();
  wireLogTableActions();
  updateNavUI(state.activePage || 'dashboard');
  mountDock();
}

function renderDashboard() {
  renderHomePage();
}

function renderMatchLogs() {
  renderLogSetupNudge();
  renderQuickFilters('matchlogs-quick-filters', () => renderMatchLogs());
  renderFilterBar('matchlogs-filters', state.games, state.matchLogFilters, filters => {
    state.matchLogFilters = { ...state.matchLogFilters, ...filters };
    renderMatchLogs();
  });
  let games = getMatchLogsGames();
  const qf = getActiveQuickFilter();
  if (qf !== 'all') {
    games = applyQuickFilter(games, qf, getQuickFilterSessionNum());
  }
  renderLog('log-history-table', games, null, true);
  wireLogTableActions();
}

function renderSessionsPageContent() {
  renderSessionsPage(state.games, getDisplay().name, {
    onViewSession: sessionNum => {
      state.matchLogFilters = { ...state.matchLogFilters, session: String(sessionNum) };
      navigate('log', 'home');
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
      await saveSettings(getSettingsPayload({ goals: nextGoals }));
      renderHomePage();
      renderFocusPage(state.games, state.goals, getDisplay());
      showToast('Goals saved!');
    },
  );
}

function renderProfilePageContent() {
  renderProfilePage({
    games: state.games,
    profile: state.profile,
    display: getDisplay(),
    authUser: getAuthUser(),
    bio: state.profileBio ?? '',
    onSave: handleProfileSave,
  });
}

function getSettingsPayload(overrides = {}) {
  return {
    goals: state.goals,
    bio: state.profileBio ?? '',
    rlDisplayName: getRlDisplayName() || loadPrefs().rlDisplayName || '',
    ...overrides,
  };
}

async function handleProfileSave({ displayName, rlName, accentColor, bio }) {
  await saveProfile({
    display_name: displayName,
    accent_color: accentColor,
  });
  setProfile({
    ...state.profile,
    display_name: displayName,
    accent_color: accentColor,
  });
  state.profileBio = bio;
  await saveSettings(getSettingsPayload({ bio, rlDisplayName: rlName }));
  renderAuthBar(getDisplay(), handleSignOut, () => navigate('profile', 'home'));
  renderProfilePageContent();
}

function navigate(pageId, section) {
  state.activePage = pageId;
  showPage(pageId);
  updateNavUI(pageId);
  mountDock();
  if (pageId === 'dashboard') renderDashboard();
  if (pageId === 'log') renderMatchLogs();
  if (pageId === 'setup') refreshSetupWizard(getDisplay().name);
  if (pageId === 'profile') renderProfilePageContent();
  if (pageId === 'analytics') renderAnalyticsPage();
  if (pageId === 'reports') renderReportsPageContent();
  if (pageId === 'focus') renderFocusPage(state.games, state.goals, getDisplay());
  if (pageId === 'group') renderGroupsPage(getGroupsCtx());
  if (pageId === 'sessions') renderSessionsPageContent();
}

function wireNavigation() {
  wireSectionNav({
    onNavigate: navigate,
    getActivePage: () => state.activePage || 'dashboard',
  });
}

function wireKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'l') {
      e.preventDefault();
      navigate('log', 'home');
      document.getElementById('quick-endmmr')?.focus();
    } else if (key === 's') {
      e.preventDefault();
      document.getElementById('session-start-btn')?.click();
    } else if (key === 'f') {
      e.preventDefault();
      navigate('focus', 'home');
    }
  });
}

function applyLogPrefs() {
  const prefs = loadPrefs();
  const fMode = document.getElementById('f-mode');
  if (fMode && prefs.lastMode) fMode.value = prefs.lastMode;
}

function estimateMMRDeltaForMode(result, mode) {
  return estimateMMRDelta(state.games, result, mode);
}

async function handleAutoLog(match) {
  const logMode = match.mode || document.querySelector('#quick-mode-pills .active')?.dataset.mode || "2's";
  if (match.mode) setQuickMode(match.mode);
  if (match.result) setQuickResult(match.result);
  applyLiveStats(match);

  const priorEnd = getLastMMR(logMode);
  const delta = estimateMMRDeltaForMode(match.result, logMode);
  let startMMR;
  let endMMR;

  if (priorEnd !== '') {
    startMMR = parseInt(priorEnd, 10);
    endMMR = Math.max(0, startMMR + delta);
  } else {
    // No logged history in this playlist — placeholder until MMR is confirmed
    startMMR = 0;
    endMMR = delta;
    showToast(`First ${logMode} log — confirm your real MMR after the match`, 'error');
  }

  if (Number.isNaN(startMMR) || Number.isNaN(endMMR)) {
    showToast('Confirm MMR from the ranked screen after this match', 'error');
    document.getElementById('quick-endmmr')?.focus();
    return false;
  }

  const fStart = document.getElementById('f-startmmr');
  const qEnd = document.getElementById('quick-endmmr');
  if (fStart) fStart.value = priorEnd !== '' ? startMMR : '';
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
      document.getElementById('f-startmmr').value = getLastMMR(game.mode);
      document.getElementById('f-endmmr').value = '';
      document.getElementById('f-notes').value = '';
      document.querySelectorAll('#log-tags .tag-chip.selected').forEach(c => c.classList.remove('selected'));
      state.ui.selectedTags = [];
      state.ui.autoLogNote = '';
      resetQuickAfterLog();
    });
    renderAll();
    if (game) {
      state.homeChartMode = game.mode;
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
  document.getElementById('logo-home-btn')?.addEventListener('click', () => navigate('dashboard', 'home'));
  document.getElementById('bridge-hint-setup-link')?.addEventListener('click', () => navigate('setup', 'home'));
  wireKeyboardShortcuts();
  document.getElementById('dash-view-all-logs')?.addEventListener('click', () => {
    navigate('log', 'home');
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
    getLastMMR: (mode) => getLastMMR(mode),
    setFormResult: setResult,
    setSelectedTags: tags => { state.ui.selectedTags = tags; },
    onAutoLogToggle: refreshLiveStatus,
  });
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
  document.addEventListener('rl-session-ui-refresh', () => {
    renderHomePage();
  });
  onAuthChange(async (session) => {
    if (session) {
      try {
        await bootApp();
      } catch (e) {
        console.error(e);
        showLoading(false);
        showToast(e?.message || 'Could not load after sign-in — try refreshing', 'error');
      }
    } else {
      showLoggedOut();
    }
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
