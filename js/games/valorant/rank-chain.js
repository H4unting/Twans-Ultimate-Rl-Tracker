import { DEFAULT_RR_SWING, getPriorEndRank, GAME_ID } from './config.js';
import { getStoredRankBaseline } from '../../rank-baseline-store.js';

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

export function resolveGameStartRank(games, game) {
  const priorEnd = getPriorEndRank(games, game.mode, game.match);
  if (priorEnd != null) return priorEnd;

  const baseline = getStoredRankBaseline(GAME_ID, game.mode);
  if (baseline != null) return baseline;

  const endRR = parseInt(game.endRR, 10);
  if (!endRR) return parseInt(game.startRR, 10) || 0;

  const priorGames = games.filter(g => g.match < game.match);
  const est = estimateRankDelta(priorGames, game.result, game.mode);
  return Math.max(0, endRR - est);
}

export function repairRankChain(games) {
  let changed = false;
  const sorted = [...games].sort((a, b) => a.match - b.match);
  const fixed = sorted.map(g => {
    const startRR = resolveGameStartRank(sorted, g);
    const endRR = parseInt(g.endRR, 10) || 0;
    const rrDiff = endRR - startRR;
    if (g.startRR !== startRR || g.rrDiff !== rrDiff) {
      changed = true;
      return { ...g, startRR, rrDiff };
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
  return getPriorEndRank(games, mode, beforeMatch);
}
