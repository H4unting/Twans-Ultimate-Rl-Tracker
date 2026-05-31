/** App-wide constants — single source of truth for players, tags, and API config */

export const APP_NAME = 'Twans Ultimate Tracker';

/** Small PC app — run while playing so stats auto-fill (tray icon, no black window) */
export const DESKTOP_APP = {
  name: 'Twans Auto-Log',
  exe: 'Twans Auto-Log.exe',
  /** Older builds used this filename — still works if you have it */
  legacyExe: 'Twans-Tracker-Bridge.exe',
  shortName: 'auto-log app',
  whatItDoes: 'Runs on your PC while you play and sends match stats to the tracker',
};

/** Open this on your gaming PC — auto-log cannot reach localhost from the GitHub Pages HTTPS bookmark */
export const LOCAL_TRACKER_URL = 'http://localhost:8080';

export const SUPABASE_URL = 'https://pwuxocijdnuhhghufizn.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3dXhvY2lqZG51aGhnaHVmaXpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjUyNzMsImV4cCI6MjA5NTQwMTI3M30.FZocCo3mNOVkXXqmfYL0XVrUY6czUYuTTAq8vgBE1EU';

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

export const RL_CATEGORY_LABELS = { def: 'Defensive', off: 'Offensive', men: 'Mental' };
export const RL_CATEGORY_ORDER = ['def', 'off', 'men'];

export const RL_ACTION_FOCUS_TIPS = {
  'Giving Away Possession': 'Slow down before clearing — look for a safe pass or controlled touch first.',
  'Bad Positioning': 'Stay goal-side of the play and rotate back post when your teammate commits.',
  'Overcommitting': 'One challenges, one covers. Ask "am I last back?" before going.',
  'Weak Recoveries': 'Land on wheels facing the play. Boost to corner before challenging again.',
  'Tilt': 'Take a breath between games. Queue only when you can tag honestly.',
  'Autopilot': 'Pick one thing to focus on for the next 3 games only.',
  'Hesitation': 'Commit faster when you have the beat — half-challenges lose every time.',
  'Slow Rotations': 'Rotate wide and back — don\'t cut through the middle under pressure.',
  'Double Commits': 'Call "I got it" or "you" — only one touches the ball.',
  'Bad Shadow Defense': 'Shadow at an angle that covers both shot and pass.',
  'Poor Shot Placement': 'Aim corners — force a save or a awkward clear, not a free outlet.',
  'Missed Open Nets': 'Slow down on open nets; placement beats power.',
  'Panic Challenges': 'Last back doesn\'t challenge — cover the net and force a pass.',
};
