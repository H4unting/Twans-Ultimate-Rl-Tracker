/** Valorant rank display — division + within-tier RR */

import {
  normalizeRankName,
  formatRankDisplay,
  formatRankShort,
  getTierColor,
  isRadiant,
  inferRankFromLegacyRR,
  rankIndex,
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

/** Compact match-log label: "Bronze 2 • 87 RR" */
export function formatRankCompact(rank, rr) {
  const n = normalizeRankName(rank) || 'Iron 1';
  const r = Number(rr) || 0;
  if (isRadiant(n)) return `Radiant • ${r} RR`;
  return `${n} • ${r} RR`;
}

export function valRankCellHTML(rankName, rr) {
  const n = normalizeRankName(rankName) || 'Iron 1';
  const color = getTierColor(n);
  return `<span class="val-rank-compact" style="color:${color}">${formatRankCompact(rankName, rr)}</span>`;
}

/** Promotion/demotion chip — empty when start and end rank are the same */
export function valRankChangeIndicatorHTML(startRank, endRank) {
  const start = normalizeRankName(startRank);
  const end = normalizeRankName(endRank);
  if (!start || !end || start === end) return '';
  const promoted = rankIndex(end) > rankIndex(start);
  const arrow = promoted ? '↑' : '↓';
  const cls = promoted ? 'promo' : 'demo';
  return `<span class="val-rank-change val-rank-change--${cls}">${arrow} ${start} → ${end}</span>`;
}

export function valMatchLogEndCellHTML(rankName, rr, startRank) {
  const change = valRankChangeIndicatorHTML(startRank, rankName);
  const compact = valRankCellHTML(rankName, rr);
  if (!change) return compact;
  return `<div class="val-rank-cell-stack">${compact}${change}</div>`;
}
