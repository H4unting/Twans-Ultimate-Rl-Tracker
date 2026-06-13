import { TAG_DEFINITIONS, META } from './config.js';
import { normalizeRankName, inferRankFromLegacyRR } from './rank-ladder.js';

function resolveRankFields(raw, priorEndRank = null) {
  const startRR = raw.startRR ?? raw.start_rr ?? 0;
  const endRR = raw.endRR ?? raw.end_rr ?? 0;
  let startRank = normalizeRankName(raw.startRank ?? raw.start_rank);
  let endRank = normalizeRankName(raw.endRank ?? raw.end_rank);

  if (!startRank) {
    const inferred = inferRankFromLegacyRR(startRR, priorEndRank);
    startRank = inferred.rank;
  }
  if (!endRank) {
    const inferred = inferRankFromLegacyRR(endRR, startRank);
    endRank = inferred.rank;
  }

  return { startRank, endRank, startRR, endRR };
}

/** Normalize a Valorant match — no Rocket League stat fields in output */
export function normalizeGame(raw, priorEndRank = null) {
  const tags = Array.isArray(raw.tags) ? raw.tags.filter(t => TAG_DEFINITIONS[t]) : [];
  const { startRank, endRank, startRR, endRR } = resolveRankFields(raw, priorEndRank);

  return {
    game: META.id,
    date: raw.date ?? '',
    session: raw.session ?? 1,
    match: raw.match ?? 0,
    mode: raw.mode ?? META.defaultMode,
    result: raw.result === 'L' ? 'L' : 'W',
    kills: raw.kills ?? 0,
    deaths: raw.deaths ?? 0,
    valAssists: raw.valAssists ?? raw.val_assists ?? 0,
    acs: raw.acs ?? 0,
    headshotPct: raw.headshotPct ?? raw.headshot_pct ?? null,
    agent: raw.agent ?? '',
    map: raw.map ?? '',
    startRank,
    endRank,
    startRR,
    endRR,
    rrDiff: raw.rrDiff ?? endRR - startRR,
    notes: raw.notes ?? '',
    tags,
  };
}
