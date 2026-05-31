/** Shared local bridge online state (RL + Valorant) — one heartbeat, debounced */

const BRIDGE = 'http://127.0.0.1:49200';
const HEARTBEAT_MS = 2500;
const PING_TIMEOUT_MS = 4000;
/** Consecutive failed pings before going offline (after grace expires) */
const OFFLINE_AFTER_MISSES = 5;
/** Stay "online" through brief hiccups right after a good ping */
const ONLINE_GRACE_MS = 20000;

let bridgeOnline = false;
let failStreak = 0;
let lastSuccessAt = 0;
let heartbeatId = null;
let heartbeatPromise = null;
let visibilityWired = false;
const listeners = new Set();

export function subscribeBridgeOnline(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getBridgeUrl() {
  return BRIDGE;
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

async function pingBridgeOnce() {
  const res = await fetch(`${BRIDGE}/status`, { signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
  if (!res.ok) throw new Error('bridge offline');
  return res.json();
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
      failStreak += 1;
      const withinGrace = lastSuccessAt && (Date.now() - lastSuccessAt) < ONLINE_GRACE_MS;
      if (!withinGrace && failStreak >= OFFLINE_AFTER_MISSES) {
        setBridgeOnline(false);
      }
    } finally {
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
  if (!isBridgeUp()) return null;
  try {
    return await pingBridgeOnce();
  } catch {
    return null;
  }
}
