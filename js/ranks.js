/** Rank UI facade — delegates to the active game's rank module */

import { state } from './core/state.js';
import { getGameModule, DEFAULT_GAME } from './games/registry.js';

function activeMod(gameId) {
  return getGameModule(gameId ?? state.activeGame ?? DEFAULT_GAME);
}

export function getRank(value, mode) {
  return activeMod().getRank(value, mode);
}

export function getRankForPlaylist(value, playlist) {
  return activeMod().getRankForPlaylist(value, playlist);
}

export function getRankIconKey(name) {
  return activeMod().getRankIconKey?.(name) ?? '';
}

export function getRankIconSrc(name) {
  return activeMod().getRankIconSrc?.(name) ?? '';
}

export function rankIconHTML(rankOrName, size = 20) {
  return activeMod().rankIconHTML(rankOrName, size);
}

export function rankSVG(tier, size = 20) {
  return activeMod().rankSVG?.(tier, size) ?? '';
}

export function rankBadgeHTML(value, size = 18, mode) {
  return activeMod().rankBadgeHTML(value, size, mode);
}

/** Rocket League tables — import explicitly when you need RL-only data */
export { RANK_DATA } from './games/rocketleague/ranks.js';
