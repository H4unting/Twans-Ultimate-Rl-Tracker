/** Shared local bridge online state (RL + Valorant) — one heartbeat, debounced */

const BRIDGE_PORT = 49200;
const TRACKER_PORT = 8080;
const HEARTBEAT_MS = 2500;
const PING_TIMEOUT_MS = 4000;
/** Consecutive failed pings before going offline (after grace expires) */
const OFFLINE_AFTER_MISSES = 20;
/** Stay "online" through brief hiccups right after a good ping */
const ONLINE_GRACE_MS = 120000;
/** While the tab is hidden (you're in Val), stay optimistic much longer */
const HIDDEN_GRACE_MS = 15 * 60 * 1000;

let bridgeOnline = false;
let failStreak = 0;
let lastSuccessAt = 0;
let bridgeProbeDone = false;
let heartbeatId = null;
let heartbeatPromise = null;
let visibilityWired = false;
/** Session token injected by tracker proxy — required for mutating bridge POSTs. */
let bridgeAuthToken = null;
const listeners = new Set();

export function subscribeBridgeOnline(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** @typedef {'ok'|'wrong_port'|'wrong_server'|'bridge_down'|'unreachable'|'wrong_tracker_alive'} BridgeFailureKind */

let lastBridgeFailure = /** @type {BridgeFailureKind|null} */ (null);
/** True when /api/bridge 404s but direct :49200 /status responds — wrong app on port 8080. */
let bridgeProcessOnDirectPort = false;

export function getLastBridgeFailure() {
  return lastBridgeFailure;
}

export function isBridgeProcessDetected() {
  return bridgeProcessOnDirectPort;
}

async function probeDirectBridge() {
  try {
    const res = await fetch(`http://127.0.0.1:${BRIDGE_PORT}/status`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

function isOnTrackerPort() {
  const h = window.location.hostname;
  const p = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
  return (h === 'localhost' || h === '127.0.0.1') && p === '8080';
}

export function getBridgeUrl() {
  const h = window.location.hostname;
  const p = window.location.port;
  if (isOnTrackerPort()) {
    return `${window.location.origin}/api/bridge`;
  }
  if (h === 'localhost' || h === '127.0.0.1') {
    return `http://${h}:8080/api/bridge`;
  }
  return `http://127.0.0.1:${BRIDGE_PORT}`;
}

function bridgeBase() {
  return getBridgeUrl();
}

function notifyBridgeOnline() {
  listeners.forEach(fn => {
    try { fn(bridgeOnline); } catch { /* ignore */ }
  });
}

export function setBridgeOnline(online) {
  const next = Boolean(online);
  if (next === bridgeOnline) return;
  bridgeOnline = next;
  if (next) failStreak = 0;
  notifyBridgeOnline();
}

export function isBridgeUp() {
  return bridgeOnline;
}

export function isBridgeProbeDone() {
  return bridgeProbeDone;
}

async function pingBridgeOnce() {
  const res = await fetch(`${bridgeBase()}/status`, { signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
  if (res.status === 404 && bridgeBase().includes('/api/bridge')) {
    bridgeProcessOnDirectPort = await probeDirectBridge();
    lastBridgeFailure = bridgeProcessOnDirectPort ? 'wrong_tracker_alive' : 'wrong_server';
    throw new Error(lastBridgeFailure);
  }
  if (res.status === 502) {
    bridgeProcessOnDirectPort = await probeDirectBridge();
    lastBridgeFailure = bridgeProcessOnDirectPort ? 'wrong_tracker_alive' : 'bridge_down';
    throw new Error(lastBridgeFailure);
  }
  if (!res.ok) {
    lastBridgeFailure = 'unreachable';
    bridgeProcessOnDirectPort = false;
    throw new Error('bridge offline');
  }
  const json = await res.json();
  if (json.authToken) bridgeAuthToken = json.authToken;
  lastBridgeFailure = null;
  bridgeProcessOnDirectPort = false;
  return json;
}

/**
 * Fetch bridge API — attaches X-Bridge-Token on mutating requests when using tracker proxy.
 */
export async function bridgeFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && !bridgeAuthToken) {
    await fetchBridgeStatus();
  }
  const headers = { ...(options.headers || {}) };
  if (bridgeAuthToken && method !== 'GET' && method !== 'HEAD') {
    headers['X-Bridge-Token'] = bridgeAuthToken;
  }
  return fetch(`${bridgeBase()}${path}`, { ...options, method, headers });
}

async function heartbeatTick() {
  if (heartbeatPromise) return heartbeatPromise;
  heartbeatPromise = (async () => {
    try {
      await pingBridgeOnce();
      lastSuccessAt = Date.now();
      failStreak = 0;
      setBridgeOnline(true);
    } catch {
      const hidden = document.visibilityState === 'hidden';
      if (!hidden) failStreak += 1;
      if (!lastBridgeFailure) {
        lastBridgeFailure = isOnTrackerPort() ? 'unreachable' : 'wrong_port';
      }
      const age = lastSuccessAt ? Date.now() - lastSuccessAt : Infinity;
      const withinGrace = age < ONLINE_GRACE_MS;
      const withinHiddenGrace = hidden && age < HIDDEN_GRACE_MS;
      if (!withinGrace && !withinHiddenGrace && failStreak >= OFFLINE_AFTER_MISSES) {
        setBridgeOnline(false);
      }
    } finally {
      bridgeProbeDone = true;
      heartbeatPromise = null;
    }
  })();
  return heartbeatPromise;
}

function wireVisibilityRefresh() {
  if (visibilityWired) return;
  visibilityWired = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && heartbeatId) {
      heartbeatTick();
    }
  });
}

export function startBridgeHeartbeat() {
  if (heartbeatId) return;
  failStreak = 0;
  wireVisibilityRefresh();
  heartbeatTick();
  heartbeatId = setInterval(heartbeatTick, HEARTBEAT_MS);
}

export function stopBridgeHeartbeat() {
  if (heartbeatId) clearInterval(heartbeatId);
  heartbeatId = null;
  failStreak = 0;
  lastSuccessAt = 0;
  setBridgeOnline(false);
}

/** Game pollers can fetch /status without affecting online state */
export async function fetchBridgeStatus() {
  try {
    return await pingBridgeOnce();
  } catch {
    return null;
  }
}
