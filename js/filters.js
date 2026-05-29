/** Scalable filter engine — pure functions, composable predicates */

import { parseDisplayDate } from './utils.js';

export const DEFAULT_FILTERS = {
  dateFrom: '',
  dateTo: '',
  playlist: 'all',
  session: '',
  tags: [],
  result: 'all',
};

const PLAYLIST_MAP = { '1s': "1's", '2s': "2's", '3s': "3's" };

/** Individual filter predicates — easy to add new ones */
const predicates = {
  dateFrom: (g, v) => !v || (parseDisplayDate(g.date) >= new Date(v)),
  dateTo: (g, v) => !v || (parseDisplayDate(g.date) <= new Date(v + 'T23:59:59')),
  playlist: (g, v) => !v || v === 'all' || g.mode === PLAYLIST_MAP[v],
  session: (g, v) => !v || g.session === parseInt(v, 10),
  tags: (g, v) => !v?.length || v.some(t => (g.tags || []).includes(t)),
  result: (g, v) => !v || v === 'all' || g.result === v,
};

/** Apply all active filters in one pass */
export function applyFilters(games, filters = DEFAULT_FILTERS) {
  const active = Object.entries(filters).filter(([, v]) => {
    if (Array.isArray(v)) return v.length > 0;
    return v !== '' && v != null && v !== 'all';
  });
  if (!active.length) return games;
  return games.filter(g => active.every(([key, val]) => predicates[key]?.(g, val) ?? true));
}

export function hasActiveFilters(filters) {
  return !!(filters.dateFrom || filters.dateTo || filters.session
    || filters.tags?.length
    || (filters.result && filters.result !== 'all')
    || (filters.playlist && filters.playlist !== 'all'));
}

export function resetFilters() {
  return { ...DEFAULT_FILTERS };
}

export function getUniqueSessions(games) {
  const sessions = new Map();
  games.forEach(g => {
    const key = `${g.session}|${g.date}`;
    if (!sessions.has(key)) sessions.set(key, { session: g.session, date: g.date, label: `Session ${g.session} · ${g.date}` });
  });
  return [...sessions.values()].sort((a, b) => b.session - a.session);
}
