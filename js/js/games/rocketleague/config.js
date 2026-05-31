/** Rocket League — playlists, tags, coaching tips */

export const GAME_ID = 'rocket_league';

export const PLAYLISTS = [
  { id: 'all', label: 'All Modes', mode: null },
  { id: '1s', label: "1's", mode: "1's" },
  { id: '2s', label: "2's", mode: "2's" },
  { id: '3s', label: "3's", mode: "3's" },
];

export const MODES = ["1's", "2's", "3's"];

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

export const TAG_COLORS = { def: '#00e5ff', off: '#e65c00', men: '#a855f7' };

export const TAG_GROUPS = [
  { cat: 'def', label: 'Defensive', tags: Object.keys(TAG_DEFINITIONS).filter(t => TAG_DEFINITIONS[t].cat === 'def') },
  { cat: 'off', label: 'Offensive', tags: Object.keys(TAG_DEFINITIONS).filter(t => TAG_DEFINITIONS[t].cat === 'off') },
  { cat: 'men', label: 'Mental', tags: Object.keys(TAG_DEFINITIONS).filter(t => TAG_DEFINITIONS[t].cat === 'men') },
];

export const CATEGORY_LABELS = { def: 'Defensive', off: 'Offensive', men: 'Mental' };
export const CATEGORY_ORDER = ['def', 'off', 'men'];

export const ACTION_FOCUS_TIPS = {
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

export const META = {
  id: GAME_ID,
  label: 'Rocket League',
  shortLabel: 'RL',
  emoji: '🚗',
  rankLabel: 'MMR',
  rankField: 'endMMR',
  startRankField: 'startMMR',
  diffLabel: 'MMR',
  diffField: 'mmrDiff',
  bridgeLabel: 'Rocket League',
  defaultMode: "2's",
  matchSingular: 'game',
  matchSingularCap: 'Game',
  estimatedNote: 'MMR estimated',
  quickEndInputId: 'quick-endmmr',
  formEndField: 'endMMR',
  formStartField: 'startMMR',
};

export const PLAYLIST_ID_MAP = { '1s': "1's", '2s': "2's", '3s': "3's" };

export function filterByPlaylist(games, playlist) {
  if (!playlist || playlist === 'all') return games;
  const mode = PLAYLIST_ID_MAP[playlist];
  return mode ? games.filter(g => g.mode === mode) : games;
}

export function getRankValue(game) {
  return game?.endMMR ?? 0;
}

export function getRankDiff(game) {
  return game?.mmrDiff ?? 0;
}

export function getPriorEndRank(games, mode, beforeMatch = Infinity) {
  for (let i = games.length - 1; i >= 0; i--) {
    const g = games[i];
    if (g.match >= beforeMatch) continue;
    if (g.mode === mode && g.endMMR != null && g.endMMR !== '') return g.endMMR;
  }
  return null;
}

export function isRankEstimated(game) {
  return (game?.notes || '').includes(META.estimatedNote);
}
