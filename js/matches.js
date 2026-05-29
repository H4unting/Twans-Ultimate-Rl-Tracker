/** Match CRUD operations */

import { state, setData } from './state.js';
import { formatDisplayDate, normalizeGame } from './utils.js';
import { saveData } from './supabase.js';
import { showToast } from './ui.js';
import { refreshSessionUI } from './sessions.js';

export async function addGame(formData, selectedTags, onSuccess) {
  const player = state.logPlayer;
  const data = JSON.parse(JSON.stringify(state.data));
  const games = data[player];
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
  await saveData(data);
  setData(data);
  showToast(`Game logged! ${game.mmrDiff >= 0 ? '+' : ''}${game.mmrDiff} MMR`);
  refreshSessionUI();
  if (onSuccess) onSuccess(game);
  return game;
}

export async function updateGame(player, matchNum, formData, selectedTags) {
  const data = JSON.parse(JSON.stringify(state.data));
  const idx = data[player].findIndex(g => g.match === matchNum);
  if (idx === -1) throw new Error('Game not found');

  const d = formData.date ? new Date(formData.date + 'T12:00:00') : new Date();
  const startMMR = parseInt(formData.startMMR, 10) || 0;
  const endMMR = parseInt(formData.endMMR, 10) || 0;

  data[player][idx] = normalizeGame({
    ...data[player][idx],
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

  await saveData(data);
  setData(data);
  showToast('Game updated!');
}

export async function deleteGame(player, matchNum) {
  if (!confirm('Delete this game?')) return false;
  const data = JSON.parse(JSON.stringify(state.data));
  data[player] = data[player].filter(g => g.match !== matchNum);
  data[player].forEach((g, i) => { g.match = i + 1; });
  await saveData(data);
  setData(data);
  showToast('Game deleted');
  return true;
}

export function getLastMMR(player) {
  const games = state.data[player] ?? [];
  return games.length ? games[games.length - 1].endMMR : '';
}
