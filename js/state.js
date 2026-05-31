/** Central app state — auth-first, single-user by default */

import { DEFAULT_GOALS } from './goals.js';
import { DEFAULT_GAME, GAME_IDS, filterGamesByTitle } from './games.js';

export const state = {
  authReady: false,
  profile: null,
  games: [],
  activeGame: DEFAULT_GAME,
  loading: true,
  syncStatus: 'connecting',
  activePage: 'dashboard',
  homeChartMode: null,
  playlist: 'all',
  filters: {
    dateFrom: '',
    dateTo: '',
    playlist: 'all',
    session: '',
    tags: [],
    result: 'all',
  },
  matchLogFilters: {
    dateFrom: '',
    dateTo: '',
    playlist: 'all',
    session: '',
    tags: [],
    result: 'all',
  },
  session: {
    active: false,
    startTime: null,
    startMMR: null,
    sessionNum: 1,
    timerId: null,
  },
  ui: {
    selectedTags: [],
    editTags: [],
    editingMatch: null,
    currentResult: 'W',
  },
  goals: { ...DEFAULT_GOALS },
  profileBio: '',
  reportsWeekOffset: 0,
  groups: [],
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(partial = {}) {
  Object.assign(state, partial);
  listeners.forEach(fn => fn(state));
}

export function setSyncStatus(status) {
  state.syncStatus = status;
  notify();
}

export function setGames(games) {
  state.games = games;
  state.loading = false;
  notify();
}

export function setProfile(profile) {
  state.profile = profile;
  notify();
}

export function setGoals(goals) {
  state.goals = goals;
  notify();
}

export function setActiveGame(gameId) {
  state.activeGame = gameId;
  notify();
}

/** Matches for the currently selected title. */
export function getActiveGames() {
  return filterGamesByTitle(state.games, state.activeGame);
}

/** Replace active-title slice while keeping other games intact. */
export function mergeActiveGames(activeSlice) {
  const rest = state.games.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) !== state.activeGame);
  const tagged = activeSlice.map(g => ({ ...g, game: state.activeGame }));
  return [...rest, ...tagged];
}

export function getUserDisplay(authUser) {
  const p = state.profile;
  const u = authUser;
  return {
    name: p?.display_name || u?.user_metadata?.full_name || u?.user_metadata?.name || u?.email?.split('@')[0] || 'Player',
    avatar: p?.avatar_url || u?.user_metadata?.avatar_url || u?.user_metadata?.picture || null,
    color: p?.primary_color || p?.accent_color || '#e65c00',
  };
}
