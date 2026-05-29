/** Central app state — single source of truth with lightweight pub/sub */

import { PLAYERS } from './config.js';

const playerIds = PLAYERS.map(p => p.id);

export const state = {
  data: Object.fromEntries(playerIds.map(id => [id, []])),
  loading: true,
  syncStatus: 'connecting',
  activePage: 'dashboard',
  logPlayer: playerIds[0],
  analyticsPlayer: playerIds[0],
  playerPlaylist: Object.fromEntries(playerIds.map(id => [id, 'all'])),
  filters: {
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
    player: playerIds[0],
    sessionNum: 1,
    timerId: null,
  },
  ui: {
    selectedTags: [],
    editTags: [],
    editingPlayer: null,
    editingMatch: null,
    currentResult: 'W',
  },
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

export function setData(data) {
  state.data = data;
  state.loading = false;
  notify();
}
