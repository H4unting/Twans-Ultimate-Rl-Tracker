import { formatDisplayDate } from '../../core/dates.js';
import { normalizeGame } from './normalize.js';
import { META } from './config.js';
import { resolveGameStartRank } from './rank-chain.js';

export function buildGameFromForm(formData, games, selectedTags) {
  const d = formData.date ? new Date(formData.date + 'T12:00:00') : new Date();
  const endRR = parseInt(formData.endRR, 10) || 0;
  const draft = {
    match: games.length + 1,
    mode: formData.mode,
    result: formData.result,
    endRR,
    startRR: parseInt(formData.startRR, 10) || 0,
  };
  const startRR = resolveGameStartRank(games, draft);

  return normalizeGame({
    date: formatDisplayDate(d),
    session: parseInt(formData.session, 10) || 1,
    match: draft.match,
    mode: draft.mode,
    result: draft.result,
    kills: parseInt(formData.kills, 10) || 0,
    deaths: parseInt(formData.deaths, 10) || 0,
    valAssists: parseInt(formData.valAssists, 10) || 0,
    acs: parseInt(formData.acs, 10) || 0,
    headshotPct: formData.headshotPct != null ? parseFloat(formData.headshotPct) : null,
    agent: formData.agent ?? '',
    map: formData.map ?? '',
    startRR,
    endRR,
    rrDiff: endRR - startRR,
    notes: formData.notes?.trim() ?? '',
    tags: [...selectedTags],
  });
}

export function buildGameUpdate(formData, games, idx, selectedTags) {
  const d = formData.date ? new Date(formData.date + 'T12:00:00') : new Date();
  const endRR = parseInt(formData.endRR, 10) || 0;
  const draft = {
    ...games[idx],
    mode: formData.mode,
    result: formData.result,
    endRR,
    startRR: parseInt(formData.startRR, 10) || 0,
  };
  const startRR = resolveGameStartRank(games.filter((_, i) => i !== idx), draft);

  return normalizeGame({
    ...games[idx],
    date: formatDisplayDate(d),
    session: parseInt(formData.session, 10) || 1,
    mode: draft.mode,
    result: draft.result,
    kills: parseInt(formData.kills, 10) || 0,
    deaths: parseInt(formData.deaths, 10) || 0,
    valAssists: parseInt(formData.valAssists, 10) || 0,
    acs: parseInt(formData.acs, 10) || 0,
    headshotPct: formData.headshotPct != null ? parseFloat(formData.headshotPct) : null,
    agent: formData.agent ?? '',
    map: formData.map ?? '',
    startRR,
    endRR,
    rrDiff: endRR - startRR,
    notes: formData.notes?.trim() ?? '',
    tags: [...selectedTags],
  });
}

export function patchLastGameRank(g, games, idx, endRank) {
  g.endRR = endRank;
  g.startRR = resolveGameStartRank(games.slice(0, idx), { ...g, endRR: endRank });
  g.rrDiff = endRank - g.startRR;
  g.notes = (g.notes || '').replace(/RR estimated/g, '').replace(/\s·\s·/g, ' · ').trim();
  return g;
}

export { META };
