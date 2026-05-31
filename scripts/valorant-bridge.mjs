/**
 * Valorant auto-log via Riot API — polls when configured.
 * Requires riotId (Name#TAG), riotRegion, and riotApiKey in grind-config.json or env.
 */

import { spawnSync } from 'child_process';
import { loadGrindConfig } from './local-setup.mjs';
import { resolveAgentName, resolveMapName } from './valorant-ids.mjs';

const ACCOUNT_HOSTS = {
  na: 'https://americas.api.riotgames.com',
  latam: 'https://americas.api.riotgames.com',
  br: 'https://americas.api.riotgames.com',
  eu: 'https://europe.api.riotgames.com',
  ap: 'https://asia.api.riotgames.com',
  kr: 'https://asia.api.riotgames.com',
};

const PLATFORM_HOSTS = {
  na: 'https://na.api.riotgames.com',
  latam: 'https://latam.api.riotgames.com',
  br: 'https://br.api.riotgames.com',
  eu: 'https://eu.api.riotgames.com',
  ap: 'https://ap.api.riotgames.com',
  kr: 'https://kr.api.riotgames.com',
};

const VAL_SHARD = {
  na: 'na',
  latam: 'latam',
  br: 'br',
  eu: 'eu',
  ap: 'ap',
  kr: 'kr',
};

let lastMatch = null;
let lastSeenMatchId = null;
let seeded = false;
let puuidCache = null;
let platformHostCache = null;
let pollTimer = null;
let valorantRunning = false;
let configured = false;
let lastError = null;

function getBridgeConfig() {
  const cfg = loadGrindConfig();
  return {
    riotId: (cfg.riotId || process.env.RIOT_ID || '').trim(),
    riotRegion: (cfg.riotRegion || process.env.RIOT_REGION || 'na').toLowerCase(),
    riotApiKey: (cfg.riotApiKey || process.env.RIOT_API_KEY || '').trim(),
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

async function riotFetch(path, host) {
  const { riotApiKey } = getBridgeConfig();
  if (!riotApiKey) throw new Error('Riot API key not set');
  const res = await fetch(`${host}${path}`, {
    headers: { 'X-Riot-Token': riotApiKey },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Riot API ${res.status}`);
  }
  return res.json();
}

async function resolvePlatformHost(riotRegion) {
  if (platformHostCache) return platformHostCache;
  const shard = VAL_SHARD[riotRegion] || 'na';
  platformHostCache = PLATFORM_HOSTS[shard] || PLATFORM_HOSTS.na;
  try {
    const puuid = await resolvePuuid();
    const accountHost = ACCOUNT_HOSTS[riotRegion] || ACCOUNT_HOSTS.na;
    const shardInfo = await riotFetch(
      `/riot/account/v1/active-shards/by-game/val/by-puuid/${puuid}`,
      accountHost,
    );
    const active = String(shardInfo.activeShard || shard).toLowerCase();
    platformHostCache = PLATFORM_HOSTS[active] || platformHostCache;
  } catch {
    /* fall back to region shard */
  }
  return platformHostCache;
}

async function resolvePuuid() {
  if (puuidCache) return puuidCache;
  const { riotId, riotRegion } = getBridgeConfig();
  if (!riotId.includes('#')) throw new Error('Set Riot ID as Name#TAG in setup');
  const [gameName, tagLine] = riotId.split('#');
  const accountHost = ACCOUNT_HOSTS[riotRegion] || ACCOUNT_HOSTS.na;
  const account = await riotFetch(
    `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    accountHost,
  );
  puuidCache = account.puuid;
  return puuidCache;
}

function parseValorantMatch(data, puuid) {
  const player = data.players?.find(p => p.puuid === puuid);
  if (!player) return null;
  const team = player.teamId;
  const won = data.teams?.find(t => t.teamId === team)?.won ?? false;
  const stats = player.stats ?? {};
  const map = resolveMapName(data.matchInfo?.mapId ?? '');
  const queue = data.matchInfo?.queueId ?? 'unknown';
  const modeMap = {
    competitive: 'Competitive',
    unrated: 'Unrated',
    swiftplay: 'Swiftplay',
    spike rush: 'Spike Rush',
    deathmatch: 'Deathmatch',
    escalation: 'Escalation',
    replication: 'Replication',
    snowball: 'Snowball Fight',
  };
  const mode = modeMap[queue] || queue;
  const rounds = stats.roundsPlayed || 1;
  const agent = resolveAgentName(player.characterId);

  return {
    result: won ? 'W' : 'L',
    mode,
    kills: stats.kills ?? 0,
    deaths: stats.deaths ?? 0,
    valAssists: stats.assists ?? 0,
    acs: Math.round((stats.score ?? 0) / rounds),
    agent,
    map,
    matchId: data.matchInfo?.matchId,
    isRanked: queue === 'competitive',
    endedAt: Date.now(),
    consumed: false,
  };
}

async function fetchLatestMatchId() {
  const { riotRegion, riotApiKey } = getBridgeConfig();
  const puuid = await resolvePuuid();
  const platformHost = await resolvePlatformHost(riotRegion);
  const listRes = await fetch(
    `${platformHost}/val/match/v1/matchlists/by-puuid/${puuid}?size=1`,
    { headers: { 'X-Riot-Token': riotApiKey } },
  );
  if (!listRes.ok) throw new Error(await listRes.text());
  const list = await listRes.json();
  return list.history?.[0]?.matchId ?? null;
}

async function pollLatestMatch() {
  const cfg = getBridgeConfig();
  configured = Boolean(cfg.riotApiKey && cfg.riotId);
  valorantRunning = isValorantRunning();
  if (!configured) return;

  try {
    const matchId = await fetchLatestMatchId();
    if (!matchId) return;

    if (!seeded) {
      lastSeenMatchId = matchId;
      seeded = true;
      lastError = null;
      console.log('Valorant bridge seeded — waiting for your next match');
      return;
    }

    if (matchId === lastSeenMatchId) return;

    const { riotRegion, riotApiKey } = cfg;
    const platformHost = await resolvePlatformHost(riotRegion);
    const matchRes = await fetch(
      `${platformHost}/val/match/v1/matches/${matchId}`,
      { headers: { 'X-Riot-Token': riotApiKey } },
    );
    if (!matchRes.ok) throw new Error(await matchRes.text());

    const puuid = await resolvePuuid();
    const parsed = parseValorantMatch(await matchRes.json(), puuid);
    if (!parsed) return;

    lastSeenMatchId = matchId;
    lastMatch = parsed;
    lastError = null;
    console.log(`Valorant match — ${parsed.result} · ${parsed.mode} · K:${parsed.kills} D:${parsed.deaths} A:${parsed.valAssists} · ${parsed.agent || 'Agent'} · ${parsed.map || 'Map'}`);
  } catch (e) {
    lastError = e.message;
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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      configured: Boolean(cfg.riotApiKey && cfg.riotId),
      seeded,
      valorantRunning,
      riotId: cfg.riotId || null,
      lastError,
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
  puuidCache = null;
  platformHostCache = null;
  lastSeenMatchId = null;
  seeded = false;
  lastMatch = null;
  lastError = null;
}
