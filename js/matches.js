/** Match CRUD — current user's games only */

import { state, setGames } from './state.js';
import { formatDisplayDate, normalizeGame } from './utils.js';
import { saveGames } from './supabase.js';
import { showToast } from './ui.js';
import { refreshSessionUI } from './sessions.js';

export async function addGame(formData, selectedTags, onSuccess) {
  const games = JSON.parse(JSON.stringify(state.games));
  const d = formData.date ? new Date(formData.date + 'T12:00:00') : new Date();
  const startMMR = parseInt(formData.startMMR, 10) || 0;
  const endMMR = parseInt(formData.endMMR, 10) || 0;

  const game = normalizeGame({
    date: formatDisplayDate(d),
    session: parseInt(formData.session, 10) || 1,
    match: games.length + 1,
    mode: formData.mode,
    result: formData.result,
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
  const games = JSON.parse(JSON.stringify(state.games));
  const idx = games.findIndex(g => g.match === matchNum);
  if (idx === -1) throw new Error('Game not found');

  const d = formData.date ? new Date(formData.date + 'T12:00:00') : new Date();
  const startMMR = parseInt(formData.startMMR, 10) || 0;
  const endMMR = parseInt(formData.endMMR, 10) || 0;

  games[idx] = normalizeGame({
    ...games[idx],
    date: formatDisplayDate(d),
    session: parseInt(formData.session, 10) || 1,
    mode: formData.mode,
    result: formData.result,
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
}

export async function deleteGame(matchNum) {
  if (!confirm('Delete this game?')) return false;
  const games = state.games.filter(g => g.match !== matchNum);
  games.forEach((g, i) => { g.match = i + 1; });
  await saveGames(games);
  setGames(games);
  showToast('Game deleted');
  return true;
}

export function getLastMMR() {
  return state.games.length ? state.games[state.games.length - 1].endMMR : '';
}
