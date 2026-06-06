/** Rocket League navigation + page copy */

export const NAV = {
  home: {
    label: 'Home',
    icon: '🏠',
    defaultPage: 'dashboard',
    pages: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'log', label: 'Match Logs' },
      { id: 'sessions', label: 'Sessions' },
      { id: 'setup', label: 'Auto Setup' },
    ],
  },
  review: {
    label: 'Review',
    icon: '📊',
    defaultPage: 'focus',
    pages: [
      { id: 'focus', label: 'Focus' },
      { id: 'analytics', label: 'Analytics' },
      { id: 'reports', label: 'Reports' },
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
  log: { heading: 'Match Logs', desc: 'Log games from the dock below — filter, edit, or delete any match in your history.' },
  setup: { heading: 'Auto Tracker Setup', desc: 'One-time setup on your PC — run Twans Auto-Log while playing for automatic stats.' },
  focus: { heading: 'Focus', desc: 'What to work on — auto-generated from your tagged mistakes.' },
  sessions: { heading: 'Session History', desc: 'Every grind block — games, W/L, MMR change, and top mistake tags.' },
  analytics: { heading: 'Analytics', desc: 'Stats, trends, and coaching insights — defensive, offensive, and mental breakdown.' },
  reports: { heading: 'Weekly Reports', desc: 'Week-over-week MMR and mistake trends.' },
  group: { heading: 'Squad', desc: 'Compare progress with your squad.' },
};

export const ANALYTICS = {
  categoryTitle: 'Category Breakdown',
  bestModeLabel: 'Strongest Playlist',
  reviewDeclineTip: 'Win rate down {delta}% overall — review recent VODs or training pack.',
};
