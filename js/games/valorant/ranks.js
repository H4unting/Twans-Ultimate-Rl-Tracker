/** Valorant rank display — division + within-tier RR */

import {
  normalizeRankName,
  formatRankDisplay,
  formatRankShort,
  getTierColor,
  isRadiant,
  inferRankFromLegacyRR,
  RANK_LADDER,
} from './rank-ladder.js';

export { RANK_LADDER };

/** @param {number|{rank?:string,endRank?:string,rr?:number,endRR?:number}} value */
export function getRank(value) {
  if (value != null && typeof value === 'object') {
    const rank = normalizeRankName(value.endRank ?? value.rank) || 'Iron 1';
    const rr = Number(value.endRR ?? value.rr) || 0;
    return { name: rank, rr, color: getTierColor(rank), isRadiant: isRadiant(rank) };
  }
  const rr = Number(value);
  if (!Number.isFinite(rr)) {
    return { name: 'Iron 1', rr: 0, color: getTierColor('Iron 1'), isRadiant: false };
  }
  const inferred = inferRankFromLegacyRR(rr);
  return {
    name: inferred.rank,
    rr: inferred.rr,
    color: getTierColor(inferred.rank),
    isRadiant: isRadiant(inferred.rank),
  };
}

export function rankBadgeHTML(value, size = 18) {
  const r = getRank(value);
  const label = isRadiant(r.name) ? `Radiant ${r.rr}` : formatRankShort(r.name, r.rr);
  return `<span class="rank-badge val-rank-badge" style="border-color:${r.color}44;color:${r.color};background:${r.color}11;font-size:${Math.max(10, size - 6)}px"><span class="rank-badge-name">${label}</span></span>`;
}

export function rankIconHTML() {
  return '';
}

export function getRankForPlaylist(value) {
  return getRank(value);
}

export function getRankIconKey() {
  return 'valorant';
}

export function getRankIconSrc() {
  return '';
}

export function rankSVG() {
  return '';
}

export function formatGameRankDisplay(game) {
  if (!game) return '—';
  const rank = game.endRank ?? game.startRank;
  const rr = game.endRR ?? 0;
  if (rank) return formatRankDisplay(rank, rr);
  return formatRankDisplay(inferRankFromLegacyRR(rr, game.startRank).rank, rr);
}
