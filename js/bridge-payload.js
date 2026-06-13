/** Client-side bridge match payload validation (mirrors scripts/bridge-security.mjs schemas). */

const WL = new Set(['W', 'L']);

function clampStat(n, max = 999) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0 || v > max) return null;
  return Math.floor(v);
}

/** Rocket League /last-match before ingest. */
export function validateRlMatchPayload(match) {
  if (!match || typeof match !== 'object' || match.consumed) return null;
  if (!WL.has(String(match.result ?? ''))) return null;
  const goals = clampStat(match.goals);
  const assists = clampStat(match.assists);
  const saves = clampStat(match.saves);
  if (goals == null || assists == null || saves == null) return null;
  const mode = String(match.mode ?? '').slice(0, 32);
  if (!mode) return null;
  const endedAt = Number(match.endedAt);
  if (!Number.isFinite(endedAt) || endedAt <= 0) return null;
  return {
    ...match,
    goals,
    assists,
    saves,
    result: match.result,
    mode,
    endedAt,
  };
}

/** Valorant /valorant/last-match before ingest. */
export function validateValorantMatchPayload(match) {
  if (!match || typeof match !== 'object' || match.consumed) return null;
  if (!WL.has(String(match.result ?? ''))) return null;
  const kills = clampStat(match.kills);
  const deaths = clampStat(match.deaths);
  const valAssists = clampStat(match.valAssists ?? match.assists);
  if (kills == null || deaths == null || valAssists == null) return null;
  if (kills + deaths + valAssists === 0) return null;
  const matchId = String(match.matchId ?? '').slice(0, 128);
  if (!matchId) return null;
  const mode = String(match.mode ?? 'Competitive').slice(0, 32);
  const endedAt = Number(match.endedAt);
  if (!Number.isFinite(endedAt) || endedAt <= 0) return null;
  return {
    ...match,
    kills,
    deaths,
    valAssists,
    matchId,
    mode,
    endedAt,
  };
}
