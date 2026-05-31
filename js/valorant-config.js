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
