/**
 * Valorant auto-log via HenrikDev API (match history).
 * Riot dev keys (RGAPI-…) cannot access Val match endpoints (403) — Henrik is required for personal auto-log.
 * Requires riotId (Name#TAG), riotRegion, and henrikApiKey in grind-config.json.
 */

import { loadGrindConfig, loadValorantBridgeState, saveValorantBridgeState, clearValorantBridgeState } from './local-setup.mjs';

const HENRIK_BASE = 'https://api.henrikdev.xyz';
const HENRIK_POLL_MS = 20000;
const HENRIK_DEFER_MS = 45000;
const AUTO_ARM_MS = 45000;

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

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
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
    agent: payload.agent || '',
    map: payload.map || '',
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

function restorePersistedState() {
  const saved = loadValorantBridgeState();
  if (saved.lastSeenMatchId) {
    lastSeenMatchId = saved.lastSeenMatchId;
    seeded = Boolean(saved.seeded);
  }
}

function persistState() {
  saveValorantBridgeState({
    lastSeenMatchId,
    seeded,
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
    const latest = await fetchLatestHenrikMatch();
    const matchId = latest?.metadata?.matchid ?? latest?.metadata?.match_id ?? null;
    if (!matchId) {
      seeded = false;
      lastSeenMatchId = null;
      persistState();
      return { ok: false, error: 'No match history found for this Riot ID yet' };
    }

    lastSeenMatchId = matchId;
    seeded = true;
    lastError = null;
    persistState();
    console.log('Valorant baseline set — your next finished match will auto-log');
    return { ok: true, matchId };
  } catch (e) {
    lastError = formatHenrikError(e.message, e.status);
    return { ok: false, error: lastError };
  }
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
    const matchId = latest?.metadata?.matchid ?? latest?.metadata?.match_id ?? null;
    if (!matchId) return;

    if (!seeded) {
      await seedValorantBaseline();
      return;
    }

    if (matchId === lastSeenMatchId) return;

    const parsed = parseHenrikMatch(latest, cfg.riotId);
    if (!parsed) return;

    lastSeenMatchId = matchId;
    lastMatch = parsed;
    lastError = null;
    persistState();
    console.log(`Valorant match — ${parsed.result} · ${parsed.mode} · K:${parsed.kills} D:${parsed.deaths} A:${parsed.valAssists} · ${parsed.agent || 'Agent'} · ${parsed.map || 'Map'}`);
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
  pollTimer = setInterval(pollLatestMatch, pollMs);
  pollLatestMatch();
  return { ok: true };
}

export function startValorantBridge(options = {}) {
  restorePersistedState();
  if (seeded && lastSeenMatchId) {
    console.log('Valorant baseline restored — next new match will auto-log');
  }

  const manualArm = options.manualArm !== false;
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
    pollTimer = setInterval(pollLatestMatch, pollMs);
    pollLatestMatch();
  };

  if (deferMs > 0) {
    console.log(`Valorant match polling starts in ${Math.round(deferMs / 1000)}s`);
    deferTimer = setTimeout(beginPolling, deferMs);
  } else {
    beginPolling();
  }
}

export function handleValorantRequest(req, res) {
  const url = req.url?.split('?')[0];

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
        const out = pushOverwolfMatch(body);
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
