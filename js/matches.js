/** Match CRUD — delegates game-specific build/normalize to active game module */

import { state, setGames, getActiveGames, mergeActiveGames } from './state.js';
import { normalizeGame } from './utils.js';
import { saveGames } from './supabase.js';
import { showToast } from './ui.js';
import { getAuthUser } from './auth.js';
import { getRankDiff, GAME_IDS } from './games.js';
import { getGameModule } from './games/registry.js';
import { getActiveGameModule } from './games/router.js';

function notifySessionUIRefresh() {
  void import('./sessions.js').then(m => m.refreshSessionUI());
}

function requireSignedIn() {
  if (!getAuthUser()) {
    showToast('Sign in to save games', 'error');
    return false;
  }
  return true;
}

async function persistActiveGames(activeGames) {
  const merged = mergeActiveGames(activeGames);
  await saveGames(merged, state.activeGame);
  setGames(merged);
}

export async function addGame(formData, selectedTags, onSuccess) {
  if (!requireSignedIn()) return null;
  const mod = getActiveGameModule();
  const games = JSON.parse(JSON.stringify(getActiveGames()));
  const game = mod.buildGameFromForm(formData, games, selectedTags);
  games.push(game);
  await persistActiveGames(games);
  const diff = getRankDiff(game, state.activeGame);
  showToast(`${mod.META.matchSingularCap} logged! ${diff >= 0 ? '+' : ''}${diff} ${mod.META.diffLabel}`);
  notifySessionUIRefresh();
  if (onSuccess) onSuccess(game);
  return game;
}

export async function updateGame(matchNum, formData, selectedTags) {
  if (!requireSignedIn()) return;
  const mod = getActiveGameModule();
  const games = JSON.parse(JSON.stringify(getActiveGames()));
  const idx = games.findIndex(g => g.match === matchNum);
  if (idx === -1) throw new Error('Game not found');
  games[idx] = mod.buildGameUpdate(formData, games, idx, selectedTags);
  await persistActiveGames(games);
  showToast(`${mod.META.matchSingularCap} updated!`);
  return games[idx];
}

export async function patchLastGame({ endMMR, endRR, tags, notes }) {
  if (!requireSignedIn()) return null;
  const mod = getActiveGameModule();
  const games = JSON.parse(JSON.stringify(getActiveGames()));
  if (!games.length) return null;
  const idx = games.length - 1;
  let g = { ...games[idx] };
  const endRank = endRR ?? endMMR;

  if (endRank != null) {
    g = mod.patchLastGameRank(g, games, idx, endRank);
  }
  if (tags) g.tags = [...tags];
  if (notes !== undefined) g.notes = notes;

  games[idx] = normalizeGame({ ...g, game: state.activeGame });
  await persistActiveGames(games);
  notifySessionUIRefresh();
  return games[idx];
}

export async function undoLastGame(skipConfirm = false) {
  if (!requireSignedIn()) return false;
  const mod = getActiveGameModule();
  const active = getActiveGames();
  if (!active.length) return false;
  if (!skipConfirm && !confirm(`Remove the last logged ${mod.META.matchSingular}?`)) return false;

  const games = active.slice(0, -1);
  games.forEach((g, i) => { g.match = i + 1; });
  await persistActiveGames(games);
  notifySessionUIRefresh();
  showToast(`Last ${mod.META.matchSingular} removed`);
  return true;
}

export async function deleteGame(matchNum) {
  if (!requireSignedIn()) return false;
  const mod = getActiveGameModule();
  if (!confirm(`Delete this ${mod.META.matchSingular}?`)) return false;
  const games = getActiveGames().filter(g => g.match !== matchNum);
  games.forEach((g, i) => { g.match = i + 1; });
  await persistActiveGames(games);
  showToast(`${mod.META.matchSingularCap} deleted`);
  return true;
}

/** Remove every logged match for one game (e.g. bad auto-log batch). Other games untouched. */
export async function clearGameHistory(gameId = state.activeGame) {
  if (!requireSignedIn()) return false;
  const mod = getGameModule(gameId);
  const active = state.games.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) === gameId);
  if (!active.length) {
    showToast(`No ${mod.META.matchSingular}s to clear`, 'error');
    return false;
  }
  const label = `${active.length} Val ${mod.META.matchSingular}${active.length === 1 ? '' : 'es'}`;
  if (!confirm(`Delete all ${label}? This cannot be undone. Your other game data stays.`)) return false;

  await saveGames([], gameId);
  const rest = state.games.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) !== gameId);
  setGames(rest);
  notifySessionUIRefresh();
  showToast(`Cleared ${active.length} ${mod.META.matchSingular}${active.length === 1 ? '' : 'es'}`);
  return true;
}

export function getLastMMR(mode) {
  if (!mode) return '';
  const mod = getActiveGameModule();
  const end = mod.getPriorEndRank(getActiveGames(), mode);
  return end != null ? end : '';
}

export function isMmrEstimated(game) {
  return getActiveGameModule().isRankEstimated(game);
}

export function lastGameNeedsMmrConfirm(games = getActiveGames()) {
  if (!games.length) return false;
  return isMmrEstimated(games[games.length - 1]);
}
