import { getPriorEndRank, META } from './config.js';

export function estimateRankDelta(games, result, mode) {
  const recent = games.filter(g =>
    g.result === result && g.mode === mode && g.mmrDiff,
  ).slice(-15);
  if (recent.length >= 2) {
    return Math.round(recent.reduce((s, g) => s + g.mmrDiff, 0) / recent.length);
  }
  return result === 'W' ? 10 : -10;
}

export function resolveGameStartRank(games, game) {
  const priorEnd = getPriorEndRank(games, game.mode, game.match);
  if (priorEnd != null) return priorEnd;

  const endMMR = parseInt(game.endMMR, 10);
  if (!endMMR) return parseInt(game.startMMR, 10) || 0;

  const priorGames = games.filter(g => g.match < game.match);
  const est = estimateRankDelta(priorGames, game.result, game.mode);
  return Math.max(0, endMMR - est);
}

/** Fix games where start MMR was copied from the wrong playlist */
export function repairRankChain(games) {
  let changed = false;
  const sorted = [...games].sort((a, b) => a.match - b.match);
  const fixed = sorted.map(g => {
    const startMMR = resolveGameStartRank(sorted, g);
    const endMMR = parseInt(g.endMMR, 10) || 0;
    const mmrDiff = endMMR - startMMR;
    if (g.startMMR !== startMMR || g.mmrDiff !== mmrDiff) {
      changed = true;
      return { ...g, startMMR, mmrDiff };
    }
    return g;
  });
  return { games: fixed, changed };
}

export function getPriorEndMMRForMode(games, mode, beforeMatch) {
  return getPriorEndRank(games, mode, beforeMatch);
}

export function resolveGameStartMMR(games, game) {
  return resolveGameStartRank(games, game);
}

export function repairPlaylistMMRChain(games) {
  return repairRankChain(games);
}

export function estimateMMRDelta(games, result, mode) {
  return estimateRankDelta(games, result, mode);
}
