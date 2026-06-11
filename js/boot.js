/** App boot — load user data, repair chains, first-run rank setup */

import { applyAppMode, isDesktopHost, isLocalTrackerHost } from './env.js';
import { isBridgeReachable } from './bridge-client.js';
import { STATUS } from './status-copy.js';
import { state, setGames, setSyncStatus, setGoals, setProfile, getActiveGames } from './state.js';
import { loadUserData, saveSettings, saveGames } from './supabase.js';
import { DEFAULT_FILTERS } from './filters.js';
import { RL, VAL, GAME_IDS } from './games/registry.js';
import { routeActiveGame } from './games/router.js';
import {
  applyRankBaselinesFromSettings, inferRankBaselinesFromGames, rankBaselinesForSettings,
} from './rank-baselines.js';
import { showRankSetupIfNeeded } from './rank-setup-ui.js';
import { showOnboardingIfNeeded } from './onboarding-wizard.js';
import { purgeGhostValorantMatches, collapseDuplicateValorantMatchesInState } from './matches.js';
import { normalizeGoalsStorage } from './goals.js';
import { loadPrefs, savePrefs, showQuickDock } from './quicklog.js';
import { saveRlDisplayName } from './rl-live.js';
import { renderSetupWizard, refreshSetupWizard, renderLogSetupNudge } from './setup-wizard.js';
import { initGameSwitcher, restoreActiveGameFromPrefs } from './game-ui.js';
import { restoreSessionFromStorage } from './sessions.js';
import { showToast, showLoading, showLoginScreen, renderAuthBar } from './ui.js';
import { getAuthUser } from './auth.js';

let bootPromise = null;
let initialBootDone = false;
let ctx = {};
let bootT0 = 0;

function markBoot(phase) {
  if (!bootT0 && typeof performance !== 'undefined') bootT0 = performance.now();
  const elapsed = bootT0 && typeof performance !== 'undefined'
    ? Math.round(performance.now() - bootT0)
    : 0;
  console.info(`[boot +${elapsed}ms] ${phase}`);
  if (typeof window !== 'undefined') {
    (window.__BOOT_MARKS ||= []).push({ phase, ms: elapsed });
  }
}

export function wireBootContext(next) {
  ctx = next;
}

export function isInitialBootDone() {
  return initialBootDone;
}

export function getBootPromise() {
  return bootPromise;
}

export function setBootPromise(promise) {
  bootPromise = promise;
}

export function resetBootState() {
  initialBootDone = false;
  bootPromise = null;
}

function withTimeout(promise, ms, message = 'Timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function waitForFirstPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

/** Desktop: probe bridge in background — never blocks first paint. */
async function waitForDesktopServices(maxMs = 4000, intervalMs = 400) {
  if (!isDesktopHost() || !isLocalTrackerHost()) return;

  const label = document.querySelector('#loading-overlay span');
  const prior = label?.textContent;
  if (label) label.textContent = STATUS.starting;

  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (isBridgeReachable()) {
      markBoot('bridge-reachable');
      if (label && prior) label.textContent = prior;
      return;
    }
    await new Promise((r) => { setTimeout(r, intervalMs); });
  }
  markBoot('bridge-wait-capped');
  if (label && prior) label.textContent = prior;
}

function runDeferredMaintenance() {
  const run = async () => {
    markBoot('deferred-maintenance-start');
    const ghostRemoved = await purgeGhostValorantMatches({ silent: true });
    if (ghostRemoved > 0) {
      showToast(`Removed ${ghostRemoved} invalid auto-log ${ghostRemoved === 1 ? 'match' : 'matches'}`);
    }
    const dupesRemoved = await collapseDuplicateValorantMatchesInState({ silent: true });
    if (dupesRemoved > 0) {
      showToast(`Removed ${dupesRemoved} duplicate ${dupesRemoved === 1 ? 'match' : 'matches'}`);
      ctx.renderAll?.('core');
    }
    markBoot('deferred-maintenance-done');
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => { void run(); }, { timeout: 3000 });
  } else {
    setTimeout(() => { void run(); }, 500);
  }
}

function bootErrorMessage(msg) {
  if (msg.includes('PGRST') || msg.includes('game')) {
    return 'Database setup incomplete — run docs/supabase/v1-full-setup.sql in Supabase SQL Editor';
  }
  if (msg.includes('infinite recursion')) {
    return 'Database policy error — re-run docs/supabase/v1-full-setup.sql';
  }
  if (msg.includes('Timed out') || msg.includes('timeout')) {
    return 'Loading timed out — refresh the page or check your connection';
  }
  return msg;
}

export async function bootApp() {
  if (initialBootDone) return;

  markBoot('shell-visible');
  showLoginScreen(false);
  applyAppMode();
  renderAuthBar(ctx.getDisplay(), ctx.handleSignOut, () => ctx.navigate('profile', 'home'));
  showQuickDock();
  state.activePage = 'dashboard';
  ctx.ensureBridgeServices?.();

  showLoading(false);
  await waitForFirstPaint();
  markBoot('first-paint');

  showLoading(true);
  void waitForDesktopServices();

  try {
    markBoot('load-user-data-start');
    const userData = await withTimeout(
      loadUserData(),
      30000,
      'Loading timed out — check your connection',
    );
    markBoot('data-loaded');

    const {
      profile, games, goals, groups, bio, rlDisplayName,
      primaryColor, secondaryColor, activeGame, riotId, riotRegion,
      rankBaselines, rankBaselinesComplete,
    } = userData;

    setProfile({
      ...(profile ?? {}),
      primary_color: profile?.primary_color || primaryColor || profile?.accent_color || '#e65c00',
      secondary_color: profile?.secondary_color || secondaryColor || '#4a2060',
    });

    markBoot('repair-chains-start');
    const { games: repaired, changed } = RL.repairPlaylistMMRChain(
      games.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) === GAME_IDS.ROCKET_LEAGUE),
    );
    const valSlice = games.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) === GAME_IDS.VALORANT);
    const { games: valRepaired, changed: valChanged } = VAL.repairRankChain(valSlice);
    let allGames = games;

    if (changed) {
      allGames = [
        ...games.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) !== GAME_IDS.ROCKET_LEAGUE),
        ...repaired,
      ];
      await saveGames(repaired, GAME_IDS.ROCKET_LEAGUE);
    }
    if (valChanged) {
      allGames = [
        ...allGames.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) !== GAME_IDS.VALORANT),
        ...valRepaired,
      ];
      await saveGames(valRepaired, GAME_IDS.VALORANT);
    }
    setGames(allGames);
    markBoot('hydrate-state');

    applyRankBaselinesFromSettings({ rankBaselines, rankBaselinesComplete });
    if (allGames.length > 0 && !rankBaselinesComplete) {
      const inferred = inferRankBaselinesFromGames(allGames);
      applyRankBaselinesFromSettings({ rankBaselines: inferred, rankBaselinesComplete: true });
      await saveSettings(ctx.getSettingsPayload(rankBaselinesForSettings()));
    }

    setGoals(normalizeGoalsStorage(goals));
    state.profileBio = bio ?? '';
    state.groups = groups;
    restoreActiveGameFromPrefs(activeGame);
    routeActiveGame(state.activeGame);

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

    renderAuthBar(ctx.getDisplay(), ctx.handleSignOut, () => ctx.navigate('profile', 'home'));
    applyAppMode();
    ctx.applyLogPrefs();
    restoreSessionFromStorage(getActiveGames());
    renderSetupWizard(ctx.getDisplay().name);
    renderLogSetupNudge();
    initGameSwitcher({
      onChange: () => ctx.renderAll(),
      getSettingsPayload: ctx.getSettingsPayload,
    });
    ctx.ensureBridgeServices();
    ctx.renderAll();
    markBoot('first-render-complete');

    runDeferredMaintenance();

    window.__saveRankBaselines = async () => {
      await saveSettings(ctx.getSettingsPayload(rankBaselinesForSettings()));
    };

    const afterRankSetup = () => {
      ctx.renderAll('core');
      refreshSetupWizard(ctx.getDisplay().name);
    };

    if (!showOnboardingIfNeeded({ games: allGames, onComplete: afterRankSetup })) {
      showRankSetupIfNeeded({
        games: allGames,
        onComplete: afterRankSetup,
      });
    }

    import('./qa/qa-panel.js').then(({ initQaToolsIfEnabled }) => {
      initQaToolsIfEnabled({
        renderAll: ctx.renderAll,
        getSettingsPayload: ctx.getSettingsPayload,
      });
    }).catch(() => { /* dev-only */ });
  } catch (e) {
    console.error(e);
    setSyncStatus('error');
    const msg = e?.message ?? 'Could not load your data';
    if (getAuthUser()) {
      showLoginScreen(false);
      showQuickDock();
      ctx.ensureBridgeServices?.();
      showToast(bootErrorMessage(msg), 'error');
    } else {
      showLoginScreen(true);
      showToast(bootErrorMessage(msg), 'error');
    }
  } finally {
    showLoading(false);
    initialBootDone = true;
    markBoot('boot-finished');
  }
}
