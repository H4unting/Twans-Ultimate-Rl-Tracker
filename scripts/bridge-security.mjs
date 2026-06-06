/**
 * Local bridge security — rate limits, validation, CORS, auth token (OWASP-oriented).
 * Binds to 127.0.0.1 only; still harden against cross-origin abuse via Private Network Access.
 */

import crypto from 'crypto';

/** Max JSON body size (32 KiB). */
export const MAX_BODY_BYTES = 32 * 1024;

/** Browser origins allowed to call the bridge (via tracker proxy or direct). */
export const ALLOWED_ORIGINS = new Set([
  'http://localhost:8080',
  'http://127.0.0.1:8080',
]);

export const RIOT_REGIONS = new Set(['na', 'eu', 'ap', 'kr', 'br', 'latam', 'esports']);

/** Paths the tracker proxy may forward (prefix match for /valorant/*). */
export const PROXY_BRIDGE_ALLOWLIST = [
  '/status',
  '/setup/status',
  '/setup/apply',
  '/live',
  '/last-match',
  '/last-match/consume',
  '/valorant/reset-baseline',
  '/valorant/arm',
  '/valorant/overwolf/ping',
  '/valorant/overwolf-match',
  '/valorant/status',
  '/valorant/last-match',
  '/valorant/last-match/consume',
];

/** POST routes that require X-Bridge-Token (except Overwolf — rate-limited instead). */
export const AUTH_REQUIRED_POST = new Set([
  '/setup/apply',
  '/last-match/consume',
  '/valorant/reset-baseline',
  '/valorant/arm',
  '/valorant/last-match/consume',
]);

export const OVERWOLF_POST = new Set([
  '/valorant/overwolf/ping',
  '/valorant/overwolf-match',
]);

/** Per-route rate limits: { windowMs, max } per client key. */
export const ROUTE_LIMITS = {
  'POST:/setup/apply': { windowMs: 60_000, max: 8 },
  'POST:/valorant/overwolf-match': { windowMs: 60_000, max: 40 },
  'POST:/valorant/overwolf/ping': { windowMs: 60_000, max: 120 },
  'POST:/valorant/reset-baseline': { windowMs: 60_000, max: 10 },
  'POST:/valorant/arm': { windowMs: 60_000, max: 20 },
  'POST:/last-match/consume': { windowMs: 60_000, max: 60 },
  'POST:/valorant/last-match/consume': { windowMs: 60_000, max: 60 },
  'GET:/status': { windowMs: 60_000, max: 180 },
  'GET:/setup/status': { windowMs: 60_000, max: 60 },
};

const DEFAULT_LIMIT = { windowMs: 60_000, max: 100 };

let bridgeAuthToken = process.env.BRIDGE_AUTH_TOKEN || crypto.randomBytes(32).toString('hex');

/** In-memory hit counters keyed by `${routeKey}:${clientKey}`. */
const rateBuckets = new Map();

export function initBridgeAuth(options = {}) {
  if (options.token) bridgeAuthToken = String(options.token);
  else if (process.env.BRIDGE_AUTH_TOKEN) bridgeAuthToken = process.env.BRIDGE_AUTH_TOKEN;
}

export function getBridgeAuthToken() {
  return bridgeAuthToken;
}

export function isProxyBridgePath(pathname) {
  const path = pathname.split('?')[0];
  if (PROXY_BRIDGE_ALLOWLIST.includes(path)) return true;
  return path.startsWith('/valorant/') && PROXY_BRIDGE_ALLOWLIST.some(p => p.startsWith('/valorant/'));
}

function clientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0] : req.socket?.remoteAddress) || '127.0.0.1';
  const user = req.headers['x-bridge-user'] || 'local';
  return `${ip}:${user}`;
}

function routeLimitKey(method, path) {
  return `${method}:${path.split('?')[0]}`;
}

export function checkRateLimit(req, urlPath) {
  const method = req.method || 'GET';
  const path = urlPath.split('?')[0];
  const routeKey = routeLimitKey(method, path);
  const spec = ROUTE_LIMITS[routeKey]
    || (method === 'POST' ? { windowMs: 60_000, max: 40 } : DEFAULT_LIMIT);
  const bucketKey = `${routeKey}:${clientKey(req)}`;
  const now = Date.now();
  let bucket = rateBuckets.get(bucketKey);
  if (!bucket || now - bucket.windowStart >= spec.windowMs) {
    bucket = { windowStart: now, count: 0 };
  }
  bucket.count += 1;
  rateBuckets.set(bucketKey, bucket);
  if (bucket.count > spec.max) {
    const retryAfterMs = spec.windowMs - (now - bucket.windowStart);
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  return { allowed: true };
}

export function sendRateLimited(res, retryAfterSec = 60) {
  res.writeHead(429, {
    'Content-Type': 'application/json',
    'Retry-After': String(retryAfterSec),
  });
  res.end(JSON.stringify({ ok: false, error: 'Too many requests', retryAfter: retryAfterSec }));
}

export function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Bridge-Token');
}

export function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function rejectExtraKeys(obj, allowed) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('Expected JSON object body');
  }
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) throw new Error(`Unexpected field: ${key}`);
  }
}

function clampString(val, maxLen, field) {
  const s = String(val ?? '').trim();
  if (s.length > maxLen) throw new Error(`${field} exceeds ${maxLen} characters`);
  return s;
}

/** Schema validation for POST /setup/apply — strips secrets from unexpected fields. */
export function validateSetupApply(body) {
  rejectExtraKeys(body, ['rlDisplayName', 'riotId', 'henrikApiKey', 'riotApiKey', 'riotRegion', 'patchIni']);

  const rlDisplayName = body.rlDisplayName != null
    ? clampString(body.rlDisplayName, 64, 'rlDisplayName').replace(/[^\w\s\-_.|]/g, '')
    : '';
  const riotId = body.riotId != null ? clampString(body.riotId, 64, 'riotId') : '';
  if (riotId && !/^[\w\s.\-]{1,32}#[\w]{2,16}$/i.test(riotId)) {
    throw new Error('Riot ID must be Name#TAG');
  }

  const keyRaw = body.henrikApiKey ?? body.riotApiKey ?? '';
  const henrikApiKey = keyRaw != null && String(keyRaw).trim()
    ? clampString(keyRaw, 128, 'henrikApiKey')
    : '';
  if (henrikApiKey.startsWith('RGAPI-')) {
    throw new Error('Use a Henrik API key (HDEV-…), not a Riot RGAPI key');
  }
  if (henrikApiKey && !/^HDEV-[A-Za-z0-9_-]+$/.test(henrikApiKey)) {
    throw new Error('Invalid Henrik API key format');
  }

  let riotRegion = body.riotRegion != null ? clampString(body.riotRegion, 16, 'riotRegion').toLowerCase() : '';
  if (riotRegion && !RIOT_REGIONS.has(riotRegion)) {
    throw new Error(`Invalid riotRegion (allowed: ${[...RIOT_REGIONS].join(', ')})`);
  }

  const patchIni = body.patchIni !== false;

  if (!rlDisplayName && !riotId) throw new Error('Enter your Rocket League or Riot ID first');

  return { rlDisplayName, riotId, henrikApiKey, riotRegion, patchIni };
}

const OW_ALLOWED = [
  'result', 'match_outcome', 'outcome', 'matchId', 'match_id', 'pseudo_match_id',
  'mode', 'game_mode', 'kills', 'deaths', 'assists', 'valAssists', 'acs', 'agent', 'map',
];

/** Schema validation for Overwolf match payloads. */
export function validateOverwolfMatch(body) {
  rejectExtraKeys(body, OW_ALLOWED);

  const sanitized = {};
  for (const key of ['agent', 'map', 'mode', 'matchId', 'match_id', 'pseudo_match_id', 'game_mode', 'match_outcome', 'outcome', 'result']) {
    if (body[key] != null) sanitized[key] = clampString(body[key], 128, key);
  }
  for (const key of ['kills', 'deaths', 'assists', 'valAssists', 'acs']) {
    if (body[key] != null) {
      const n = Number(body[key]);
      if (!Number.isFinite(n) || n < 0 || n > 999) throw new Error(`Invalid ${key}`);
      sanitized[key] = Math.floor(n);
    }
  }
  return sanitized;
}

export function requireBridgeAuth(req, res, urlPath) {
  const path = urlPath.split('?')[0];
  const method = req.method || 'GET';
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;

  if (OVERWOLF_POST.has(path)) {
    const expected = process.env.OVERWOLF_BRIDGE_TOKEN;
    if (expected) {
      const got = req.headers['x-bridge-token'] || req.headers['x-overwolf-token'];
      if (got !== expected) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
        return false;
      }
    }
    return true;
  }

  if (!AUTH_REQUIRED_POST.has(path)) return true;

  const token = req.headers['x-bridge-token'];
  if (!token || token !== bridgeAuthToken) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized — refresh the tracker page' }));
    return false;
  }
  return true;
}

/** Henrik outbound rate limit (protect API quota if bridge is abused). */
let henrikCalls = { windowStart: 0, count: 0 };
const HENRIK_LIMIT = { windowMs: 60_000, max: 45 };

export function checkHenrikRateLimit() {
  const now = Date.now();
  if (now - henrikCalls.windowStart >= HENRIK_LIMIT.windowMs) {
    henrikCalls = { windowStart: now, count: 0 };
  }
  henrikCalls.count += 1;
  return henrikCalls.count <= HENRIK_LIMIT.max;
}
