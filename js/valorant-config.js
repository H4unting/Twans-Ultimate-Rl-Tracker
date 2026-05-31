/** Valorant-specific constants */

export const VAL_QUEUES = [
  { id: 'all', label: 'All Queues', mode: null },
  { id: 'comp', label: 'Competitive', mode: 'Competitive' },
  { id: 'unrated', label: 'Unrated', mode: 'Unrated' },
  { id: 'swift', label: 'Swiftplay', mode: 'Swiftplay' },
  { id: 'spike', label: 'Spike Rush', mode: 'Spike Rush' },
  { id: 'deathmatch', label: 'Deathmatch', mode: 'Deathmatch' },
];

export const VAL_AGENTS = [
  'Astra', 'Breach', 'Brimstone', 'Chamber', 'Clove', 'Cypher', 'Deadlock', 'Fade',
  'Gekko', 'Harbor', 'Iso', 'Jett', 'KAY/O', 'Killjoy', 'Neon', 'Omen', 'Phoenix',
  'Raze', 'Reyna', 'Sage', 'Skye', 'Sova', 'Tejo', 'Viper', 'Vyse', 'Waylay', 'Yoru',
];

export const VAL_MAPS = [
  'Ascent', 'Bind', 'Breeze', 'Fracture', 'Haven', 'Icebox', 'Lotus', 'Pearl', 'Split', 'Sunset', 'Abyss', 'Corrode',
];

export const VAL_TAG_DEFINITIONS = {
  'Bad Crosshair Placement': { cat: 'aim', id: 'bad_crosshair' },
  'Overpeeking': { cat: 'aim', id: 'overpeeking' },
  'Whiffed Easy Shots': { cat: 'aim', id: 'whiffed_shots' },
  'Bad Utility Timing': { cat: 'util', id: 'bad_util_timing' },
  'Wasted Utility': { cat: 'util', id: 'wasted_util' },
  'No Trade Support': { cat: 'team', id: 'no_trade' },
  'Bad Rotations': { cat: 'team', id: 'bad_rotations' },
  'Playing Alone': { cat: 'team', id: 'playing_alone' },
  'Tilt': { cat: 'men', id: 'tilt' },
  'Autopilot': { cat: 'men', id: 'autopilot' },
  'Ego Peek': { cat: 'men', id: 'ego_peek' },
  'Panic Swinging': { cat: 'men', id: 'panic_swing' },
};

export const VAL_TAG_COLORS = { aim: '#ff4655', util: '#00e5ff', team: '#7c3aed', men: '#a855f7' };

export const VAL_TAG_GROUPS = [
  { cat: 'aim', label: 'Aim', tags: Object.keys(VAL_TAG_DEFINITIONS).filter(t => VAL_TAG_DEFINITIONS[t].cat === 'aim') },
  { cat: 'util', label: 'Utility', tags: Object.keys(VAL_TAG_DEFINITIONS).filter(t => VAL_TAG_DEFINITIONS[t].cat === 'util') },
  { cat: 'team', label: 'Teamplay', tags: Object.keys(VAL_TAG_DEFINITIONS).filter(t => VAL_TAG_DEFINITIONS[t].cat === 'team') },
  { cat: 'men', label: 'Mental', tags: Object.keys(VAL_TAG_DEFINITIONS).filter(t => VAL_TAG_DEFINITIONS[t].cat === 'men') },
];

/** Rough RR swing when estimating before confirm */
export const VAL_DEFAULT_RR_SWING = { W: 18, L: -18 };

/** Coaching tips keyed by Valorant mistake tags */
export const VAL_ACTION_FOCUS_TIPS = {
  'Bad Crosshair Placement': 'Pre-aim common angles before you peek — crosshair at head height, not floor.',
  'Overpeeking': 'Jiggle peek for info; wide swing only when you have util or a trade lined up.',
  'Whiffed Easy Shots': 'Reset between fights — counter-strafe, then click. Don\'t spray transfer too early.',
  'Bad Utility Timing': 'Use util before the duel, not after you\'re already losing the fight.',
  'Wasted Utility': 'Every molly/flash should have a purpose — don\'t throw on cooldown.',
  'No Trade Support': 'Play within trade range of a teammate; if they die alone, you\'re next.',
  'Bad Rotations': 'Rotate early with info, not after the spike is already down.',
  'Playing Alone': 'Group for execs and retakes — isolated picks lose rounds.',
  'Tilt': 'Stop queue after two tilt-tagged losses. Deathmatch or break for 10 minutes.',
  'Autopilot': 'Call one focus for the next 3 rounds: trade, util, or crosshair only.',
  'Ego Peek': 'If you whiffed once, don\'t re-peek the same angle — rotate or use util.',
  'Panic Swinging': 'When low HP, play time and angles — don\'t wide swing for hero plays.',
};

/** Display labels for Valorant improvement pillars */
export const VAL_CATEGORY_LABELS = {
  aim: 'Aim',
  util: 'Utility',
  team: 'Teamplay',
  men: 'Mental',
};

export const VAL_CATEGORY_ORDER = ['aim', 'util', 'team', 'men'];
