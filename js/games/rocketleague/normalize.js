import { TAG_DEFINITIONS, META } from './config.js';

/** Normalize a Rocket League match — no Valorant fields */
export function normalizeGame(raw) {
  const tags = Array.isArray(raw.tags) ? raw.tags.filter(t => TAG_DEFINITIONS[t]) : [];
  const startMMR = raw.startMMR ?? raw.start_mmr ?? 0;
  const endMMR = raw.endMMR ?? raw.end_mmr ?? 0;

  return {
    game: META.id,
    date: raw.date ?? '',
    session: raw.session ?? 1,
    match: raw.match ?? 0,
    mode: raw.mode ?? META.defaultMode,
    result: raw.result === 'L' ? 'L' : 'W',
    goals: raw.goals ?? 0,
    assists: raw.assists ?? 0,
    saves: raw.saves ?? 0,
    startMMR,
    endMMR,
    mmrDiff: raw.mmrDiff ?? endMMR - startMMR,
    notes: raw.notes ?? '',
    tags,
  };
}
