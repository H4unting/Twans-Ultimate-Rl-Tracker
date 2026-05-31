/**
 * Valorant auto-log via HenrikDev API (match history).
 * Riot dev keys (RGAPI-…) cannot access Val match endpoints (403) — Henrik is required for personal auto-log.
 * Requires riotId (Name#TAG), riotRegion, and henrikApiKey in grind-config.json.
 */

import { spawnSync } from 'child_process';
import { loadGrindConfig } from './local-setup.mjs';

const HENRIK_BASE = 'https://api.henrikdev.xyz';

const MODE_MAP = {
  competitive: 'Competitive',
  unrated: 'Unrated',
  swiftplay: 'Swiftplay',
  spikeRush: 'Spike Rush',
  deathmatch: 'Deathmatch',
  ggteam: 'Escalation',
  escalation: 'Escalation',
  replication: 'Replication',
  snowballFight: 'Snowball Fight',
};

let lastMatch = null;
let lastSeenMatchId = null;
let seeded = false;
let pollTimer = null;
let valorantRunning = false;
let configured = false;
let lastError = null;

function formatHenrikError(message, status) {
  const raw = String(message ?? '');
  if (/^RGAPI-/i.test(raw)) {
    return 'Riot dev keys (RGAPI-…) cannot read Valorant match history. Get a free Henrik key at api.henrikdev.xyz/dashboard and paste it in Auto-Log Setup.';
  }
  if (status === 401 || status === 403 || /invalid api/i.test(raw) || /unauthorized/i.test(raw)) {
    return 'Henrik API key rejected — get a free key at api.henrikdev.xyz/dashboard, paste it in Auto-Log Setup, and click Apply & Go.';
  }
  if (status === 404 || /not found/i.test(raw)) {
    return 'Riot account not found — check Riot ID (Name#TAG) and region.';
  }
  if (status === 429 || /rate limit/i.test(raw)) {
    return 'Henrik rate limit — wait a minute and try again.';
  }
  return raw.length > 180 ? `${raw.slice(0, 180)}…` : raw;
}

function getBridgeConfig() {
  const cfg = loadGrindConfig();
  const henrikApiKey = (
    cfg.henrikApiKey
    || process.env.HENRIK_API_KEY
    || ''
  ).trim();
  const legacyRiotKey = (cfg.riotApiKey || process.env.RIOT_API_KEY || '').trim();
  return {
    riotId: (cfg.riotId || process.env.RIOT_ID || '').trim(),
    riotRegion: (cfg.riotRegion || process.env.RIOT_REGION || 'na').toLowerCase(),
    henrikApiKey: henrikApiKey || (legacyRiotKey.startsWith('RGAPI-') ? '' : legacyRiotKey),
    legacyRiotKey,
  };
}

function isValorantRunning() {
  if (process.platform !== 'win32') return false;
  const r = spawnSync(
    'tasklist',
    ['/FI', 'IMAGENAME eq VALORANT-Win64-Shipping.exe'],
    { encoding: 'utf8', windowsHide: true },
  );
  return (r.stdout || '').includes('VALORANT-Win64-Shipping.exe');
}

function splitRiotId(riotId) {
  if (!riotId.includes('#')) throw new Error('Set Riot ID as Name#TAG in setup');
  const hash = riotId.indexOf('#');
  return {
    name: riotId.slice(0, hash).trim(),
    tag: riotId.slice(hash + 1).trim(),
  };
}

async function henrikFetch(path) {
  const { henrikApiKey, legacyRiotKey } = getBridgeConfig();
  if (!henrikApiKey) {
    if (legacyRiotKey.startsWith('RGAPI-')) {
      throw new Error(formatHenrikError('RGAPI-key-blocked'));
    }
    throw new Error('Henrik API key not set — get one free at api.henrikdev.xyz/dashboard');
  }
  const res = await fetch(`${HENRIK_BASE}${path}`, {
    headers: { Authorization: henrikApiKey },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const msg = body?.errors?.[0]?.message || body?.error || `Henrik API ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  if (body?.status && body.status !== 200) {
    const msg = body.errors?.[0]?.message || `Henrik API ${body.status}`;
    throw Object.assign(new Error(msg), { status: body.status });
  }
  return body;
}

function parseHenrikMatch(match, riotId) {
  if (!match) return null;
  const meta = match.metadata ?? {};
  const stats = match.stats ?? {};
  const teams = match.teams ?? {};
  const team = String(stats.team ?? '').toLowerCase();
  const won = team === 'red'
    ? Boolean(teams.red?.has_won ?? teams.Red?.has_won)
    : team === 'blue'
      ? Boolean(teams.blue?.has_won ?? teams.Blue?.has_won)
      : false;
  const queue = meta.queue ?? meta.mode ?? 'unknown';
  const rounds = stats.rounds_played || stats.roundsPlayed || 1;

  return {
    result: won ? 'W' : 'L',
    mode: MODE_MAP[queue] || meta.mode || queue,
    kills: stats.kills ?? 0,
    deaths: stats.deaths ?? 0,
    valAssists: stats.assists ?? 0,
    acs: Math.round((stats.score ?? 0) / Math.max(rounds, 1)),
    agent: stats.character ?? stats.agent ?? '',
    map: meta.map ?? '',
    matchId: meta.matchid ?? meta.match_id ?? null,
    isRanked: queue === 'competitive',
    endedAt: Date.now(),
    consumed: false,
  };
}

async function fetchLatestHenrikMatch() {
  const { riotId, riotRegion } = getBridgeConfig();
  const { name, tag } = splitRiotId(riotId);
  const region = encodeURIComponent(riotRegion);
  const body = await henrikFetch(
    `/valorant/v3/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?size=1`,
  );
  return body.data?.[0] ?? null;
}

async function pollLatestMatch() {
  const cfg = getBridgeConfig();
  configured = Boolean(cfg.henrikApiKey && cfg.riotId)
    || (Boolean(cfg.legacyRiotKey) && !cfg.legacyRiotKey.startsWith('RGAPI-') && cfg.riotId);
  valorantRunning = isValorantRunning();
  if (!configured && cfg.legacyRiotKey.startsWith('RGAPI-') && cfg.riotId) {
    lastError = formatHenrikError('RGAPI-key-blocked');
    return;
  }
  if (!configured) return;

  try {
    const latest = await fetchLatestHenrikMatch();
    const matchId = latest?.metadata?.matchid ?? latest?.metadata?.match_id ?? null;
    if (!matchId) return;

    if (!seeded) {
      lastSeenMatchId = matchId;
      seeded = true;
      lastError = null;
      console.log('Valorant bridge seeded — waiting for your next match');
      return;
    }

    if (matchId === lastSeenMatchId) return;

    const parsed = parseHenrikMatch(latest, cfg.riotId);
    if (!parsed) return;

    lastSeenMatchId = matchId;
    lastMatch = parsed;
    lastError = null;
    console.log(`Valorant match — ${parsed.result} · ${parsed.mode} · K:${parsed.kills} D:${parsed.deaths} A:${parsed.valAssists} · ${parsed.agent || 'Agent'} · ${parsed.map || 'Map'}`);
  } catch (e) {
    lastError = formatHenrikError(e.message, e.status);
  }
}

export function startValorantBridge() {
  if (pollTimer) return;
  pollTimer = setInterval(pollLatestMatch, 12000);
  pollLatestMatch();
}

export function handleValorantRequest(req, res) {
  const url = req.url?.split('?')[0];

  if (url === '/valorant/status') {
    const cfg = getBridgeConfig();
    const hasHenrik = Boolean(cfg.henrikApiKey)
      || (Boolean(cfg.legacyRiotKey) && !cfg.legacyRiotKey.startsWith('RGAPI-'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      configured: Boolean(hasHenrik && cfg.riotId),
      seeded,
      valorantRunning,
      riotId: cfg.riotId || null,
      lastError,
      needsHenrikKey: Boolean(cfg.legacyRiotKey.startsWith('RGAPI-') && cfg.riotId && !cfg.henrikApiKey),
    }));
    return true;
  }

  if (url === '/valorant/last-match') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(lastMatch));
    return true;
  }

  if (url === '/valorant/last-match/consume' && req.method === 'POST') {
    const out = lastMatch;
    if (lastMatch) lastMatch = { ...lastMatch, consumed: true };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out));
    return true;
  }

  return false;
}

export function resetValorantCache() {
  lastSeenMatchId = null;
  seeded = false;
  lastMatch = null;
  lastError = null;
}

/** Test saved Riot ID + Henrik key (used right after Apply). */
export async function validateRiotConfig() {
  const cfg = getBridgeConfig();
  if (!cfg.riotId) {
    return { ok: false, error: 'Riot ID required (Name#TAG)' };
  }
  if (cfg.legacyRiotKey.startsWith('RGAPI-') && !cfg.henrikApiKey) {
    const msg = formatHenrikError('RGAPI-key-blocked');
    lastError = msg;
    return { ok: false, error: msg };
  }
  if (!cfg.henrikApiKey) {
    return { ok: false, error: 'Henrik API key required — free at api.henrikdev.xyz/dashboard' };
  }
  try {
    await fetchLatestHenrikMatch();
    lastError = null;
    return { ok: true, riotId: cfg.riotId };
  } catch (e) {
    const msg = formatHenrikError(e.message, e.status);
    lastError = msg;
    return { ok: false, error: msg };
  }
}
