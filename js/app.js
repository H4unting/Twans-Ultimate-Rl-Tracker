/**
 * Twans Ultimate Tracker — auth-first personal dashboard
 */

import { applyAppMode } from './env.js';
import { state, subscribe, setGames, setSyncStatus, setGoals, setProfile, getUserDisplay, getActiveGames } from './state.js';
import { initAuth, signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset, signOut, onAuthChange, getAuthUser } from './auth.js';
import { loadUserData, saveSettings, createGroup, joinGroup, leaveGroup, loadUserGroups, saveGames, saveProfile } from './supabase.js';
import { applyFilters, DEFAULT_FILTERS } from './filters.js';
import { calcStats, estimateMMRDelta, repairPlaylistMMRChain } from './utils.js';
import { addGame, updateGame, deleteGame, getLastMMR, patchLastGame, undoLastGame, isMmrEstimated } from './matches.js';
import { startSession, endSession, closeSessionModal, closeSessionModalAndContinue, initSessionUI, refreshSessionUI, restoreSessionFromStorage, getLoggingSessionNum } from './sessions.js';
import {
  initQuickLog, showQuickDock, hideQuickDock, getQuickLogPayload,
  resetQuickAfterLog, loadPrefs, savePrefs, syncFormFromQuick, applyLiveStats, flashAutoLogged,
  setQuickResult, setQuickMode, rerenderQuickTags, getLastModeForGame,
} from './quicklog.js';
import { renderProfilePage } from './profile-ui.js';
import { initRlLive, stopRlLive, refreshLiveStatus,
  saveRlDisplayName, getRlDisplayName,
} from './rl-live.js';
import { initValorantLive, stopValorantLive, refreshValorantStatus } from './valorant-live.js';
import { wireBridgeStatusClick } from './bridge-ui.js';
import { initGameSwitcher, restoreActiveGameFromPrefs, applyGameShell, applyPageCopy, syncEditModal } from './game-ui.js';
import { getDockModePillsEl } from './dock-ui.js';
import { GAME_IDS, getTagGroups, getGameMeta } from './games.js';
import { VAL_DEFAULT_RR_SWING } from './valorant-config.js';
import { renderSetupWizard, refreshSetupWizard, onBridgeStatusChange, renderLogSetupNudge } from './setup-wizard.js';
import { mmrChart, wlChart } from './charts.js';
import { renderAnalytics } from './analytics.js';
import { renderReportsPage } from './reports-ui.js';
import { normalizeGoalsStorage, getActiveGoals } from './goals.js';
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
  return applyFilters(getActiveGames(), { ...DEFAULT_FILTERS, playlist: state.playlist ?? 'all' }, state.activeGame);
}

function getMatchLogsGames() {
  return applyFilters(getActiveGames(), { ...state.matchLogFilters, playlist: 'all' }, state.activeGame);
}

function getAnalyticsGames() {
  return applyFilters(getActiveGames(), { ...state.filters, playlist: state.playlist ?? 'all' }, state.activeGame);
}

function getFilteredGames() {
  return getDashboardGames();
}

function getDisplay() {
  return getUserDisplay(getAuthUser());
}

function withTimeout(promise, ms, message = 'Timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

let bootPromise = null;

async function bootApp() {
  showLoginScreen(false);
  showLoading(true);

  try {
    const {
      profile, games, goals, groups, bio, rlDisplayName,
      primaryColor, secondaryColor, activeGame, riotId, riotRegion,
    } = await withTimeout(loadUserData(), 30000, 'Loading timed out — check your connection');
    setProfile({
      ...(profile ?? {}),
      primary_color: profile?.primary_color || primaryColor || profile?.accent_color || '#e65c00',
      secondary_color: profile?.secondary_color || secondaryColor || '#4a2060',
    });
    const { games: repaired, changed } = repairPlaylistMMRChain(
      games.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) === GAME_IDS.ROCKET_LEAGUE),
    );
    let allGames = games;
    if (changed) {
      allGames = [
        ...games.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) !== GAME_IDS.ROCKET_LEAGUE),
        ...repaired,
      ];
      await saveGames(allGames);
    }
    setGames(allGames);
    setGoals(normalizeGoalsStorage(goals));
    state.profileBio = bio ?? '';
    state.groups = groups;
    restoreActiveGameFromPrefs(activeGame);
    if (rlDisplayName && !loadPrefs().rlDisplayName) {
      saveRlDisplayName(rlDisplayName);
      savePrefs({ rlDisplayName });
    }
    const prefsPatch = {};
    if (riotId && !loadPrefs().riotId) prefsPatch.riotId = riotId;
    if (riotRegion && !loadPrefs().riotRegion) prefsPatch.riotRegion = riotRegion;
    if (Object.keys(prefsPatch).length) savePrefs(prefsPatch);
    state.filters = { ...DEFAULT_FILTERS };
    state.matchLogFilters = { ...DEFAULT_FILTERS };
    state.activePage = 'dashboard';

    renderAuthBar(getDisplay(), handleSignOut, () => navigate('profile', 'home'));
    applyAppMode();
    applyLogPrefs();

    showQuickDock();
    restoreSessionFromStorage(getActiveGames());
    renderSetupWizard(getDisplay().name);
    renderLogSetupNudge();
    initGameSwitcher({
      onChange: () => renderAll(),
      getSettingsPayload,
    });
    initRlLive(applyLiveStats, onBridgeStatusChange, handleAutoLog);
    initValorantLive(applyLiveStats, onBridgeStatusChange, handleValorantAutoLog);

    renderAll();
  } catch (e) {
    console.error(e);
    setSyncStatus('error');
    const msg = e?.message ?? 'Could not load your data';
    if (getAuthUser()) {
      showLoginScreen(false);
      showQuickDock();
      showToast(
        msg.includes('PGRST') || msg.includes('game')
          ? 'Database needs multi-game.sql — run it in Supabase SQL Editor'
          : msg.includes('infinite recursion')
            ? 'Database policy error — run groups-schema-fix.sql in Supabase'
            : msg.includes('Timed out') || msg.includes('timeout')
              ? 'Loading timed out — refresh the page or check your connection'
              : msg,
        'error',
      );
    } else {
      showLoginScreen(true);
      showToast(
        msg.includes('infinite recursion') ? 'Database policy error — run groups-schema-fix.sql in Supabase' : msg,
        'error',
      );
    }
  } finally {
    showLoading(false);
  }
}

function showLoggedOut() {
  showLoading(false);
  showLoginScreen(true);
  hideQuickDock();
  stopRlLive();
  stopValorantLive();
  wireLoginScreen();
  resetLoginForm();
}

let loginMode = 'signin';

function resetLoginForm() {
  loginMode = 'signin';
  updateLoginModeUI();
  const form = document.getElementById('email-login-form');
  form?.reset();
  setLoginBusy(false);
  document.getElementById('google-signin-btn')?.removeAttribute('disabled');
}

function updateLoginModeUI() {
  const btn = document.getElementById('email-auth-btn');
  const toggle = document.getElementById('login-mode-toggle');
  const password = document.getElementById('login-password');
  if (btn) btn.textContent = loginMode === 'signup' ? 'Create account' : 'Sign in with email';
  if (toggle) {
    toggle.textContent = loginMode === 'signup'
      ? 'Already have an account? Sign in'
      : 'Need an account? Create one';
  }
  if (password) {
    password.autocomplete = loginMode === 'signup' ? 'new-password' : 'current-password';
    password.placeholder = loginMode === 'signup' ? 'Choose a password (6+ chars)' : 'Your password';
  }
}

function setLoginBusy(busy) {
  document.getElementById('email-auth-btn')?.toggleAttribute('disabled', busy);
  document.getElementById('google-signin-btn')?.toggleAttribute('disabled', busy);
  document.getElementById('login-email')?.toggleAttribute('disabled', busy);
  document.getElementById('login-password')?.toggleAttribute('disabled', busy);
}

function wireLoginScreen() {
  wireGoogleSignIn();
  wireEmailLogin();
}

async function handleGoogleSignIn() {
  setLoginBusy(true);
  try {
    await signInWithGoogle();
  } catch (e) {
    console.error(e);
    showToast(e?.message || 'Sign in failed', 'error');
    setLoginBusy(false);
  }
}

async function handleEmailAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('login-email')?.value.trim() ?? '';
  const password = document.getElementById('login-password')?.value ?? '';

  if (!email || password.length < 6) {
    showToast('Enter a valid email and password (6+ characters)', 'error');
    return;
  }

  setLoginBusy(true);
  try {
    if (loginMode === 'signup') {
      const { session } = await signUpWithEmail(email, password);
      if (session) {
        showToast('Account created — welcome!');
      } else {
        showToast('Check your email to confirm your account, then sign in.');
        loginMode = 'signin';
        updateLoginModeUI();
      }
    } else {
      await signInWithEmail(email, password);
      showToast('Signed in!');
    }
  } catch (err) {
    console.error(err);
    const msg = err?.message || 'Email sign-in failed';
    showToast(
      msg.includes('Invalid login credentials') ? 'Wrong email or password' : msg,
      'error',
    );
  } finally {
    setLoginBusy(false);
  }
}

async function handlePasswordReset() {
  const email = document.getElementById('login-email')?.value.trim() ?? '';
  if (!email) {
    showToast('Enter your email above first', 'error');
    document.getElementById('login-email')?.focus();
    return;
  }
  setLoginBusy(true);
  try {
    await sendPasswordReset(email);
    showToast('Password reset email sent — check your inbox');
  } catch (err) {
    console.error(err);
    showToast(err?.message || 'Could not send reset email', 'error');
  } finally {
    setLoginBusy(false);
  }
}

function wireEmailLogin() {
  const form = document.getElementById('email-login-form');
  if (!form || form.dataset.wired) return;
  form.dataset.wired = '1';
  form.addEventListener('submit', handleEmailAuthSubmit);

  document.getElementById('login-mode-toggle')?.addEventListener('click', () => {
    loginMode = loginMode === 'signin' ? 'signup' : 'signin';
    updateLoginModeUI();
  });

  document.getElementById('login-forgot-btn')?.addEventListener('click', handlePasswordReset);
  updateLoginModeUI();
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
  stopValorantLive();
  showLoginScreen(true);
}

function renderHomePage() {
  renderHome(getActiveGames(), getActiveGoals());
  const games = getActiveGames();
  const modeGames = getHomeChartGames(games);
  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const chartColor = isVal ? '#ff4655' : getDisplay().color;

  const rlLabel = document.getElementById('home-charts-label');
  const valLabel = document.getElementById('val-charts-label');
  const chartCaption = modeGames.length
    ? `${getHomeChartModeLabel(games)} — tap a queue above to switch`
    : '';

  if (rlLabel) rlLabel.textContent = !isVal ? chartCaption : '';
  if (valLabel) valLabel.textContent = isVal ? chartCaption : '';

  if (modeGames.length >= 1) {
    const stats = calcStats(modeGames);
    if (isVal) {
      mmrChart('valHomeRR', modeGames.slice(-20), chartColor, 'RR');
      wlChart('valHomeWL', stats);
    } else {
      mmrChart('homeMMR', modeGames.slice(-20), chartColor);
      wlChart('homeWL', stats);
    }
  }
}

function renderAnalyticsPage() {
  const filtered = getAnalyticsGames();
  const stats = calcStats(filtered);
  const display = getDisplay();
  const isVal = state.activeGame === GAME_IDS.VALORANT;
  renderStats('analytics-stats', stats, state.playlist, state.activeGame);
  mmrChart('dashMMR', filtered, isVal ? '#ff4655' : display.color, isVal ? 'RR' : 'MMR');
  wlChart('dashWL', stats);
  renderAnalytics(filtered);
}

function renderAll() {
  const games = getActiveGames();
  const display = getDisplay();

  renderHomePage();

  renderPlaylistTabs('pl-tabs', state.playlist, (pl, btn) => {
    state.playlist = pl;
    document.querySelectorAll('#pl-tabs .pl-tab').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
    renderAnalyticsPage();
  }, state.activeGame);

  renderMatchLogs();

  const logMode = getLastModeForGame(state.activeGame);
  const lastMMR = getLastMMR(logMode);
  const fStart = document.getElementById('f-startmmr');
  if (fStart) fStart.value = lastMMR !== '' ? lastMMR : '';

  renderFilterBar('analytics-filters', games, state.filters, filters => {
    state.filters = { ...state.filters, ...filters };
    renderAnalyticsPage();
  }, state.activeGame);
  renderAnalyticsPage();

  renderReportsPageContent();
  renderFocusPage(games, getActiveGoals(), display);
  renderGroupsPage(getGroupsCtx());
  renderSessionsPageContent();

  refreshSessionUI();
  wireLogTableActions();
  applyPageCopy(state.activeGame);
  refreshSessionUI();
  refreshLogTagChips();
  rerenderQuickTags();
  updateNavUI(state.activePage || 'dashboard');
  mountDock();
}

function renderDashboard() {
  renderHomePage();
}

function renderMatchLogs() {
  renderLogSetupNudge();
  renderQuickFilters('matchlogs-quick-filters', () => renderMatchLogs());
  renderFilterBar('matchlogs-filters', getActiveGames(), state.matchLogFilters, filters => {
    state.matchLogFilters = { ...state.matchLogFilters, ...filters };
    renderMatchLogs();
  }, state.activeGame);
  let games = getMatchLogsGames();
  const qf = getActiveQuickFilter();
  if (qf !== 'all') {
    games = applyQuickFilter(games, qf, getQuickFilterSessionNum());
  }
  renderLog('log-history-table', games, null, true, state.activeGame);
  wireLogTableActions();
}

function renderSessionsPageContent() {
  renderSessionsPage(getActiveGames(), getDisplay().name, {
    onViewSession: sessionNum => {
      state.matchLogFilters = { ...state.matchLogFilters, session: String(sessionNum) };
      navigate('log', 'home');
    },
  });
}

function renderReportsPageContent() {
  renderReportsPage(
    getActiveGames(),
    getDisplay().name,
    state.reportsWeekOffset,
    offset => { state.reportsWeekOffset = offset; renderReportsPageContent(); },
    async nextGoals => {
      setGoals(nextGoals);
      await saveSettings(getSettingsPayload({ goals: nextGoals }));
      renderHomePage();
      renderFocusPage(getActiveGames(), getActiveGoals(), getDisplay());
      showToast('Goals saved!');
    },
  );
}

function renderProfilePageContent() {
  renderProfilePage({
    games: getActiveGames(),
    profile: state.profile,
    display: getDisplay(),
    authUser: getAuthUser(),
    bio: state.profileBio ?? '',
    gameId: state.activeGame,
    onSave: handleProfileSave,
  });
}

function getSettingsPayload(overrides = {}) {
  const prefs = loadPrefs();
  return {
    goals: state.goals,
    bio: state.profileBio ?? '',
    activeGame: state.activeGame,
    rlDisplayName: getRlDisplayName() || prefs.rlDisplayName || '',
    riotId: prefs.riotId || '',
    riotRegion: prefs.riotRegion || 'na',
    primaryColor: state.profile?.primary_color ?? '',
    secondaryColor: state.profile?.secondary_color ?? '',
    ...overrides,
  };
}

async function handleProfileSave({ displayName, rlName, primaryColor, secondaryColor, bio }) {
  state.profileBio = bio;
  await saveSettings(getSettingsPayload({
    bio,
    rlDisplayName: rlName,
    primaryColor,
    secondaryColor,
  }));

  const { extended } = await saveProfile({
    display_name: displayName,
    primary_color: primaryColor,
    secondary_color: secondaryColor,
    accent_color: primaryColor,
  });

  setProfile({
    ...state.profile,
    display_name: displayName,
    primary_color: primaryColor,
    secondary_color: secondaryColor,
    accent_color: primaryColor,
  });

  saveRlDisplayName(rlName);
  savePrefs({ rlDisplayName: rlName });

  renderAuthBar(getDisplay(), handleSignOut, () => navigate('profile', 'home'));
  renderProfilePageContent();

  return { extended };
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
  if (pageId === 'focus') renderFocusPage(getActiveGames(), getActiveGoals(), getDisplay());
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
  const mode = getLastModeForGame(state.activeGame);
  const fMode = document.getElementById('f-mode');
  if (fMode) fMode.value = mode;
}

function estimateMMRDeltaForMode(result, mode) {
  return estimateMMRDelta(getActiveGames(), result, mode);
}

async function handleValorantAutoLog(match) {
  if (state.activeGame !== GAME_IDS.VALORANT) return false;

  const logMode = match.mode || getQuickMode() || 'Competitive';
  if (match.mode) setQuickMode(match.mode);
  if (match.result) setQuickResult(match.result);
  applyLiveStats({
    goals: match.kills,
    assists: match.deaths,
    saves: match.acs,
    kills: match.kills,
    deaths: match.deaths,
    valAssists: match.valAssists,
    acs: match.acs,
    result: match.result,
    mode: match.mode,
    agent: match.agent,
    map: match.map,
  });

  const priorEnd = getLastMMR(logMode);
  const delta = priorEnd !== ''
    ? (match.result === 'W' ? VAL_DEFAULT_RR_SWING.W : VAL_DEFAULT_RR_SWING.L)
    : (match.result === 'W' ? VAL_DEFAULT_RR_SWING.W : VAL_DEFAULT_RR_SWING.L);
  let startRR;
  let endRR;

  if (priorEnd !== '') {
    startRR = parseInt(priorEnd, 10);
    endRR = Math.max(0, startRR + delta);
  } else {
    startRR = 0;
    endRR = delta;
    showToast(`First ${logMode} log — confirm your real RR after the match`, 'error');
  }

  document.getElementById('quick-endmmr').value = endRR;
  const fStart = document.getElementById('f-startmmr');
  if (fStart) fStart.value = priorEnd !== '' ? startRR : '';

  state.ui.autoLogNote = [
    priorEnd === '' ? 'RR estimated' : '',
    match.agent ? match.agent : '',
    match.map ? match.map : '',
  ].filter(Boolean).join(' · ');

  const ok = await submitGameLog('auto');
  if (!ok) return false;
  flashAutoLogged();
  refreshValorantStatus();
  return true;
}

function getQuickModeFromDock() {
  return getDockModePillsEl()?.querySelector('.active')?.dataset.mode
    ?? getLastModeForGame(state.activeGame);
}

async function handleAutoLog(match) {
  if (state.activeGame !== GAME_IDS.ROCKET_LEAGUE) return false;
  const logMode = match.mode || getQuickModeFromDock() || "2's";
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

  const ok = await submitGameLog('auto');
  if (!ok) return false;

  flashAutoLogged();
  refreshLiveStatus();
  return true;
}

function recentGamesHaveMMR() {
  return getActiveGames().slice(-3).some(g => g.endMMR);
}

async function submitGameLog(source = 'form') {
  const meta = getGameMeta(state.activeGame);
  const rankLabel = meta.rankLabel;

  if (source === 'quick' || source === 'auto') {
    syncFormFromQuick();
  }

  const endMMR = source === 'quick' || source === 'auto'
    ? document.getElementById('quick-endmmr')?.value
    : document.getElementById('f-endmmr')?.value;

  if (!endMMR) {
    showToast(`Enter end ${rankLabel}`, 'error');
    document.getElementById(source === 'quick' || source === 'auto' ? 'quick-endmmr' : 'f-endmmr')?.focus();
    return false;
  }

  const btn = source === 'quick' || source === 'auto'
    ? document.getElementById('quick-log-btn')
    : document.getElementById('add-btn');

  if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = '…'; }

  try {
    const isVal = state.activeGame === GAME_IDS.VALORANT;
    const payload = source === 'quick' || source === 'auto' ? getQuickLogPayload() : isVal ? {
      date: document.getElementById('f-date').value,
      session: getLoggingSessionNum(),
      mode: document.getElementById('f-mode').value,
      result: state.ui.currentResult,
      kills: document.getElementById('f-goals').value,
      deaths: document.getElementById('f-assists').value,
      valAssists: document.getElementById('f-saves').value,
      goals: document.getElementById('f-goals').value,
      assists: document.getElementById('f-assists').value,
      saves: document.getElementById('f-saves').value,
      agent: document.getElementById('f-agent')?.value ?? '',
      map: document.getElementById('f-map')?.value ?? '',
      startRR: document.getElementById('f-startmmr').value,
      endRR: document.getElementById('f-endmmr').value,
      startMMR: document.getElementById('f-startmmr').value,
      endMMR: document.getElementById('f-endmmr').value,
      notes: document.getElementById('f-notes').value,
    } : {
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
      showPostMatchCard(game, { estimated: isMmrEstimated(game) });
    }
    return true;
  } catch {
    showToast('Failed to save', 'error');
    return false;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.dataset.label || (source === 'quick' || source === 'auto' ? 'LOG' : (state.activeGame === GAME_IDS.VALORANT ? '+ Log Match' : '+ Log Game'));
    }
  }
}

function refreshLogTagChips() {
  state.ui.selectedTags = [];
  renderTagChips('log-tags', state.ui.selectedTags, (tag, selected) => {
    if (selected) state.ui.selectedTags.push(tag);
    else state.ui.selectedTags = state.ui.selectedTags.filter(t => t !== tag);
  }, state.activeGame);
}

function wireLogForm() {
  refreshLogTagChips();
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
  const game = getActiveGames().find(g => g.match === matchNum);
  if (!game) return;
  const isVal = state.activeGame === GAME_IDS.VALORANT;
  syncEditModal(state.activeGame);
  state.ui.editingMatch = matchNum;
  state.ui.editTags = [...(game.tags || [])];
  document.getElementById('edit-modal-sub').textContent = `Match #${matchNum}`;
  const [mm, dd, yy] = game.date.split('/');
  document.getElementById('e-date').value = `20${yy}-${mm}-${dd}`;
  document.getElementById('e-session').value = game.session;
  document.getElementById('e-mode').value = game.mode;
  if (isVal) {
    document.getElementById('e-kills').value = game.kills ?? game.goals ?? 0;
    document.getElementById('e-deaths').value = game.deaths ?? 0;
    document.getElementById('e-val-assists').value = game.valAssists ?? game.assists ?? 0;
    document.getElementById('e-agent').value = game.agent ?? '';
    document.getElementById('e-map').value = game.map ?? '';
  } else {
    document.getElementById('e-goals').value = game.goals;
    document.getElementById('e-assists').value = game.assists || 0;
    document.getElementById('e-saves').value = game.saves;
  }
  document.getElementById('e-startmmr').value = game.startMMR;
  document.getElementById('e-endmmr').value = game.endMMR;
  document.getElementById('e-notes').value = game.notes || '';
  setEditResult(game.result);
  renderEditTags();
  document.getElementById('edit-modal').classList.add('open');
}

function renderEditTags() {
  const wrap = document.getElementById('edit-tags');
  if (!wrap) return;
  wrap.innerHTML = getTagGroups(state.activeGame).map(group => `
    <div class="tag-section">
      <div class="tag-section-label"><span class="dot ${group.cat}"></span>${group.label}</div>
      <div class="edit-tag-row tags-row">
        ${group.tags.map(tag => `
          <span class="tag-chip ${group.cat}${state.ui.editTags.includes(tag) ? ' selected' : ''}" data-tag="${tag}">${tag}</span>
        `).join('')}
      </div>
    </div>`).join('');

  wrap.querySelectorAll('.tag-chip').forEach(chip => {
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
  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const btn = document.getElementById('save-edit-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  try {
    const startRank = document.getElementById('e-startmmr').value;
    const endRank = document.getElementById('e-endmmr').value;
    await updateGame(matchNum, {
      date: document.getElementById('e-date').value,
      session: document.getElementById('e-session').value,
      mode: document.getElementById('e-mode').value,
      result: document.getElementById('e-wl-win').classList.contains('active') ? 'W' : 'L',
      goals: isVal ? document.getElementById('e-kills').value : document.getElementById('e-goals').value,
      assists: isVal ? document.getElementById('e-val-assists').value : document.getElementById('e-assists').value,
      saves: isVal ? 0 : document.getElementById('e-saves').value,
      kills: document.getElementById('e-kills')?.value ?? 0,
      deaths: document.getElementById('e-deaths')?.value ?? 0,
      valAssists: document.getElementById('e-val-assists')?.value ?? 0,
      agent: document.getElementById('e-agent')?.value ?? '',
      map: document.getElementById('e-map')?.value ?? '',
      startMMR: startRank,
      endMMR: endRank,
      startRR: startRank,
      endRR: endRank,
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
  wireLoginScreen();
  showLoggedOut();

  const dateEl = document.getElementById('f-date');
  if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);

  subscribe(() => setSyncUI(state.syncStatus));
  setSyncUI(state.syncStatus);

  wireNavigation();
  document.getElementById('logo-home-btn')?.addEventListener('click', () => navigate('dashboard', 'home'));
  wireBridgeStatusClick(() => navigate('setup', 'home'));
  wireKeyboardShortcuts();
  document.getElementById('dash-view-all-logs')?.addEventListener('click', () => {
    navigate('log', 'home');
  });
  document.getElementById('matchlogs-export-btn')?.addEventListener('click', () => {
    exportGamesCSV(getMatchLogsGames(), getDisplay().name, state.activeGame);
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
    onAutoLogToggle: () => {
      if (state.activeGame === GAME_IDS.VALORANT) refreshValorantStatus();
      else refreshLiveStatus();
    },
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
      if (!bootPromise) {
        bootPromise = bootApp().finally(() => { bootPromise = null; });
      }
      try {
        await bootPromise;
      } catch (e) {
        console.error(e);
        showToast(e?.message || 'Could not load after sign-in — try refreshing', 'error');
      }
    } else {
      bootPromise = null;
      showLoggedOut();
    }
  });

  try {
    await withTimeout(initAuth(), 15000, 'Sign-in check timed out — refresh and try again');
    if (!getAuthUser()) showLoggedOut();
  } catch (e) {
    console.error(e);
    showLoggedOut();
    showToast(e.message || 'Auth setup error — try signing in again', 'error');
  }
}

init();
