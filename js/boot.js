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

/** Desktop exe: keep loading overlay until local services respond (no login-before-ready flash). */
async function waitForDesktopServices(maxMs = 30000) {
  if (!isDesktopHost() || !isLocalTrackerHost()) return;

  const label = document.querySelector('#loading-overlay span');
  const prior = label?.textContent;
  if (label) label.textContent = STATUS.starting;

  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (isBridgeReachable()) {
      if (label && prior) label.textContent = prior;
      return;
    }
    await new Promise((r) => { setTimeout(r, 400); });
  }
  if (label && prior) label.textContent = prior;
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

  showLoginScreen(false);
  applyAppMode();
  renderAuthBar(ctx.getDisplay(), ctx.handleSignOut, () => ctx.navigate('profile', 'home'));
  showQuickDock();
  showLoading(true);
  ctx.ensureBridgeServices?.();

  try {
    const [, userData] = await Promise.all([
      waitForDesktopServices(),
      withTimeout(loadUserData(), 30000, 'Loading timed out — check your connection'),
    ]);

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

    applyRankBaselinesFromSettings({ rankBaselines, rankBaselinesComplete });
    if (allGames.length > 0 && !rankBaselinesComplete) {
      const inferred = inferRankBaselinesFromGames(allGames);
      applyRankBaselinesFromSettings({ rankBaselines: inferred, rankBaselinesComplete: true });
      await saveSettings(ctx.getSettingsPayload(rankBaselinesForSettings()));
    }

    const ghostRemoved = await purgeGhostValorantMatches({ silent: true });
    if (ghostRemoved > 0) {
      showToast(`Removed ${ghostRemoved} invalid auto-log ${ghostRemoved === 1 ? 'match' : 'matches'}`);
    }
    const dupesRemoved = await collapseDuplicateValorantMatchesInState({ silent: true });
    if (dupesRemoved > 0) {
      showToast(`Removed ${dupesRemoved} duplicate ${dupesRemoved === 1 ? 'match' : 'matches'}`);
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
  }
}
