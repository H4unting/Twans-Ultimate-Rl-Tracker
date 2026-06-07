/**
 * Valorant auto-log via HenrikDev API (match history).
 * Riot dev keys (RGAPI-…) cannot access Val match endpoints (403) — Henrik is required for personal auto-log.
 * Requires riotId (Name#TAG), riotRegion, and henrikApiKey in config/grind-config.json.
 */

import { loadGrindConfig, loadValorantBridgeState, saveValorantBridgeState, clearValorantBridgeState } from './local-setup.mjs';
import { checkHenrikRateLimit, readJsonBody, validateOverwolfMatch } from './bridge-security.mjs';

const HENRIK_BASE = 'https://api.henrikdev.xyz';
const HENRIK_POLL_MS = 12000;
const HENRIK_DEFER_MS = 45000;
const AUTO_ARM_MS = 45000;
const MAX_SEEN_IDS = 64;
const RECENT_MATCHES_SIZE = 10;

const MODE_MAP = {
  competitive: 'Competitive',
  unrated: 'Unrated',
  swiftplay: 'Swiftplay',
  spikeRush: 'Spike Rush',
  'spike rush': 'Spike Rush',
  spikerush: 'Spike Rush',
  deathmatch: 'Deathmatch',
  ggteam: 'Escalation',
  escalation: 'Escalation',
  replication: 'Replication',
  snowballFight: 'Snowball Fight',
};

let lastMatch = null;
let lastSeenMatchId = null;
let seeded = false;
let baselineGameStart = 0;
let seenMatchIds = new Set();
let pollTimer = null;
let deferTimer = null;
let pollingArmed = false;
let valorantRunning = false;
let configured = false;
let lastError = null;
let lastOverwolfPing = 0;
let overwolfActive = false;

const OVERWOLF_TTL_MS = 45000;

/** Ready to auto-log next finished match (no tasklist — scanning Val during load-in caused freezes). */
function isValorantReady() {
  if (isOverwolfConnected()) return true;
  if (!pollingArmed) return false;
  const cfg = getBridgeConfig();
  const hasHenrik = Boolean(cfg.henrikApiKey)
    || (Boolean(cfg.legacyRiotKey) && !cfg.legacyRiotKey.startsWith('RGAPI-'));
  return Boolean(hasHenrik && cfg.riotId && seeded);
}

function isOverwolfConnected() {
  return overwolfActive && (Date.now() - lastOverwolfPing) < OVERWOLF_TTL_MS;
}

function markOverwolfPing() {
  lastOverwolfPing = Date.now();
  overwolfActive = true;
  configured = true;
  seeded = true;
  lastError = null;
}

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

function parseOverwolfGameMode(raw) {
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const mode = String(o?.mode ?? '').toLowerCase();
    const ranked = String(o?.ranked) === '1';
    if (mode === 'bomb') return ranked ? 'Competitive' : 'Unrated';
    if (mode === 'swiftplay') return 'Swiftplay';
    if (mode === 'spikerush') return 'Spike Rush';
    if (mode === 'deathmatch') return 'Deathmatch';
    if (mode === 'ggteam' || mode === 'escalation') return 'Escalation';
    if (mode === 'snowballfight') return 'Snowball Fight';
    return MODE_MAP[mode] || (mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : 'Unrated');
  } catch {
    return 'Unrated';
  }
}


export function pushOverwolfMatch(payload = {}) {
  markOverwolfPing();
  const outcome = String(payload.match_outcome ?? payload.outcome ?? '').toLowerCase();
  const result = payload.result
    || (outcome === 'victory' ? 'W' : outcome === 'defeat' ? 'L' : null);
  if (!result) return { ok: false, error: 'Missing match result' };

  const matchId = payload.matchId
    || payload.match_id
    || payload.pseudo_match_id
    || `ow-${Date.now()}`;
  if (lastMatch && !lastMatch.consumed && lastMatch.matchId === matchId) {
    return { ok: true, duplicate: true };
  }

  lastMatch = {
    result,
    mode: payload.mode || parseOverwolfGameMode(payload.game_mode),
    kills: Number(payload.kills ?? 0),
    deaths: Number(payload.deaths ?? 0),
    valAssists: Number(payload.valAssists ?? payload.assists ?? 0),
    acs: Number(payload.acs ?? 0),
    agent: String(payload.agent || '').slice(0, 128),
    map: String(payload.map || '').slice(0, 128),
    matchId,
    isRanked: String(payload.mode || '').toLowerCase() === 'competitive'
      || parseOverwolfGameMode(payload.game_mode) === 'Competitive',
    endedAt: Date.now(),
    consumed: false,
    source: 'overwolf',
  };
  lastSeenMatchId = matchId;
  persistState();
  console.log(`Valorant match (Overwolf) — ${lastMatch.result} · ${lastMatch.mode} · K:${lastMatch.kills} D:${lastMatch.deaths} · ${lastMatch.agent || 'Agent'} · ${lastMatch.map || 'Map'}`);
  return { ok: true, match: lastMatch };
}

function getMatchId(match) {
  const meta = match?.metadata ?? {};
  return meta.matchid ?? meta.match_id ?? null;
}

function parseGameStart(meta = {}) {
  const raw = meta.game_start ?? meta.gameStart ?? 0;
  if (typeof raw === 'number') return raw > 1e12 ? raw : raw * 1000;
  const t = Date.parse(String(raw));
  return Number.isFinite(t) ? t : 0;
}

function rememberMatchId(matchId) {
  if (!matchId) return;
  seenMatchIds.add(String(matchId));
  if (seenMatchIds.size > MAX_SEEN_IDS) {
    seenMatchIds = new Set([...seenMatchIds].slice(-MAX_SEEN_IDS));
  }
}

function findPlayerInMatch(match, riotId) {
  const { name, tag } = splitRiotId(riotId);
  const nameL = name.toLowerCase();
  const tagL = tag.toLowerCase();
  const pools = [
    match?.players?.all_players,
    match?.players?.red,
    match?.players?.blue,
    match?.players,
  ].filter(Array.isArray);
  for (const pool of pools) {
    const hit = pool.find((p) =>
      String(p.name ?? p.gameName ?? '').toLowerCase() === nameL
      && String(p.tag ?? p.tagLine ?? '').toLowerCase() === tagL);
    if (hit) return hit;
  }
  if (match?.stats && (match.stats.kills != null || match.stats.character)) {
    return { character: match.stats.character, stats: match.stats, team: match.stats.team };
  }
  return null;
}

function readPlayerStats(player) {
  if (!player) return { kills: 0, deaths: 0, assists: 0, score: 0, rounds: 1, character: '', team: '' };
  const stats = player.stats ?? player;
  return {
    kills: Number(stats.kills ?? player.kills ?? 0) || 0,
    deaths: Number(stats.deaths ?? player.deaths ?? 0) || 0,
    assists: Number(stats.assists ?? player.assists ?? 0) || 0,
    score: Number(stats.score ?? player.score ?? 0) || 0,
    rounds: Number(stats.rounds_played ?? stats.roundsPlayed ?? player.rounds_played ?? 1) || 1,
    character: player.character ?? stats.character ?? stats.agent ?? player.agent ?? '',
    team: String(player.team ?? stats.team ?? '').toLowerCase(),
  };
}

function isLoggableHenrikMatch(parsed) {
  if (!parsed?.matchId) return false;
  const activity = parsed.kills + parsed.deaths + parsed.valAssists;
  if (activity === 0) return false;
  if (baselineGameStart && parsed.gameStart && parsed.gameStart <= baselineGameStart) return false;
  return true;
}

function ingestRecentMatches(recent = []) {
  let maxStart = baselineGameStart;
  for (const m of recent) {
    const id = getMatchId(m);
    if (id) rememberMatchId(id);
    const gs = parseGameStart(m?.metadata ?? {});
    if (gs > maxStart) maxStart = gs;
  }
  if (maxStart > baselineGameStart) baselineGameStart = maxStart;
  const latestId = getMatchId(recent[0]);
  if (latestId) lastSeenMatchId = latestId;
  seeded = true;
  persistState();
}

function restorePersistedState() {
  const saved = loadValorantBridgeState();
  if (saved.lastSeenMatchId) {
    lastSeenMatchId = saved.lastSeenMatchId;
    seeded = Boolean(saved.seeded);
  }
  baselineGameStart = Number(saved.baselineGameStart) || 0;
  seenMatchIds = new Set(
    Array.isArray(saved.seenMatchIds) ? saved.seenMatchIds.slice(-MAX_SEEN_IDS) : [],
  );
}

function persistState() {
  saveValorantBridgeState({
    lastSeenMatchId,
    seeded,
    baselineGameStart,
    seenMatchIds: [...seenMatchIds].slice(-MAX_SEEN_IDS),
  });
}

/** Set baseline to latest Henrik match so the *next* finished game auto-logs. */
export async function seedValorantBaseline() {
  const cfg = getBridgeConfig();
  configured = Boolean(cfg.henrikApiKey && cfg.riotId)
    || (Boolean(cfg.legacyRiotKey) && !cfg.legacyRiotKey.startsWith('RGAPI-') && cfg.riotId);
  if (!configured) {
    return { ok: false, error: 'Riot ID and Henrik key required' };
  }

  try {
    const recent = await fetchRecentHenrikMatches(RECENT_MATCHES_SIZE);
    if (!recent.length) {
      seeded = false;
      lastSeenMatchId = null;
      persistState();
      return { ok: false, error: 'No match history found for this Riot ID yet' };
    }

    ingestRecentMatches(recent);
    lastError = null;
    console.log('Valorant baseline set — your next finished match will auto-log');
    return { ok: true, matchId: lastSeenMatchId };
  } catch (e) {
    lastError = formatHenrikError(e.message, e.status);
    return { ok: false, error: lastError };
  }
}

function getBridgeConfig() {
  const cfg = loadGrindConfig();
  const henrikApiKey = (
    process.env.HENRIK_API_KEY
    || cfg.henrikApiKey
    || ''
  ).trim();
  const legacyRiotKey = (process.env.RIOT_API_KEY || cfg.riotApiKey || '').trim();
  return {
    riotId: (process.env.RIOT_ID || cfg.riotId || '').trim(),
    riotRegion: (process.env.RIOT_REGION || cfg.riotRegion || 'na').toLowerCase(),
    henrikApiKey: henrikApiKey || (legacyRiotKey.startsWith('RGAPI-') ? '' : legacyRiotKey),
    legacyRiotKey,
  };
}

function isValorantRunning() {
  return isValorantReady();
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
  if (!checkHenrikRateLimit()) {
    throw Object.assign(new Error('Henrik API rate limit (local bridge)'), { status: 429 });
  }
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
  const player = findPlayerInMatch(match, riotId);
  if (!player) return null;

  const ps = readPlayerStats(player);
  const teams = match.teams ?? {};
  const team = ps.team;
  const won = team === 'red'
    ? Boolean(teams.red?.has_won ?? teams.Red?.has_won)
    : team === 'blue'
      ? Boolean(teams.blue?.has_won ?? teams.Blue?.has_won)
      : false;
  const queue = meta.queue ?? meta.mode ?? 'unknown';

  return {
    result: won ? 'W' : 'L',
    mode: MODE_MAP[queue] || meta.mode || queue,
    kills: ps.kills,
    deaths: ps.deaths,
    valAssists: ps.assists,
    acs: Math.round(ps.score / Math.max(ps.rounds, 1)),
    agent: ps.character,
    map: meta.map ?? '',
    matchId: getMatchId(match),
    gameStart: parseGameStart(meta),
    isRanked: queue === 'competitive',
    endedAt: Date.now(),
    consumed: false,
  };
}

async function fetchRecentHenrikMatches(size = RECENT_MATCHES_SIZE) {
  const { riotId, riotRegion } = getBridgeConfig();
  const { name, tag } = splitRiotId(riotId);
  const region = encodeURIComponent(riotRegion);
  const body = await henrikFetch(
    `/valorant/v3/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?size=${size}`,
  );
  return body.data ?? [];
}

let mmrHistoryCache = { fetchedAt: 0, rows: [] };

async function fetchMmrHistoryForMatch(matchId) {
  if (!matchId) return null;
  const { riotId, riotRegion } = getBridgeConfig();
  const { name, tag } = splitRiotId(riotId);
  const region = encodeURIComponent(riotRegion);
  try {
    const now = Date.now();
    let rows = mmrHistoryCache.rows;
    if (!rows.length || now - mmrHistoryCache.fetchedAt > 30000) {
      const body = await henrikFetch(
        `/valorant/v2/mmr-history/${region}/pc/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?size=8`,
      );
      rows = body.data ?? [];
      mmrHistoryCache = { fetchedAt: now, rows };
    }
    return rows.find(r => String(r.match_id) === String(matchId)) ?? rows[0] ?? null;
  } catch {
    return null;
  }
}

async function attachRankData(parsed, matchId) {
  if (!parsed?.isRanked || !matchId) return parsed;
  const mmrRow = await fetchMmrHistoryForMatch(matchId);
  if (!mmrRow) return parsed;
  parsed.rrChange = mmrRow.mmr_change_to_last_game ?? null;
  parsed.endRR = mmrRow.ranking_in_tier ?? null;
  const tier = mmrRow.currenttier_patched ?? mmrRow.currenttier ?? mmrRow.current_tier;
  if (tier) parsed.endRank = String(tier).trim();
  return parsed;
}

async function fetchLatestHenrikMatch() {
  const recent = await fetchRecentHenrikMatches(1);
  return recent[0] ?? null;
}

async function pollLatestMatch() {
  if (isOverwolfConnected()) {
    valorantRunning = true;
    return;
  }

  const cfg = getBridgeConfig();
  configured = Boolean(cfg.henrikApiKey && cfg.riotId)
    || (Boolean(cfg.legacyRiotKey) && !cfg.legacyRiotKey.startsWith('RGAPI-') && cfg.riotId);
  valorantRunning = isValorantReady();
  if (!configured && cfg.legacyRiotKey.startsWith('RGAPI-') && cfg.riotId) {
    lastError = formatHenrikError('RGAPI-key-blocked');
    return;
  }
  if (!configured) return;

  try {
    const latest = await fetchLatestHenrikMatch();
    const matchId = getMatchId(latest);
    if (!matchId) return;

    if (!seeded) {
      await seedValorantBaseline();
      return;
    }

    const parsed = parseHenrikMatch(latest, cfg.riotId);
    if (!parsed) return;

    const activity = parsed.kills + parsed.deaths + parsed.valAssists;
    if (activity === 0) {
      // Henrik often lists the match before stats are filled — retry on next poll
      return;
    }

    if (!isLoggableHenrikMatch(parsed)) {
      if (matchId !== lastSeenMatchId) {
        rememberMatchId(matchId);
        lastSeenMatchId = matchId;
        persistState();
      }
      return;
    }

    if (matchId === lastSeenMatchId && lastMatch && !lastMatch.consumed && lastMatch.matchId === matchId) {
      return;
    }

    if (matchId === lastSeenMatchId && lastMatch?.consumed) {
      return;
    }

    let ready = parsed;
    ready = await attachRankData(ready, matchId);
    lastMatch = ready;
    rememberMatchId(matchId);
    lastSeenMatchId = matchId;
    baselineGameStart = Math.max(baselineGameStart, ready.gameStart || 0);
    lastError = null;
    persistState();
    console.log(`Valorant match — ${ready.result} · ${ready.mode} · K:${ready.kills} D:${ready.deaths} A:${ready.valAssists} · ${ready.agent || 'Agent'} · ${ready.map || 'Map'}`);
  } catch (e) {
    lastError = formatHenrikError(e.message, e.status);
  }
}

export function armValorantPolling(options = {}) {
  if (pollTimer) return { ok: true, already: true };
  pollingArmed = true;
  if (deferTimer) {
    clearTimeout(deferTimer);
    deferTimer = null;
  }
  const pollMs = Number(options.pollMs ?? HENRIK_POLL_MS);
  console.log('Valorant match polling armed — will check Henrik for new finished matches');

  const startLoop = () => {
    if (pollTimer) return;
    pollTimer = setInterval(pollLatestMatch, pollMs);
    pollLatestMatch();
  };

  fetchRecentHenrikMatches(RECENT_MATCHES_SIZE)
    .then((recent) => {
      if (recent.length) ingestRecentMatches(recent);
    })
    .catch(() => {})
    .finally(startLoop);

  return { ok: true };
}

export function startValorantBridge(options = {}) {
  restorePersistedState();
  if (seeded && lastSeenMatchId) {
    console.log('Valorant baseline restored — next new match will auto-log');
  }

  const manualArm = options.manualArm !== false;
  const launcherMode = Boolean(options.launcherMode);
  if (manualArm) {
    console.log('');
    console.log('  STEP 2 REQUIRED: open http://localhost:8080 in your browser');
    console.log('  That arms auto-log. Launching Val alone does nothing yet.');
    console.log(`  (If you skip the browser, auto-log arms automatically in ${Math.round(AUTO_ARM_MS / 1000)}s)`);
    console.log('');
    deferTimer = setTimeout(() => {
      if (!pollingArmed && !pollTimer) {
        console.log('Auto-arming match polling — finished games will auto-log after this');
        armValorantPolling();
      }
    }, AUTO_ARM_MS);
    return;
  }

  pollingArmed = true;
  const deferMs = Number(options.deferPollMs ?? HENRIK_DEFER_MS);
  const pollMs = Number(options.pollMs ?? HENRIK_POLL_MS);
  const beginPolling = () => {
    if (pollTimer) return;
    if (launcherMode) {
      if (seeded && lastSeenMatchId) {
        console.log('[valorant-launcher] Baseline seeded — waiting for next finished match');
      } else {
        console.log('[valorant-launcher] Polling armed — seeding baseline from Henrik');
      }
    }
    pollTimer = setInterval(pollLatestMatch, pollMs);
    pollLatestMatch();
  };

  if (launcherMode) {
    console.log('[valorant-launcher] Polling armed — Henrik match watch starting now');
    beginPolling();
  } else if (deferMs > 0) {
    console.log(`Valorant match polling starts in ${Math.round(deferMs / 1000)}s`);
    deferTimer = setTimeout(beginPolling, deferMs);
  } else {
    beginPolling();
  }
}

export function handleValorantRequest(req, res) {
  const url = req.url?.split('?')[0];

  if (url === '/valorant/reset-baseline' && req.method === 'POST') {
    resetValorantCache({ full: true });
    lastMatch = null;
    pollingArmed = Boolean(pollTimer);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  if (url === '/valorant/arm' && req.method === 'POST') {
    const out = armValorantPolling();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out));
    return true;
  }

  if (url === '/valorant/overwolf/ping' && req.method === 'POST') {
    markOverwolfPing();
    valorantRunning = true;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  if (url === '/valorant/overwolf-match' && req.method === 'POST') {
    readJsonBody(req)
      .then((body) => {
        const validated = validateOverwolfMatch(body);
        const out = pushOverwolfMatch(validated);
        res.writeHead(out.ok ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(out));
      })
      .catch((e) => {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      });
    return true;
  }

  if (url === '/valorant/status') {
    valorantRunning = isValorantReady();
    const cfg = getBridgeConfig();
    const hasHenrik = Boolean(cfg.henrikApiKey)
      || (Boolean(cfg.legacyRiotKey) && !cfg.legacyRiotKey.startsWith('RGAPI-'));
    const ow = isOverwolfConnected();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      configured: ow || Boolean(hasHenrik && cfg.riotId),
      seeded: seeded || ow,
      valorantRunning,
      riotId: cfg.riotId || null,
      lastError: ow ? null : lastError,
      needsHenrikKey: !ow && Boolean(cfg.legacyRiotKey.startsWith('RGAPI-') && cfg.riotId && !cfg.henrikApiKey),
      source: ow ? 'overwolf' : 'henrik',
      overwolfConnected: ow,
      pollingArmed: ow || pollingArmed,
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

export function resetValorantCache({ full = false } = {}) {
  lastMatch = null;
  lastError = null;
  if (!full) return;
  lastSeenMatchId = null;
  seeded = false;
  baselineGameStart = 0;
  seenMatchIds = new Set();
  clearValorantBridgeState();
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
    const seed = await seedValorantBaseline();
    if (!seed.ok) {
      return { ok: false, error: seed.error || 'Could not set Valorant baseline' };
    }
    return { ok: true, riotId: cfg.riotId, seeded: true };
  } catch (e) {
    const msg = formatHenrikError(e.message, e.status);
    lastError = msg;
    return { ok: false, error: msg };
  }
}
