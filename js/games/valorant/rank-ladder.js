/** Valorant competitive rank ladder — division name + within-tier RR (0–100) */

export const RANK_LADDER = [
  'Iron 1', 'Iron 2', 'Iron 3',
  'Bronze 1', 'Bronze 2', 'Bronze 3',
  'Silver 1', 'Silver 2', 'Silver 3',
  'Gold 1', 'Gold 2', 'Gold 3',
  'Platinum 1', 'Platinum 2', 'Platinum 3',
  'Diamond 1', 'Diamond 2', 'Diamond 3',
  'Ascendant 1', 'Ascendant 2', 'Ascendant 3',
  'Immortal 1', 'Immortal 2', 'Immortal 3',
  'Radiant',
];

const TIER_COLORS = {
  Iron: '#4a4a4a',
  Bronze: '#cd7f32',
  Silver: '#c0c0c0',
  Gold: '#ffd700',
  Platinum: '#5dade2',
  Diamond: '#76d7ea',
  Ascendant: '#1a8a5c',
  Immortal: '#ff4655',
  Radiant: '#fff4cc',
};

const LADDER_INDEX = new Map(RANK_LADDER.map((name, i) => [name, i]));

/** Normalize API / user strings to canonical ladder names */
export function normalizeRankName(name) {
  if (name == null || name === '') return null;
  const s = String(name).trim();
  if (s === 'Radiant') return 'Radiant';
  const direct = LADDER_INDEX.get(s);
  if (direct != null) return s;
  const m = s.match(/^(\w+)\s*(\d)?$/i);
  if (!m) return null;
  const tier = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
  if (tier === 'Radiant') return 'Radiant';
  const sub = m[2] ? ` ${m[2]}` : '';
  const candidate = `${tier}${sub}`;
  return LADDER_INDEX.has(candidate) ? candidate : null;
}

export function rankIndex(rank) {
  const n = normalizeRankName(rank);
  if (!n) return 0;
  return LADDER_INDEX.get(n) ?? 0;
}

export function isRadiant(rank) {
  return normalizeRankName(rank) === 'Radiant';
}

export function getTierColor(rank) {
  const n = normalizeRankName(rank);
  if (!n) return TIER_COLORS.Iron;
  if (n === 'Radiant') return TIER_COLORS.Radiant;
  const tier = n.split(' ')[0];
  return TIER_COLORS[tier] ?? TIER_COLORS.Iron;
}

/**
 * Apply competitive RR delta with promotion/demotion across the ladder.
 * Non-Radiant: RR stays 0–100 within a division; overflow promotes, underflow demotes.
 * Radiant: terminal tier — RR may exceed 100; demote to Immortal 3 if RR drops below 0.
 */
export function applyRRDelta(startRank, startRR, delta) {
  let rank = normalizeRankName(startRank) || 'Iron 1';
  let rr = Math.max(0, Number(startRR) || 0);
  const d = Number(delta) || 0;
  let promoted = false;
  let demoted = false;

  if (isRadiant(rank)) {
    rr += d;
    if (rr < 0) {
      rank = 'Immortal 3';
      rr = 100 + rr;
      demoted = true;
    }
    return { rank, rr, rrDiff: d, promoted: false, demoted };
  }

  let idx = rankIndex(rank);
  let rrWorking = rr + d;

  while (rrWorking > 100 && idx < RANK_LADDER.length - 1) {
    rrWorking -= 100;
    idx += 1;
    promoted = true;
  }

  while (rrWorking < 0 && idx > 0) {
    rrWorking += 100;
    idx -= 1;
    demoted = true;
  }

  rrWorking = Math.max(0, rrWorking);
  rank = RANK_LADDER[idx];

  if (!isRadiant(rank) && rrWorking > 100) {
    if (idx < RANK_LADDER.length - 1) {
      rrWorking -= 100;
      idx += 1;
      rank = RANK_LADDER[idx];
      promoted = true;
    } else {
      rrWorking = 100;
    }
  }

  if (!isRadiant(rank)) {
    rrWorking = Math.min(100, rrWorking);
  }

  return { rank, rr: rrWorking, rrDiff: d, promoted, demoted };
}

/** @deprecated alias */
export function promote(startRank, startRR, delta) {
  return applyRRDelta(startRank, startRR, delta);
}

export function formatRankDisplay(rank, rr) {
  const n = normalizeRankName(rank) || 'Iron 1';
  const r = Number(rr) || 0;
  if (isRadiant(n)) return `Radiant · ${r} RR`;
  return `${n} · ${r} RR`;
}

export function formatRankShort(rank, rr) {
  const n = normalizeRankName(rank) || 'Iron 1';
  const r = Number(rr) || 0;
  if (isRadiant(n)) return `Radiant ${r}`;
  return `${n} ${r}`;
}

/** Legacy rows: RR only, no division name — default Iron 1 unless prior rank supplied */
export function inferRankFromLegacyRR(endRR, priorRank = null) {
  const rr = Math.max(0, Number(endRR) || 0);
  const rank = normalizeRankName(priorRank) || 'Iron 1';
  if (isRadiant(rank)) return { rank, rr };
  return { rank, rr: Math.min(100, rr) };
}

/** Parse baseline: number (legacy RR) or { rank, rr } or "Gold 2|45" */
export function parseValorantBaseline(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object' && raw.rank != null) {
    return {
      rank: normalizeRankName(raw.rank) || 'Iron 1',
      rr: Math.max(0, Number(raw.rr) || 0),
    };
  }
  if (typeof raw === 'string' && raw.includes('|')) {
    const [rankPart, rrPart] = raw.split('|');
    const rank = normalizeRankName(rankPart?.trim());
    const rr = parseInt(rrPart, 10);
    if (rank) return { rank, rr: Number.isFinite(rr) && rr >= 0 ? rr : 0 };
  }
  const n = parseInt(raw, 10);
  if (Number.isFinite(n) && n >= 0) {
    return inferRankFromLegacyRR(n);
  }
  return null;
}

export function serializeValorantBaseline({ rank, rr }) {
  return { rank: normalizeRankName(rank) || 'Iron 1', rr: Math.max(0, Number(rr) || 0) };
}
