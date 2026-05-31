/** Multi-game registry — Rocket League + Valorant on one tracker */

import { TAG_DEFINITIONS as RL_TAG_DEFINITIONS, TAG_GROUPS as RL_TAG_GROUPS, TAG_COLORS as RL_TAG_COLORS, PLAYLISTS as RL_PLAYLISTS } from './config.js';
import {
  VAL_QUEUES, VAL_AGENTS, VAL_MAPS,
  VAL_TAG_DEFINITIONS, VAL_TAG_GROUPS, VAL_TAG_COLORS,
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
