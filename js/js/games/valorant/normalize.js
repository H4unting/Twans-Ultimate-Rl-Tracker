import { TAG_DEFINITIONS, META } from './config.js';

/** Normalize a Valorant match — no Rocket League stat fields in output */
export function normalizeGame(raw) {
  const tags = Array.isArray(raw.tags) ? raw.tags.filter(t => TAG_DEFINITIONS[t]) : [];
  const startRR = raw.startRR ?? raw.start_rr ?? 0;
  const endRR = raw.endRR ?? raw.end_rr ?? 0;

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
    startRR,
    endRR,
    rrDiff: raw.rrDiff ?? endRR - startRR,
    notes: raw.notes ?? '',
    tags,
  };
}
