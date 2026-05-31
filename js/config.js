/** App-wide constants — single source of truth for players, tags, and API config */

export const APP_NAME = 'Twans Ultimate Tracker';

export const SUPABASE_URL = 'https://pwuxocijdnuhhghufizn.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3dXhvY2lqZG51aGhnaHVmaXpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjUyNzMsImV4cCI6MjA5NTQwMTI3M30.FZocCo3mNOVkXXqmfYL0XVrUY6czUYuTTAq8vgBE1EU';

export const SCHEMA_VERSION = 5;

/** Legacy player IDs for one-time data import */
export const LEGACY_PLAYERS = [
  { id: 'anthony', name: 'Anthony', color: '#e65c00', cls: 'ant' },
  { id: 'trystan', name: 'Trystan', color: '#00e5ff', cls: 'try' },
];

/** @deprecated — use getUserDisplay() from state.js */
export const PLAYERS = LEGACY_PLAYERS;

export const PLAYLISTS = [
  { id: 'all', label: 'All Modes', mode: null },
  { id: '1s', label: "1's", mode: "1's" },
  { id: '2s', label: "2's", mode: "2's" },
  { id: '3s', label: "3's", mode: "3's" },
];

export const TAG_DEFINITIONS = {
  'Slow Rotations': { cat: 'def', id: 'slow_rotations' },
  'Bad Positioning': { cat: 'def', id: 'bad_positioning' },
  'Weak Recoveries': { cat: 'def', id: 'weak_recoveries' },
  'Double Commits': { cat: 'def', id: 'double_commits' },
  'Bad Shadow Defense': { cat: 'def', id: 'bad_shadow_defense' },
  'Overcommitting': { cat: 'off', id: 'overcommitting' },
  'Poor Shot Placement': { cat: 'off', id: 'poor_shot_placement' },
  'Giving Away Possession': { cat: 'off', id: 'giving_away_possession' },
  'Missed Open Nets': { cat: 'off', id: 'missed_open_nets' },
  'Tilt': { cat: 'men', id: 'tilt' },
  'Hesitation': { cat: 'men', id: 'hesitation' },
  'Panic Challenges': { cat: 'men', id: 'panic_challenges' },
  'Autopilot': { cat: 'men', id: 'autopilot' },
};

/** @deprecated Use TAG_DEFINITIONS[tag].cat — kept for backward compat */
export const TAG_CATS = Object.fromEntries(
  Object.entries(TAG_DEFINITIONS).map(([label, { cat }]) => [label, cat])
);

export const TAG_COLORS = { def: '#00e5ff', off: '#e65c00', men: '#a855f7' };

export const TAG_GROUPS = [
  { cat: 'def', label: 'Defensive', tags: Object.keys(TAG_DEFINITIONS).filter(t => TAG_DEFINITIONS[t].cat === 'def') },
  { cat: 'off', label: 'Offensive', tags: Object.keys(TAG_DEFINITIONS).filter(t => TAG_DEFINITIONS[t].cat === 'off') },
  { cat: 'men', label: 'Mental', tags: Object.keys(TAG_DEFINITIONS).filter(t => TAG_DEFINITIONS[t].cat === 'men') },
];

export const SEED_ANTHONY = [
  { date: '05/25/26', session: 1, match: 1, mode: "1's", result: 'L', goals: 4, assists: 0, saves: 3, startMMR: 809, endMMR: 797, mmrDiff: -12, notes: '', tags: [] },
  { date: '05/25/26', session: 1, match: 2, mode: "1's", result: 'W', goals: 4, assists: 0, saves: 1, startMMR: 797, endMMR: 807, mmrDiff: 10, notes: '', tags: [] },
  { date: '05/25/26', session: 1, match: 3, mode: "1's", result: 'W', goals: 13, assists: 0, saves: 1, startMMR: 807, endMMR: 817, mmrDiff: 10, notes: '', tags: [] },
  { date: '05/25/26', session: 1, match: 4, mode: "1's", result: 'L', goals: 2, assists: 0, saves: 4, startMMR: 817, endMMR: 807, mmrDiff: -10, notes: '', tags: [] },
  { date: '05/25/26', session: 1, match: 5, mode: "1's", result: 'W', goals: 5, assists: 0, saves: 3, startMMR: 807, endMMR: 817, mmrDiff: 10, notes: '', tags: [] },
  { date: '05/25/26', session: 1, match: 6, mode: "1's", result: 'W', goals: 5, assists: 0, saves: 1, startMMR: 817, endMMR: 827, mmrDiff: 10, notes: '', tags: [] },
  { date: '05/25/26', session: 1, match: 7, mode: "1's", result: 'L', goals: 6, assists: 0, saves: 2, startMMR: 827, endMMR: 817, mmrDiff: -10, notes: 'Gave away possesion way too much.', tags: ['Giving Away Possession'] },
  { date: '05/25/26', session: 1, match: 8, mode: "1's", result: 'L', goals: 6, assists: 0, saves: 2, startMMR: 817, endMMR: 807, mmrDiff: -10, notes: 'Got too comfortable.', tags: ['Autopilot'] },
  { date: '05/25/26', session: 1, match: 9, mode: "1's", result: 'W', goals: 5, assists: 0, saves: 2, startMMR: 807, endMMR: 817, mmrDiff: 10, notes: '', tags: [] },
  { date: '05/25/26', session: 1, match: 10, mode: "1's", result: 'W', goals: 7, assists: 0, saves: 5, startMMR: 817, endMMR: 826, mmrDiff: 9, notes: '', tags: [] },
  { date: '05/25/26', session: 1, match: 11, mode: "1's", result: 'L', goals: 8, assists: 0, saves: 2, startMMR: 826, endMMR: 817, mmrDiff: -9, notes: 'His words got into my head (disabled chat)', tags: ['Tilt'] },
  { date: '05/25/26', session: 1, match: 12, mode: "1's", result: 'W', goals: 4, assists: 0, saves: 0, startMMR: 817, endMMR: 826, mmrDiff: 9, notes: '', tags: [] },
  { date: '05/15/26', session: 1, match: 13, mode: "1's", result: 'W', goals: 11, assists: 0, saves: 5, startMMR: 826, endMMR: 835, mmrDiff: 9, notes: '', tags: [] },
];

export function getPlayerMeta(id) {
  return PLAYERS.find(p => p.id === id) ?? PLAYERS[0];
}
