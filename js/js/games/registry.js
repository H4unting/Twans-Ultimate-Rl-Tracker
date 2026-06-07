/** Multi-game registry — composes RL + Val modules without cross-contamination */

import * as RL from './rocketleague/index.js';
import * as VAL from './valorant/index.js';

export const GAME_IDS = {
  ROCKET_LEAGUE: RL.GAME_ID,
  VALORANT: VAL.GAME_ID,
};

export const GAMES = {
  [GAME_IDS.ROCKET_LEAGUE]: RL.META,
  [GAME_IDS.VALORANT]: VAL.META,
};

export const DEFAULT_GAME = GAME_IDS.ROCKET_LEAGUE;

const MODULES = {
  [GAME_IDS.ROCKET_LEAGUE]: RL,
  [GAME_IDS.VALORANT]: VAL,
};

export function getGameModule(gameId = DEFAULT_GAME) {
  return MODULES[gameId] ?? MODULES[DEFAULT_GAME];
}

export function getGameMeta(gameId = DEFAULT_GAME) {
  return GAMES[gameId] ?? GAMES[DEFAULT_GAME];
}

export function isValidGameId(id) {
  return id === GAME_IDS.ROCKET_LEAGUE || id === GAME_IDS.VALORANT;
}

export function getTagDefinitions(gameId = DEFAULT_GAME) {
  return getGameModule(gameId).TAG_DEFINITIONS;
}

export function getTagGroups(gameId = DEFAULT_GAME) {
  return getGameModule(gameId).TAG_GROUPS;
}

export function getTagColors(gameId = DEFAULT_GAME) {
  return getGameModule(gameId).TAG_COLORS;
}

export function getPlaylists(gameId = DEFAULT_GAME) {
  return getGameModule(gameId).PLAYLISTS;
}

export function getAgents(gameId = DEFAULT_GAME) {
  return getGameModule(gameId).getAgents();
}

export function getMaps(gameId = DEFAULT_GAME) {
  return getGameModule(gameId).getMaps();
}

export function getDefaultMode(gameId = DEFAULT_GAME) {
  return getGameMeta(gameId).defaultMode;
}

export function filterGamesByTitle(games, gameId) {
  return (games ?? []).filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) === gameId);
}

export function getRankValue(game, gameId = game?.game ?? DEFAULT_GAME) {
  return getGameModule(gameId).getRankValue(game);
}

export function getRankDiff(game, gameId = game?.game ?? DEFAULT_GAME) {
  return getGameModule(gameId).getRankDiff(game);
}

export function getGameRankStart(game, gameId = game?.game ?? DEFAULT_GAME) {
  const field = getGameMeta(gameId).startRankField ?? 'startMMR';
  const val = game?.[field];
  return val == null || val === '' ? '' : val;
}

export function sessionGroupKey(game) {
  const sn = parseInt(game?.session, 10) || 1;
  return `${sn}|${game?.date ?? ''}`;
}

export const NAV_BY_GAME = {
  [GAME_IDS.ROCKET_LEAGUE]: RL.NAV,
  [GAME_IDS.VALORANT]: VAL.NAV,
};

export const PAGE_COPY = {
  [GAME_IDS.ROCKET_LEAGUE]: RL.PAGE_COPY,
  [GAME_IDS.VALORANT]: VAL.PAGE_COPY,
};

export function getNavSections(gameId = DEFAULT_GAME) {
  return NAV_BY_GAME[gameId] ?? NAV_BY_GAME[DEFAULT_GAME];
}

export function getPageCopy(pageId, gameId = DEFAULT_GAME) {
  return PAGE_COPY[gameId]?.[pageId] ?? PAGE_COPY[DEFAULT_GAME]?.[pageId] ?? null;
}

export function getCategoryLabels(gameId = DEFAULT_GAME) {
  return getGameModule(gameId).CATEGORY_LABELS;
}

export function getCategoryOrder(gameId = DEFAULT_GAME) {
  return getGameModule(gameId).CATEGORY_ORDER;
}

export function getActionFocusTips(gameId = DEFAULT_GAME) {
  return getGameModule(gameId).ACTION_FOCUS_TIPS;
}

export function getTagCat(tag, gameId = DEFAULT_GAME) {
  return getGameModule(gameId).getTagCat(tag);
}

export function filterByPlaylist(games, playlist, gameId = DEFAULT_GAME) {
  return getGameModule(gameId).filterByPlaylist(games, playlist);
}

export { RL, VAL, MODULES };
