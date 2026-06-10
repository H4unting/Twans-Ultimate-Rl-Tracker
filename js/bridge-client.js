/** Shared local bridge online state (RL + Valorant) — one heartbeat, debounced */

import { getInternalTrackerApiOrigin, isTwansAppHost } from './env.js';
import { isDashboardIdle } from './dash-context.js';

const BRIDGE_PORT = 49200;
const HEARTBEAT_ACTIVE_MS = 2500;
const HEARTBEAT_IDLE_MS = 4000;
const HEARTBEAT_HIDDEN_MS = 5000;
const HEARTBEAT_STARTUP_MS = 400;
const HEARTBEAT_DASH_IDLE_MS = 6000;
const STARTUP_PHASE_MAX_MS = 8000;
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
let heartbeatTimer = null;
let heartbeatPromise = null;
let visibilityWired = false;
/** Session token injected by tracker proxy — required for mutating bridge POSTs. */
let bridgeAuthToken = null;
const listeners = new Set();
const reachableListeners = new Set();
const resumedListeners = new Set();
let lastReachableEmitted = false;
let connectAttempts = 0;
let wasEverOnline = false;
let reconnecting = false;
let inStartupPhase = true;
let startupPhaseTimer = null;

export function endBridgeStartupPhase() {
  inStartupPhase = false;
  if (startupPhaseTimer) {
    clearTimeout(startupPhaseTimer);
    startupPhaseTimer = null;
  }
}

/** @typedef {'connecting'|'tracking'|'waiting'|'error'} BridgeStatusPhase */

export function subscribeBridgeOnline(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function subscribeBridgeReachable(fn) {
  reachableListeners.add(fn);
  fn(isBridgeReachable());
  return () => reachableListeners.delete(fn);
}

export function subscribeBridgeResumed(fn) {
  resumedListeners.add(fn);
  return () => resumedListeners.delete(fn);
}

function notifyBridgeResumed() {
  resumedListeners.forEach(fn => {
    try { fn(); } catch { /* ignore */ }
  });
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
    if (!res.ok) return false;
    try {
      const json = await res.json();
      if (json.authToken) bridgeAuthToken = json.authToken;
    } catch { /* ignore */ }
    return true;
  } catch {
    return false;
  }
}

function isOnTrackerPort() {
  if (isTwansAppHost()) return true;
  const h = window.location.hostname;
  const p = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
  return (h === 'localhost' || h === '127.0.0.1') && p === '8080';
}

export function getBridgeUrl() {
  if (bridgeProcessOnDirectPort) {
    return `http://127.0.0.1:${BRIDGE_PORT}`;
  }
  if (isTwansAppHost()) {
    return `${getInternalTrackerApiOrigin()}/api/bridge`;
  }
  const h = window.location.hostname;
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

/** True when proxy or direct :49200 /status responds — enough for setup Apply. */
export function isBridgeReachable() {
  return bridgeOnline || bridgeProcessOnDirectPort;
}

function emitReachableIfChanged() {
  const reachable = isBridgeReachable();
  if (reachable === lastReachableEmitted) return;
  lastReachableEmitted = reachable;
  reachableListeners.forEach(fn => {
    try { fn(reachable); } catch { /* ignore */ }
  });
}

export function isBridgeProbeDone() {
  return bridgeProbeDone;
}

export function getBridgeConnectAttempts() {
  return connectAttempts;
}

export function isBridgeReconnecting() {
  return reconnecting;
}

/** High-level status for UI pills — Tracking / Waiting / Error / Reconnecting */
export function getBridgeStatusPhase() {
  if (reconnecting) return 'reconnecting';
  if (!bridgeProbeDone && (isOnTrackerPort() || window.location.hostname === 'localhost')) {
    return 'connecting';
  }
  if (!isBridgeReachable()) {
    return 'error';
  }
  if (!bridgeOnline) {
    return connectAttempts > 3 ? 'error' : 'connecting';
  }
  return 'waiting';
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
      connectAttempts = 0;
      if (reconnecting) {
        reconnecting = false;
        notifyBridgeResumed();
      }
      wasEverOnline = true;
      setBridgeOnline(true);
    } catch {
      connectAttempts += 1;
      if (wasEverOnline && !bridgeOnline) reconnecting = true;
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
      emitReachableIfChanged();
      heartbeatPromise = null;
    }
  })();
  return heartbeatPromise;
}

function getHeartbeatMs() {
  if (document.visibilityState === 'hidden') return HEARTBEAT_HIDDEN_MS;
  if (inStartupPhase) return HEARTBEAT_STARTUP_MS;
  if (reconnecting || !bridgeOnline) return HEARTBEAT_ACTIVE_MS;
  if (isDashboardIdle()) return HEARTBEAT_DASH_IDLE_MS;
  return HEARTBEAT_IDLE_MS;
}

function scheduleHeartbeat() {
  if (heartbeatTimer) clearTimeout(heartbeatTimer);
  heartbeatTimer = setTimeout(async () => {
    await heartbeatTick();
    if (heartbeatTimer !== null) scheduleHeartbeat();
  }, getHeartbeatMs());
}

function wireVisibilityRefresh() {
  if (visibilityWired) return;
  visibilityWired = true;
  document.addEventListener('visibilitychange', () => {
    if (heartbeatTimer === null) return;
    if (document.visibilityState === 'visible') {
      heartbeatTick();
    }
    scheduleHeartbeat();
  });
}

export function startBridgeHeartbeat() {
  if (heartbeatTimer !== null) return;
  failStreak = 0;
  inStartupPhase = true;
  if (startupPhaseTimer) clearTimeout(startupPhaseTimer);
  startupPhaseTimer = setTimeout(endBridgeStartupPhase, STARTUP_PHASE_MAX_MS);
  wireVisibilityRefresh();
  void heartbeatTick();
  scheduleHeartbeat();
}

export function stopBridgeHeartbeat() {
  if (heartbeatTimer) clearTimeout(heartbeatTimer);
  heartbeatTimer = null;
  failStreak = 0;
  lastSuccessAt = 0;
  bridgeProcessOnDirectPort = false;
  lastReachableEmitted = false;
  reconnecting = false;
  wasEverOnline = false;
  setBridgeOnline(false);
  emitReachableIfChanged();
}

/** Game pollers can fetch /status without affecting online state */
export async function fetchBridgeStatus() {
  try {
    return await pingBridgeOnce();
  } catch {
    return null;
  }
}
