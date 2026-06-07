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
  const iconSize = Math.round(size * 1.2);
  return `<span class="rank-badge val-rank-badge" style="border-color:${r.color}44;color:${r.color};font-size:${Math.max(10, size - 6)}px">${rankIconHTML(r, iconSize)}<span class="rank-badge-name">${label}</span></span>`;
}

const WIKI_IMG = 'https://static.wikia.nocookie.net/valorant/images';

const RANK_ICON_SRC = {
  'iron-1': `${WIKI_IMG}/7/7c/Iron_1_Rank.png/revision/latest`,
  'iron-2': `${WIKI_IMG}/b/bf/Iron_2_Rank.png/revision/latest`,
  'iron-3': `${WIKI_IMG}/7/79/Iron_3_Rank.png/revision/latest`,
  'bronze-1': `${WIKI_IMG}/b/bd/Bronze_1_Rank.png/revision/latest`,
  'bronze-2': `${WIKI_IMG}/c/c7/Bronze_2_Rank.png/revision/latest`,
  'bronze-3': `${WIKI_IMG}/a/ae/Bronze_3_Rank.png/revision/latest`,
  'silver-1': `${WIKI_IMG}/8/8a/Silver_1_Rank.png/revision/latest`,
  'silver-2': `${WIKI_IMG}/e/e9/Silver_2_Rank.png/revision/latest`,
  'silver-3': `${WIKI_IMG}/d/d7/Silver_3_Rank.png/revision/latest`,
  'gold-1': `${WIKI_IMG}/6/65/Gold_1_Rank.png/revision/latest`,
  'gold-2': `${WIKI_IMG}/0/02/Gold_2_Rank.png/revision/latest`,
  'gold-3': `${WIKI_IMG}/2/27/Gold_3_Rank.png/revision/latest`,
  'platinum-1': `${WIKI_IMG}/9/96/Platinum_1_Rank.png/revision/latest`,
  'platinum-2': `${WIKI_IMG}/5/5a/Platinum_2_Rank.png/revision/latest`,
  'platinum-3': `${WIKI_IMG}/1/1b/Platinum_3_Rank.png/revision/latest`,
  'diamond-1': `${WIKI_IMG}/a/ae/Diamond_1_Rank.png/revision/latest`,
  'diamond-2': `${WIKI_IMG}/6/6a/Diamond_2_Rank.png/revision/latest`,
  'diamond-3': `${WIKI_IMG}/0/01/Diamond_3_Rank.png/revision/latest`,
  'ascendant-1': `${WIKI_IMG}/e/e5/Ascendant_1_Rank.png/revision/latest`,
  'ascendant-2': `${WIKI_IMG}/1/1e/Ascendant_2_Rank.png/revision/latest`,
  'ascendant-3': `${WIKI_IMG}/5/53/Ascendant_3_Rank.png/revision/latest`,
  'immortal-1': `${WIKI_IMG}/a/a8/Immortal_1_Rank.png/revision/latest`,
  'immortal-2': `${WIKI_IMG}/2/21/Immortal_2_Rank.png/revision/latest`,
  'immortal-3': `${WIKI_IMG}/0/0b/Immortal_3_Rank.png/revision/latest`,
  radiant: `${WIKI_IMG}/1/1a/Radiant_Rank.png/revision/latest`,
};

export function getRankIconKey(rankName) {
  const n = normalizeRankName(rankName);
  if (!n) return 'iron-1';
  if (n === 'Radiant') return 'radiant';
  return n.toLowerCase().replace(/\s+/g, '-');
}

export function getRankIconSrc(rankName) {
  const key = getRankIconKey(rankName);
  return RANK_ICON_SRC[key] ?? RANK_ICON_SRC['iron-1'];
}

export function rankIconHTML(rankOrName, size = 20) {
  const name = typeof rankOrName === 'string'
    ? (normalizeRankName(rankOrName) || 'Iron 1')
    : (rankOrName?.name ?? 'Iron 1');
  const src = getRankIconSrc(name);
  const fallback = RANK_ICON_SRC['iron-1'];
  const alt = name === 'Radiant' ? 'Radiant' : name;
  return `<img class="rank-icon" src="${src}" alt="${alt}" width="${size}" height="${size}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${fallback}'">`;
}

export function rankSVG(tier, size = 20) {
  const fallback = {
    iron: 'Iron 1', bronze: 'Bronze 1', silver: 'Silver 1', gold: 'Gold 1',
    platinum: 'Platinum 1', diamond: 'Diamond 1', ascendant: 'Ascendant 1',
    immortal: 'Immortal 1', radiant: 'Radiant',
  };
  return rankIconHTML(fallback[tier] ?? 'Iron 1', size);
}

export function getRankForPlaylist(value) {
  return getRank(value);
}

export function formatGameRankDisplay(game) {
  if (!game) return '—';
  const rank = game.endRank ?? game.startRank;
  const rr = game.endRR ?? 0;
  if (rank) return formatRankDisplay(rank, rr);
  return formatRankDisplay(inferRankFromLegacyRR(rr, game.startRank).rank, rr);
}

const TIER_ABBR = {
  Bronze: 'B',
  Silver: 'S',
  Gold: 'G',
  Platinum: 'P',
  Diamond: 'D',
  Ascendant: 'A',
};

function rankLabelForDisplay(rankName) {
  const n = normalizeRankName(rankName) || 'Iron 1';
  if (isRadiant(n)) return 'Radiant';
  const m = /^(\w+)\s+(\d+)$/.exec(n);
  if (!m) return n;
  // Iron & Immortal: full name (Ir2 / Imm3 feel tacky). Mid tiers: B2, S1, etc.
  if (m[1] === 'Iron' || m[1] === 'Immortal') return n;
  const abbr = TIER_ABBR[m[1]];
  return abbr ? `${abbr}${m[2]}` : n;
}

/** Compact match-log label: "Iron 2 · 83", "B2 · 87", "Immortal 3 · 12" */
export function formatValorantRankShort(rankName, rr) {
  const r = Number(rr) || 0;
  return `${rankLabelForDisplay(rankName)}${RANK_SEP}${r}`;
}

function valRankTextHTML(rankName, rr, role, titleOverride = null) {
  const n = normalizeRankName(rankName) || 'Iron 1';
  const r = Number(rr) || 0;
  const tierColor = getTierColor(n);
  const label = rankLabelForDisplay(rankName);
  const title = titleOverride ?? formatValorantRankTooltip(rankName, rr);
  return `<span class="val-rank-text val-rank-text--${role}" style="--val-tier:${tierColor}" title="${escapeAttr(title)}">`
    + `<span class="val-rank-tier">${label}</span>`
    + `<span class="val-rank-sep">${RANK_SEP.trim()}</span>`
    + `<span class="val-rank-rr">${r}</span></span>`;
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

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** @deprecated use formatValorantRankTooltip */
export function formatRankCompact(rank, rr) {
  return formatValorantRankTooltip(rank, rr);
}

/** Start column — muted plain text */
export function valRankStartCellHTML(rankName, rr) {
  return valRankTextHTML(rankName, rr, 'start');
}

/** End column — compact label + ↑/↓ when rank tier changes */
export function valRankEndCellHTML(rankName, rr, startRank) {
  const changeTip = formatValorantRankChangeTooltip(startRank, rankName);
  const title = changeTip || formatValorantRankTooltip(rankName, rr);
  const change = valRankChangeIndicatorHTML(startRank, rankName);
  const base = valRankTextHTML(rankName, rr, 'end', title);
  if (!change) return base;
  return base.replace('</span>', ` ${change}</span>`);
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
