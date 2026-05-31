/**
 * Valorant auto-log via Riot API — polls when Valorant is running.
 * Requires riotId (Name#TAG), riotRegion, and riotApiKey in grind-config.json or env.
 */

import { spawnSync } from 'child_process';
import { loadGrindConfig } from './local-setup.mjs';

const REGION_HOSTS = {
  na: 'https://americas.api.riotgames.com',
  latam: 'https://americas.api.riotgames.com',
  br: 'https://americas.api.riotgames.com',
  eu: 'https://europe.api.riotgames.com',
  ap: 'https://asia.api.riotgames.com',
  kr: 'https://asia.api.riotgames.com',
};

const VAL_SHARD = {
  na: 'na',
  latam: 'na',
  br: 'na',
  eu: 'eu',
  ap: 'ap',
  kr: 'kr',
};

let lastMatch = null;
let lastSeenMatchId = null;
let puuidCache = null;
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

async function riotFetch(path, region = 'na') {
  const { riotApiKey } = getBridgeConfig();
  if (!riotApiKey) throw new Error('Riot API key not set');
  const host = REGION_HOSTS[region] || REGION_HOSTS.na;
  const res = await fetch(`${host}${path}`, {
    headers: { 'X-Riot-Token': riotApiKey },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Riot API ${res.status}`);
  }
  return res.json();
}

async function resolvePuuid() {
  if (puuidCache) return puuidCache;
  const { riotId, riotRegion } = getBridgeConfig();
  if (!riotId.includes('#')) throw new Error('Set Riot ID as Name#TAG in setup');
  const [gameName, tagLine] = riotId.split('#');
  const account = await riotFetch(
    `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    riotRegion,
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
  const map = data.matchInfo?.mapId?.split('/')?.pop() ?? '';
  const queue = data.matchInfo?.queueId ?? 'unknown';
  const modeMap = {
    competitive: 'Competitive',
    unrated: 'Unrated',
    swiftplay: 'Swiftplay',
    spike rush: 'Spike Rush',
    deathmatch: 'Deathmatch',
  };
  const mode = modeMap[queue] || queue;

  return {
    result: won ? 'W' : 'L',
    mode,
    kills: stats.kills ?? 0,
    deaths: stats.deaths ?? 0,
    valAssists: stats.assists ?? 0,
    acs: Math.round(stats.score ?? 0),
    agent: player.characterId?.split('/')?.pop() ?? '',
    map,
    matchId: data.matchInfo?.matchId,
    isRanked: queue === 'competitive',
    endedAt: Date.now(),
    consumed: false,
  };
}

async function pollLatestMatch() {
  const { riotRegion } = getBridgeConfig();
  configured = Boolean(getBridgeConfig().riotApiKey && getBridgeConfig().riotId);
  valorantRunning = isValorantRunning();
  if (!configured || !valorantRunning) return;

  try {
    const puuid = await resolvePuuid();
    const shard = VAL_SHARD[riotRegion] || 'na';
    const host = REGION_HOSTS[riotRegion] || REGION_HOSTS.na;
    const listRes = await fetch(
      `${host}/val/match/v1/matchlists/by-puuid/${puuid}?size=1`,
      { headers: { 'X-Riot-Token': getBridgeConfig().riotApiKey } },
    );
    if (!listRes.ok) throw new Error(await listRes.text());
    const list = await listRes.json();
    const matchId = list.history?.[0]?.matchId;
    if (!matchId || matchId === lastSeenMatchId) return;

    const matchRes = await fetch(
      `${host}/val/match/v1/matches/${matchId}`,
      { headers: { 'X-Riot-Token': getBridgeConfig().riotApiKey } },
    );
    if (!matchRes.ok) throw new Error(await matchRes.text());
    const parsed = parseValorantMatch(await matchRes.json(), puuid);
    if (!parsed) return;

    lastSeenMatchId = matchId;
    lastMatch = parsed;
    lastError = null;
    console.log(`Valorant match — ${parsed.result} · ${parsed.mode} · K:${parsed.kills} D:${parsed.deaths} A:${parsed.valAssists}`);
  } catch (e) {
    lastError = e.message;
  }
}

export function startValorantBridge() {
  if (pollTimer) return;
  pollTimer = setInterval(pollLatestMatch, 15000);
  pollLatestMatch();
}

export function handleValorantRequest(req, res) {
  const url = req.url?.split('?')[0];

  if (url === '/valorant/status') {
    const cfg = getBridgeConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      configured: Boolean(cfg.riotApiKey && cfg.riotId),
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
  lastSeenMatchId = null;
}
