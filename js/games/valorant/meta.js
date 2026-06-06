/** Valorant navigation + page copy */

export const NAV = {
  home: {
    label: 'Ops',
    icon: '◆',
    defaultPage: 'dashboard',
    pages: [
      { id: 'dashboard', label: 'Combat Report' },
      { id: 'log', label: 'Match History' },
      { id: 'sessions', label: 'Grind Blocks' },
      { id: 'focus', label: 'Mission Brief' },
      { id: 'setup', label: 'Auto-Log Setup' },
    ],
  },
  review: {
    label: 'Intel',
    icon: '📊',
    defaultPage: 'analytics',
    pages: [
      { id: 'analytics', label: 'Performance' },
      { id: 'reports', label: 'Rank Cycle' },
    ],
  },
  squad: {
    label: 'Squad',
    icon: '👥',
    defaultPage: 'group',
    pages: [{ id: 'group', label: 'Squad' }],
  },
};

export const PAGE_COPY = {
  log: { heading: 'Match History', desc: 'Every logged round — filter by queue, review K/D/A, RR swings, and mistake tags.' },
  setup: { heading: 'Auto-Log Setup', desc: 'Run Twans Auto-Log on your PC and connect Riot ID + Henrik API key for automatic match logging.' },
  focus: { heading: 'Mission Brief', desc: 'Your top leaks — aim, utility, teamplay, and mental — from tagged losses.' },
  sessions: { heading: 'Grind Blocks', desc: 'Session-by-session RR, W/L, and which improvement pillars showed up.' },
  analytics: { heading: 'Performance Intel', desc: 'Aim · Utility · Teamplay · Mental — where your mistakes cluster.' },
  reports: { heading: 'Rank Cycle', desc: 'Weekly RR movement and improvement pillar trends.' },
  group: { heading: 'Squad', desc: 'Stack up against your squad — RR and win rate by queue.' },
};

export const ANALYTICS = {
  categoryTitle: 'Improvement Pillars',
  bestModeLabel: 'Best Queue',
  reviewDeclineTip: 'Win rate down {delta}% — review death replays or run a DM warmup.',
};
