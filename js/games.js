/** Multi-game registry — Rocket League + Valorant on one tracker */

import { TAG_DEFINITIONS as RL_TAG_DEFINITIONS, TAG_GROUPS as RL_TAG_GROUPS, TAG_COLORS as RL_TAG_COLORS, PLAYLISTS as RL_PLAYLISTS, RL_CATEGORY_LABELS, RL_CATEGORY_ORDER, RL_ACTION_FOCUS_TIPS } from './config.js';
import {
  VAL_QUEUES, VAL_AGENTS, VAL_MAPS,
  VAL_TAG_DEFINITIONS, VAL_TAG_GROUPS, VAL_TAG_COLORS,
  VAL_CATEGORY_LABELS, VAL_CATEGORY_ORDER, VAL_ACTION_FOCUS_TIPS,
} from './valorant-config.js';

export const GAME_IDS = {
  ROCKET_LEAGUE: 'rocket_league',
  VALORANT: 'valorant',
};

export const GAMES = {
  [GAME_IDS.ROCKET_LEAGUE]: {
    id: GAME_IDS.ROCKET_LEAGUE,
    label: 'Rocket League',
    shortLabel: 'RL',
    emoji: '🚗',
    rankLabel: 'MMR',
    rankField: 'endMMR',
    diffLabel: 'MMR',
    bridgeLabel: 'Rocket League',
    defaultMode: "2's",
  },
  [GAME_IDS.VALORANT]: {
    id: GAME_IDS.VALORANT,
    label: 'Valorant',
    shortLabel: 'VAL',
    emoji: '◆',
    rankLabel: 'RR',
    rankField: 'endRR',
    diffLabel: 'RR',
    bridgeLabel: 'Valorant',
    defaultMode: 'Competitive',
  },
};

export const DEFAULT_GAME = GAME_IDS.ROCKET_LEAGUE;

export function getGameMeta(gameId = DEFAULT_GAME) {
  return GAMES[gameId] ?? GAMES[DEFAULT_GAME];
}

export function isValidGameId(id) {
  return id === GAME_IDS.ROCKET_LEAGUE || id === GAME_IDS.VALORANT;
}

export function getTagDefinitions(gameId = DEFAULT_GAME) {
  return gameId === GAME_IDS.VALORANT ? VAL_TAG_DEFINITIONS : RL_TAG_DEFINITIONS;
}

export function getTagGroups(gameId = DEFAULT_GAME) {
  return gameId === GAME_IDS.VALORANT ? VAL_TAG_GROUPS : RL_TAG_GROUPS;
}

export function getTagColors(gameId = DEFAULT_GAME) {
  return gameId === GAME_IDS.VALORANT ? VAL_TAG_COLORS : RL_TAG_COLORS;
}

export function getPlaylists(gameId = DEFAULT_GAME) {
  return gameId === GAME_IDS.VALORANT ? VAL_QUEUES : RL_PLAYLISTS;
}

export function getAgents() {
  return VAL_AGENTS;
}

export function getMaps() {
  return VAL_MAPS;
}

export function getDefaultMode(gameId = DEFAULT_GAME) {
  return getGameMeta(gameId).defaultMode;
}

/** Games belonging to the active title (legacy rows default to RL). */
export function filterGamesByTitle(games, gameId) {
  return (games ?? []).filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) === gameId);
}

export function getRankValue(game, gameId = game?.game ?? DEFAULT_GAME) {
  if (gameId === GAME_IDS.VALORANT) return game?.endRR ?? game?.endMMR ?? 0;
  return game?.endMMR ?? 0;
}

export function getRankDiff(game, gameId = game?.game ?? DEFAULT_GAME) {
  if (gameId === GAME_IDS.VALORANT) return game?.rrDiff ?? game?.mmrDiff ?? 0;
  return game?.mmrDiff ?? 0;
}

/** Per-game navigation — tabs match each title's workflow */
export const NAV_BY_GAME = {
  [GAME_IDS.ROCKET_LEAGUE]: {
    home: {
      label: 'Home',
      icon: '🏠',
      defaultPage: 'dashboard',
      pages: [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'log', label: 'Match Logs' },
        { id: 'setup', label: 'Auto Setup' },
        { id: 'focus', label: 'Focus' },
      ],
    },
    review: {
      label: 'Review',
      icon: '📊',
      defaultPage: 'analytics',
      pages: [
        { id: 'sessions', label: 'Sessions' },
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
  },
  [GAME_IDS.VALORANT]: {
    home: {
      label: 'Ops',
      icon: '◆',
      defaultPage: 'dashboard',
      pages: [
        { id: 'dashboard', label: 'Combat Report' },
        { id: 'log', label: 'Match History' },
        { id: 'focus', label: 'Mission Brief' },
        { id: 'setup', label: 'Auto-Log Setup' },
      ],
    },
    review: {
      label: 'Intel',
      icon: '📊',
      defaultPage: 'analytics',
      pages: [
        { id: 'sessions', label: 'Grind Blocks' },
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
  },
};

/** Page headings + descriptions per game */
export const PAGE_COPY = {
  [GAME_IDS.ROCKET_LEAGUE]: {
    log: { heading: 'Match Logs', desc: 'Log games from the dock below — filter, edit, or delete any match in your history.' },
    setup: { heading: 'Auto Tracker Setup', desc: 'One-time setup on your PC — run Twans Auto-Log while playing for automatic stats.' },
    focus: { heading: 'Focus', desc: 'What to work on — auto-generated from your tagged mistakes.' },
    sessions: { heading: 'Session History', desc: 'Every grind block — games, W/L, MMR change, and top mistake tags.' },
    analytics: { heading: 'Analytics', desc: 'Stats, trends, and coaching insights — defensive, offensive, and mental breakdown.' },
    reports: { heading: 'Weekly Reports', desc: 'Week-over-week MMR and mistake trends.' },
    group: { heading: 'Squad', desc: 'Compare progress with your squad.' },
  },
  [GAME_IDS.VALORANT]: {
    log: { heading: 'Match History', desc: 'Every logged round — filter by queue, review K/D/A, RR swings, and mistake tags.' },
    setup: { heading: 'Auto-Log Setup', desc: 'Run Twans Auto-Log on your PC and connect Riot ID + API key for automatic match logging.' },
    focus: { heading: 'Mission Brief', desc: 'Your top leaks — aim, utility, teamplay, and mental — from tagged losses.' },
    sessions: { heading: 'Grind Blocks', desc: 'Session-by-session RR, W/L, and which improvement pillars showed up.' },
    analytics: { heading: 'Performance Intel', desc: 'Aim · Utility · Teamplay · Mental — where your mistakes cluster.' },
    reports: { heading: 'Rank Cycle', desc: 'Weekly RR movement and improvement pillar trends.' },
    group: { heading: 'Squad', desc: 'Stack up against your squad — RR and win rate by queue.' },
  },
};

export function getNavSections(gameId = DEFAULT_GAME) {
  return NAV_BY_GAME[gameId] ?? NAV_BY_GAME[DEFAULT_GAME];
}

export function getPageCopy(pageId, gameId = DEFAULT_GAME) {
  return PAGE_COPY[gameId]?.[pageId] ?? PAGE_COPY[DEFAULT_GAME]?.[pageId] ?? null;
}

export function getCategoryLabels(gameId = DEFAULT_GAME) {
  return gameId === GAME_IDS.VALORANT ? VAL_CATEGORY_LABELS : RL_CATEGORY_LABELS;
}

export function getCategoryOrder(gameId = DEFAULT_GAME) {
  return gameId === GAME_IDS.VALORANT ? VAL_CATEGORY_ORDER : RL_CATEGORY_ORDER;
}

export function getActionFocusTips(gameId = DEFAULT_GAME) {
  return gameId === GAME_IDS.VALORANT ? VAL_ACTION_FOCUS_TIPS : RL_ACTION_FOCUS_TIPS;
}

/** Resolve tag → category for the active game */
export function getTagCat(tag, gameId = DEFAULT_GAME) {
  return getTagDefinitions(gameId)[tag]?.cat ?? (gameId === GAME_IDS.VALORANT ? 'aim' : 'def');
}
