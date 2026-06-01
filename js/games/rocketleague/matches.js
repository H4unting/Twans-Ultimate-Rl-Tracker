import { formatDisplayDate } from '../../core/dates.js';
import { normalizeGame } from './normalize.js';
import { META } from './config.js';
import { resolveGameStartRank as resolveStart } from './rank-chain.js';

export function buildGameFromForm(formData, games, selectedTags) {
  const d = formData.date ? new Date(formData.date + 'T12:00:00') : new Date();
  const endMMR = parseInt(formData.endMMR, 10) || 0;
  const draft = {
    match: games.length + 1,
    mode: formData.mode,
    result: formData.result,
    endMMR,
    startMMR: parseInt(formData.startMMR, 10) || 0,
  };
  const startMMR = resolveStart(games, draft);

  return normalizeGame({
    date: formatDisplayDate(d),
    session: parseInt(formData.session, 10) || 1,
    match: draft.match,
    mode: draft.mode,
    result: draft.result,
    goals: parseInt(formData.goals, 10) || 0,
    assists: parseInt(formData.assists, 10) || 0,
    saves: parseInt(formData.saves, 10) || 0,
    startMMR,
    endMMR,
    mmrDiff: endMMR - startMMR,
    notes: formData.notes?.trim() ?? '',
    tags: [...selectedTags],
  });
}

export function buildGameUpdate(formData, games, idx, selectedTags) {
  const d = formData.date ? new Date(formData.date + 'T12:00:00') : new Date();
  const startMMR = parseInt(formData.startMMR, 10) || 0;
  const endMMR = parseInt(formData.endMMR, 10) || 0;

  return normalizeGame({
    ...games[idx],
    date: formatDisplayDate(d),
    session: parseInt(formData.session, 10) || 1,
    mode: formData.mode,
    result: formData.result,
    goals: parseInt(formData.goals, 10) || 0,
    assists: parseInt(formData.assists, 10) || 0,
    saves: parseInt(formData.saves, 10) || 0,
    startMMR,
    endMMR,
    mmrDiff: endMMR - startMMR,
    notes: formData.notes?.trim() ?? '',
    tags: [...selectedTags],
  });
}

export function patchLastGameRank(g, games, idx, endRank) {
  g.endMMR = endRank;
  g.startMMR = resolveStart(games.slice(0, idx), { ...g, endMMR: endRank });
  g.mmrDiff = endRank - g.startMMR;
  g.notes = (g.notes || '').replace(/MMR estimated/g, '').replace(/\s·\s·/g, ' · ').trim();
  return g;
}

export { META };
