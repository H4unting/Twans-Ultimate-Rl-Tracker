import { formatDisplayDate } from '../../core/dates.js';
import { normalizeGame } from './normalize.js';
import { META } from './config.js';
import {
  resolveGameStartRankState,
  resolveGameEndFromDelta,
  applyPromotion,
  estimateRankDelta,
} from './rank-chain.js';
import { normalizeRankName } from './rank-ladder.js';

function buildEndState(games, draft, formData) {
  const start = resolveGameStartRankState(games, draft);
  const startRankInput = normalizeRankName(formData.startRank);
  const endRRInput = parseInt(formData.endRR, 10);
  const endRankInput = normalizeRankName(formData.endRank);
  const startResolved = startRankInput
    ? { rank: startRankInput, rr: parseInt(formData.startRR, 10) || start.rr }
    : start;

  if (endRankInput != null && Number.isFinite(endRRInput)) {
    const rrDiff = formData.rrDiff != null && formData.rrDiff !== ''
      ? parseInt(formData.rrDiff, 10) || 0
      : estimateRankDelta(games, draft.result, draft.mode);
    return {
      startRank: startResolved.rank,
      startRR: startResolved.rr,
      endRank: endRankInput,
      endRR: endRRInput,
      rrDiff,
    };
  }

  if (Number.isFinite(endRRInput) && formData.rrDiff != null && formData.rrDiff !== '') {
    const delta = parseInt(formData.rrDiff, 10) || 0;
    const applied = applyPromotion(startResolved.rank, startResolved.rr, delta);
    return {
      startRank: startResolved.rank,
      startRR: startResolved.rr,
      endRank: applied.rank,
      endRR: applied.rr,
      rrDiff: applied.rrDiff,
    };
  }

  if (Number.isFinite(endRRInput)) {
    const delta = endRRInput - startResolved.rr;
    const applied = applyPromotion(startResolved.rank, startResolved.rr, delta);
    return {
      startRank: startResolved.rank,
      startRR: startResolved.rr,
      endRank: applied.rank,
      endRR: applied.rr,
      rrDiff: applied.rrDiff,
    };
  }

  const applied = resolveGameEndFromDelta(games, draft, draft.result === 'W' ? 18 : -18);
  return {
    startRank: startResolved.rank,
    startRR: startResolved.rr,
    endRank: applied.rank,
    endRR: applied.rr,
    rrDiff: applied.rrDiff,
  };
}

export function buildGameFromForm(formData, games, selectedTags) {
  const d = formData.date ? new Date(formData.date + 'T12:00:00') : new Date();
  const draft = {
    match: games.length + 1,
    mode: formData.mode,
    result: formData.result,
    endRR: parseInt(formData.endRR, 10) || 0,
    startRR: parseInt(formData.startRR, 10) || 0,
    endRank: formData.endRank,
  };
  const rankState = buildEndState(games, draft, formData);

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
    ...rankState,
    notes: formData.notes?.trim() ?? '',
    tags: [...selectedTags],
  });
}

export function buildGameUpdate(formData, games, idx, selectedTags) {
  const d = formData.date ? new Date(formData.date + 'T12:00:00') : new Date();
  const draft = {
    ...games[idx],
    mode: formData.mode,
    result: formData.result,
    endRR: parseInt(formData.endRR, 10) || 0,
    startRR: parseInt(formData.startRR, 10) || 0,
    endRank: formData.endRank,
    match: games[idx].match,
  };
  const rankState = buildEndState(games, draft, formData);

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
    ...rankState,
    notes: formData.notes?.trim() ?? '',
    tags: [...selectedTags],
  });
}

export function patchLastGameRank(g, games, idx, endRR, endRank) {
  const start = resolveGameStartRankState(games.slice(0, idx), g);
  const rr = parseInt(endRR, 10) || 0;
  const rankName = normalizeRankName(endRank) ?? normalizeRankName(g.endRank);

  g.startRank = start.rank;
  g.startRR = start.rr;

  if (rankName) {
    g.endRank = rankName;
    g.endRR = rr;
    if (!Number.isFinite(g.rrDiff)) {
      g.rrDiff = rankName === start.rank ? rr - start.rr : estimateRankDelta(games.slice(0, idx), g.result, g.mode);
    }
  } else {
    const delta = Number.isFinite(g.rrDiff) ? g.rrDiff : (rr - start.rr);
    const applied = applyPromotion(start.rank, start.rr, delta);
    g.endRank = applied.rank;
    g.endRR = applied.rr;
    g.rrDiff = applied.rrDiff;
  }

  g.notes = (g.notes || '').replace(/RR estimated/g, '').replace(/\s·\s·/g, ' · ').trim();
  return g;
}

export { META };
