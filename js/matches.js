/** Match CRUD — current user's games only */

import { state, setGames } from './state.js';
import { formatDisplayDate, normalizeGame, getPriorEndMMRForMode, resolveGameStartMMR } from './utils.js';
import { saveGames } from './supabase.js';
import { showToast } from './ui.js';
import { refreshSessionUI } from './sessions.js';
import { getAuthUser } from './auth.js';

function requireSignedIn() {
  if (!getAuthUser()) {
    showToast('Sign in to save games', 'error');
    return false;
  }
  return true;
}

export async function addGame(formData, selectedTags, onSuccess) {
  if (!requireSignedIn()) return null;
  const games = JSON.parse(JSON.stringify(state.games));
  const d = formData.date ? new Date(formData.date + 'T12:00:00') : new Date();
  const endMMR = parseInt(formData.endMMR, 10) || 0;
  const draft = {
    match: games.length + 1,
    mode: formData.mode,
    result: formData.result,
    endMMR,
    startMMR: parseInt(formData.startMMR, 10) || 0,
  };
  const startMMR = resolveGameStartMMR(games, draft);

  const game = normalizeGame({
    date: formatDisplayDate(d),
    session: parseInt(formData.session, 10) || 1,
    match: draft.match,
    mode: draft.mode,
    result: draft.result,
    goals: parseInt(formData.goals, 10) || 0,
    assists: parseInt(formData.assists, 10) || 0,
    saves: parseInt(formData.saves, 10) || 0,
    startMMR, endMMR,
    mmrDiff: endMMR - startMMR,
    notes: formData.notes?.trim() ?? '',
    tags: [...selectedTags],
  });

  games.push(game);
  await saveGames(games);
  setGames(games);
  showToast(`Game logged! ${game.mmrDiff >= 0 ? '+' : ''}${game.mmrDiff} MMR`);
  refreshSessionUI();
  if (onSuccess) onSuccess(game);
  return game;
}

export async function updateGame(matchNum, formData, selectedTags) {
  if (!requireSignedIn()) return;
  const games = JSON.parse(JSON.stringify(state.games));
  const idx = games.findIndex(g => g.match === matchNum);
  if (idx === -1) throw new Error('Game not found');

  const d = formData.date ? new Date(formData.date + 'T12:00:00') : new Date();
  const endMMR = parseInt(formData.endMMR, 10) || 0;
  const draft = {
    ...games[idx],
    mode: formData.mode,
    result: formData.result,
    endMMR,
    startMMR: parseInt(formData.startMMR, 10) || 0,
  };
  const startMMR = resolveGameStartMMR(games.filter((_, i) => i !== idx), draft);

  games[idx] = normalizeGame({
    ...games[idx],
    date: formatDisplayDate(d),
    session: parseInt(formData.session, 10) || 1,
    mode: draft.mode,
    result: draft.result,
    goals: parseInt(formData.goals, 10) || 0,
    assists: parseInt(formData.assists, 10) || 0,
    saves: parseInt(formData.saves, 10) || 0,
    startMMR, endMMR,
    mmrDiff: endMMR - startMMR,
    notes: formData.notes?.trim() ?? '',
    tags: [...selectedTags],
  });

  await saveGames(games);
  setGames(games);
  showToast('Game updated!');
  return games[idx];
}

export async function patchLastGame({ endMMR, tags, notes }) {
  if (!requireSignedIn()) return null;
  const games = JSON.parse(JSON.stringify(state.games));
  if (!games.length) return null;
  const idx = games.length - 1;
  const g = { ...games[idx] };

  if (endMMR != null) {
    g.endMMR = endMMR;
    g.startMMR = resolveGameStartMMR(games.slice(0, idx), { ...g, endMMR });
    g.mmrDiff = endMMR - g.startMMR;
    g.notes = (g.notes || '').replace(/MMR estimated/g, '').replace(/\s·\s·/g, ' · ').trim();
  }
  if (tags) g.tags = [...tags];
  if (notes !== undefined) g.notes = notes;

  games[idx] = normalizeGame(g);
  await saveGames(games);
  setGames(games);
  refreshSessionUI();
  return games[idx];
}

export async function undoLastGame(skipConfirm = false) {
  if (!requireSignedIn()) return false;
  if (!state.games.length) return false;
  if (!skipConfirm && !confirm('Remove the last logged game?')) return false;

  const games = state.games.slice(0, -1);
  games.forEach((g, i) => { g.match = i + 1; });
  await saveGames(games);
  setGames(games);
  refreshSessionUI();
  showToast('Last game removed');
  return true;
}

export async function deleteGame(matchNum) {
  if (!requireSignedIn()) return false;
  if (!confirm('Delete this game?')) return false;
  const games = state.games.filter(g => g.match !== matchNum);
  games.forEach((g, i) => { g.match = i + 1; });
  await saveGames(games);
  setGames(games);
  showToast('Game deleted');
  return true;
}

export function getLastMMR(mode) {
  if (!mode) return '';
  const end = getPriorEndMMRForMode(state.games, mode);
  return end != null ? end : '';
}

export function isMmrEstimated(game) {
  return (game?.notes || '').includes('MMR estimated');
}

export function lastGameNeedsMmrConfirm(games = state.games) {
  if (!games.length) return false;
  return isMmrEstimated(games[games.length - 1]);
}
