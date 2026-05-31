/** Match CRUD — scoped to active game title */

import { state, setGames, getActiveGames, mergeActiveGames } from './state.js';
import { formatDisplayDate, normalizeGame, getPriorEndMMRForMode, resolveGameStartMMR } from './utils.js';
import { saveGames } from './supabase.js';
import { showToast } from './ui.js';
import { refreshSessionUI } from './sessions.js';
import { getAuthUser } from './auth.js';
import { GAME_IDS, getGameMeta, getRankDiff } from './games.js';

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

function rankLabel() {
  return getGameMeta(state.activeGame).diffLabel;
}

export async function addGame(formData, selectedTags, onSuccess) {
  if (!requireSignedIn()) return null;
  const games = JSON.parse(JSON.stringify(getActiveGames()));
  const d = formData.date ? new Date(formData.date + 'T12:00:00') : new Date();
  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const endRank = parseInt(isVal ? formData.endRR : formData.endMMR, 10) || 0;
  const draft = {
    match: games.length + 1,
    mode: formData.mode,
    result: formData.result,
    endMMR: endRank,
    endRR: endRank,
    startMMR: parseInt(isVal ? formData.startRR : formData.startMMR, 10) || 0,
    startRR: parseInt(isVal ? formData.startRR : formData.startMMR, 10) || 0,
  };
  const startRank = resolveGameStartMMR(games, draft);

  const game = normalizeGame({
    game: state.activeGame,
    date: formatDisplayDate(d),
    session: parseInt(formData.session, 10) || 1,
    match: draft.match,
    mode: draft.mode,
    result: draft.result,
    goals: parseInt(formData.goals, 10) || 0,
    assists: parseInt(formData.assists, 10) || 0,
    saves: parseInt(formData.saves, 10) || 0,
    kills: parseInt(formData.kills, 10) || parseInt(formData.goals, 10) || 0,
    deaths: parseInt(formData.deaths, 10) || parseInt(formData.assists, 10) || 0,
    valAssists: parseInt(formData.valAssists, 10) || 0,
    acs: parseInt(formData.acs, 10) || parseInt(formData.saves, 10) || 0,
    agent: formData.agent ?? '',
    map: formData.map ?? '',
    startMMR: startRank,
    endMMR: endRank,
    startRR: startRank,
    endRR: endRank,
    mmrDiff: endRank - startRank,
    rrDiff: endRank - startRank,
    notes: formData.notes?.trim() ?? '',
    tags: [...selectedTags],
  });

  games.push(game);
  await persistActiveGames(games);
  const diff = getRankDiff(game, state.activeGame);
  showToast(`Game logged! ${diff >= 0 ? '+' : ''}${diff} ${rankLabel()}`);
  refreshSessionUI();
  if (onSuccess) onSuccess(game);
  return game;
}

export async function updateGame(matchNum, formData, selectedTags) {
  if (!requireSignedIn()) return;
  const games = JSON.parse(JSON.stringify(getActiveGames()));
  const idx = games.findIndex(g => g.match === matchNum);
  if (idx === -1) throw new Error('Game not found');

  const d = formData.date ? new Date(formData.date + 'T12:00:00') : new Date();
  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const endRank = parseInt(isVal ? formData.endRR : formData.endMMR, 10) || 0;
  const draft = {
    ...games[idx],
    mode: formData.mode,
    result: formData.result,
    endMMR: endRank,
    endRR: endRank,
    startMMR: parseInt(isVal ? formData.startRR : formData.startMMR, 10) || 0,
    startRR: parseInt(isVal ? formData.startRR : formData.startMMR, 10) || 0,
  };
  const startRank = resolveGameStartMMR(games.filter((_, i) => i !== idx), draft);

  games[idx] = normalizeGame({
    ...games[idx],
    game: state.activeGame,
    date: formatDisplayDate(d),
    session: parseInt(formData.session, 10) || 1,
    mode: draft.mode,
    result: draft.result,
    goals: parseInt(formData.goals, 10) || 0,
    assists: parseInt(formData.assists, 10) || 0,
    saves: parseInt(formData.saves, 10) || 0,
    kills: parseInt(formData.kills, 10) || parseInt(formData.goals, 10) || 0,
    deaths: parseInt(formData.deaths, 10) || parseInt(formData.assists, 10) || 0,
    valAssists: parseInt(formData.valAssists, 10) || 0,
    acs: parseInt(formData.acs, 10) || parseInt(formData.saves, 10) || 0,
    agent: formData.agent ?? '',
    map: formData.map ?? '',
    startMMR: startRank,
    endMMR: endRank,
    startRR: startRank,
    endRR: endRank,
    mmrDiff: endRank - startRank,
    rrDiff: endRank - startRank,
    notes: formData.notes?.trim() ?? '',
    tags: [...selectedTags],
  });

  await persistActiveGames(games);
  showToast('Game updated!');
  return games[idx];
}

export async function patchLastGame({ endMMR, endRR, tags, notes }) {
  if (!requireSignedIn()) return null;
  const games = JSON.parse(JSON.stringify(getActiveGames()));
  if (!games.length) return null;
  const idx = games.length - 1;
  const g = { ...games[idx] };
  const endRank = endRR ?? endMMR;

  if (endRank != null) {
    g.endMMR = endRank;
    g.endRR = endRank;
    g.startMMR = resolveGameStartMMR(games.slice(0, idx), { ...g, endMMR: endRank, endRR: endRank });
    g.startRR = g.startMMR;
    g.mmrDiff = endRank - g.startMMR;
    g.rrDiff = g.mmrDiff;
    g.notes = (g.notes || '').replace(/MMR estimated/g, '').replace(/RR estimated/g, '').replace(/\s·\s·/g, ' · ').trim();
  }
  if (tags) g.tags = [...tags];
  if (notes !== undefined) g.notes = notes;

  games[idx] = normalizeGame(g);
  await persistActiveGames(games);
  refreshSessionUI();
  return games[idx];
}

export async function undoLastGame(skipConfirm = false) {
  if (!requireSignedIn()) return false;
  const active = getActiveGames();
  if (!active.length) return false;
  if (!skipConfirm && !confirm('Remove the last logged game?')) return false;

  const games = active.slice(0, -1);
  games.forEach((g, i) => { g.match = i + 1; });
  await persistActiveGames(games);
  refreshSessionUI();
  showToast('Last game removed');
  return true;
}

export async function deleteGame(matchNum) {
  if (!requireSignedIn()) return false;
  if (!confirm('Delete this game?')) return false;
  const games = getActiveGames().filter(g => g.match !== matchNum);
  games.forEach((g, i) => { g.match = i + 1; });
  await persistActiveGames(games);
  showToast('Game deleted');
  return true;
}

export function getLastMMR(mode) {
  if (!mode) return '';
  const end = getPriorEndMMRForMode(getActiveGames(), mode);
  return end != null ? end : '';
}

export function isMmrEstimated(game) {
  return (game?.notes || '').includes('MMR estimated') || (game?.notes || '').includes('RR estimated');
}

export function lastGameNeedsMmrConfirm(games = getActiveGames()) {
  if (!games.length) return false;
  return isMmrEstimated(games[games.length - 1]);
}
