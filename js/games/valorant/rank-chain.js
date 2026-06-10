/** Valorant competitive rank chain — promotion/demotion via applyRRDelta in rank-ladder.js (>=100 RR promotes with carry; <0 demotes) */

import { DEFAULT_RR_SWING, getPriorEndRankState, GAME_ID } from './config.js';
import { getStoredValorantBaseline } from '../../rank-baseline-store.js';
import { applyRRDelta, normalizeRankName } from './rank-ladder.js';

export function estimateRankDelta(games, result, mode) {
  const recent = games.filter(g =>
    g.result === result && g.mode === mode && g.rrDiff != null,
  ).slice(-15);
  if (recent.length >= 2) {
    return Math.round(recent.reduce((s, g) => s + g.rrDiff, 0) / recent.length);
  }
  return result === 'W' ? DEFAULT_RR_SWING.W : DEFAULT_RR_SWING.L;
}

export { estimateRankDelta as estimateMMRDelta };

export function resolveGameStartRankState(games, game) {
  const prior = getPriorEndRankState(games, game.mode, game.match);
  if (prior) return prior;

  const baseline = getStoredValorantBaseline(GAME_ID, game.mode);
  if (baseline) return baseline;

  const endRR = parseInt(game.endRR, 10);
  const endRank = normalizeRankName(game.endRank);
  if (!endRR && !endRank) {
    return { rank: 'Iron 1', rr: parseInt(game.startRR, 10) || 0 };
  }

  const priorGames = games.filter(g => g.match < game.match);
  const est = estimateRankDelta(priorGames, game.result, game.mode);
  if (endRank) {
    const applied = applyRRDelta(endRank, endRR || 0, -est);
    return { rank: applied.rank, rr: applied.rr };
  }

  const applied = applyRRDelta('Iron 1', endRR || 0, -est);
  return { rank: applied.rank, rr: applied.rr };
}

/** @deprecated numeric start RR only — use resolveGameStartRankState */
export function resolveGameStartRank(games, game) {
  return resolveGameStartRankState(games, game).rr;
}

export function applyPromotion(startRank, startRR, delta) {
  return applyRRDelta(startRank, startRR, delta);
}

export function resolveGameEndFromDelta(games, game, delta) {
  const start = resolveGameStartRankState(games, game);
  return applyRRDelta(start.rank, start.rr, delta);
}

export function repairRankChain(games) {
  let changed = false;
  const sorted = [...games].sort((a, b) => a.match - b.match);
  let priorEndRank = null;

  const fixed = sorted.map(g => {
    const start = resolveGameStartRankState(sorted, g);
    let endRank = normalizeRankName(g.endRank);
    let endRR = parseInt(g.endRR, 10);
    if (Number.isNaN(endRR)) endRR = 0;

    if (g.rrDiff != null && Number.isFinite(g.rrDiff)) {
      const applied = applyRRDelta(start.rank, start.rr, g.rrDiff);
      endRank = applied.rank;
      endRR = applied.rr;
    } else if (endRank) {
      endRR = parseInt(g.endRR, 10) || 0;
    } else {
      const inferred = applyRRDelta(start.rank, start.rr, endRR - start.rr);
      endRank = inferred.rank;
      endRR = inferred.rr;
    }

    const startRR = start.rr;
    const rrDiff = g.rrDiff != null && Number.isFinite(g.rrDiff)
      ? g.rrDiff
      : (endRank === start.rank ? endRR - startRR : 0);

    priorEndRank = endRank;

    if (
      g.startRank !== start.rank
      || g.endRank !== endRank
      || g.startRR !== startRR
      || g.endRR !== endRR
      || g.rrDiff !== rrDiff
    ) {
      changed = true;
      return {
        ...g,
        startRank: start.rank,
        endRank,
        startRR,
        endRR,
        rrDiff,
      };
    }
    return g;
  });

  return { games: fixed, changed };
}

/** @deprecated Val boot uses repairRankChain — alias for clarity in legacy imports */
export function repairPlaylistMMRChain(games) {
  return repairRankChain(games);
}

export function resolveGameStartMMR(games, game) {
  return resolveGameStartRank(games, game);
}

export function getPriorEndMMRForMode(games, mode, beforeMatch) {
  const st = getPriorEndRankState(games, mode, beforeMatch);
  return st?.rr ?? null;
}
