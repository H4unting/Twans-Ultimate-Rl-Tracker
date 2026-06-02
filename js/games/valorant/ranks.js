/** Valorant rank display — division + within-tier RR */

import {
  normalizeRankName,
  formatRankDisplay,
  formatRankShort,
  getTierColor,
  isRadiant,
  inferRankFromLegacyRR,
  applyRRDelta,
  rankIndex,
  RANK_LADDER,
} from './rank-ladder.js';
import { resolveGameStartRankState } from './rank-chain.js';

const RANK_SEP = ' · ';

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

const TIER_ABBR = {
  Iron: 'Ir',
  Bronze: 'B',
  Silver: 'S',
  Gold: 'G',
  Platinum: 'P',
  Diamond: 'D',
  Ascendant: 'A',
  Immortal: 'Imm',
  Radiant: 'Rad',
};

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** Compact match-log label: "Ir1 · 7", "B2 · 87", "Imm3 · 12" */
export function formatValorantRankShort(rankName, rr) {
  const n = normalizeRankName(rankName) || 'Iron 1';
  const r = Number(rr) || 0;
  if (isRadiant(n)) return `Rad${RANK_SEP}${r}`;
  const m = /^(\w+)\s+(\d+)$/.exec(n);
  if (!m) return `${n}${RANK_SEP}${r}`;
  const abbr = TIER_ABBR[m[1]] ?? m[1].slice(0, 2);
  return `${abbr}${m[2]}${RANK_SEP}${r}`;
}

/**
 * Display-only rank/RR for match logs — mirrors repairRankChain read path without persisting.
 * Uses rrDiff + applyRRDelta so promotions show even when stored endRank is stale.
 */
export function resolveValorantMatchDisplayRanks(allGames, game) {
  const sorted = [...allGames].sort((a, b) => a.match - b.match);
  const start = resolveGameStartRankState(sorted, game);
  let endRank = normalizeRankName(game.endRank);
  let endRR = parseInt(game.endRR, 10);
  if (Number.isNaN(endRR)) endRR = 0;

  if (game.rrDiff != null && Number.isFinite(game.rrDiff)) {
    const applied = applyRRDelta(start.rank, start.rr, game.rrDiff);
    endRank = applied.rank;
    endRR = applied.rr;
  } else if (endRank) {
    endRR = parseInt(game.endRR, 10) || 0;
  } else {
    const applied = applyRRDelta(start.rank, start.rr, endRR - start.rr);
    endRank = applied.rank;
    endRR = applied.rr;
  }

  return {
    startRank: start.rank,
    startRR: start.rr,
    endRank,
    endRR,
  };
}

/** Full tooltip label: "Bronze 2 — 87 RR" */
export function formatValorantRankTooltip(rankName, rr) {
  const n = normalizeRankName(rankName) || 'Iron 1';
  const r = Number(rr) || 0;
  if (isRadiant(n)) return `Radiant — ${r} RR`;
  return `${n} — ${r} RR`;
}

/** Promotion/demotion tooltip — empty when ranks match */
export function formatValorantRankChangeTooltip(startRank, endRank) {
  const start = normalizeRankName(startRank);
  const end = normalizeRankName(endRank);
  if (!start || !end || start === end) return '';
  const promoted = rankIndex(end) > rankIndex(start);
  return promoted ? `Promoted: ${start} → ${end}` : `Demoted: ${start} → ${end}`;
}

/** @deprecated use formatValorantRankTooltip */
export function formatRankCompact(rank, rr) {
  return formatValorantRankTooltip(rank, rr);
}

/** Start column — muted plain text */
export function valRankStartCellHTML(rankName, rr) {
  const label = formatValorantRankShort(rankName, rr);
  const title = formatValorantRankTooltip(rankName, rr);
  return `<span class="val-rank-text val-rank-text--start" title="${escapeAttr(title)}">${label}</span>`;
}

/** End column — compact label + ↑/↓ when rank tier changes */
export function valRankEndCellHTML(rankName, rr, startRank) {
  const label = formatValorantRankShort(rankName, rr);
  const changeTip = formatValorantRankChangeTooltip(startRank, rankName);
  const title = changeTip || formatValorantRankTooltip(rankName, rr);
  const change = valRankChangeIndicatorHTML(startRank, rankName);
  return `<span class="val-rank-text val-rank-text--end" title="${escapeAttr(title)}">${label}${change ? ` ${change}` : ''}</span>`;
}

/** @deprecated use valRankStartCellHTML */
export function valRankCellHTML(rankName, rr) {
  return valRankStartCellHTML(rankName, rr);
}

/** Promotion/demotion arrow — empty when start and end rank are the same */
export function valRankChangeIndicatorHTML(startRank, endRank) {
  const start = normalizeRankName(startRank);
  const end = normalizeRankName(endRank);
  if (!start || !end || start === end) return '';
  const promoted = rankIndex(end) > rankIndex(start);
  const arrow = promoted ? '↑' : '↓';
  const cls = promoted ? 'promo' : 'demo';
  return `<span class="val-rank-change val-rank-change--${cls}">${arrow}</span>`;
}

/** @deprecated use valRankEndCellHTML */
export function valMatchLogEndCellHTML(rankName, rr, startRank) {
  return valRankEndCellHTML(rankName, rr, startRank);
}
