/** Single unified app — no separate glance/grind sites */

import { LOCAL_TRACKER_URL } from './config.js';

export function applyAppMode() {
  document.body.classList.remove('glance-mode', 'grind-mode');
  document.body.classList.add('app-unified');
}

export function setBridgeHintVisible(show) {
  document.getElementById('bridge-hint-banner')?.classList.toggle('hidden', !show);
}

/** Tracker page is served from this PC on the launcher port (required for /api/bridge proxy) */
export function isLocalTrackerHost() {
  const h = window.location.hostname;
  const p = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
  return (h === 'localhost' || h === '127.0.0.1') && p === '8080';
}

/** On localhost but wrong port (Live Server, etc.) — auto-log needs the launcher URL */
export function isWrongLocalPort() {
  const h = window.location.hostname;
  if (h !== 'localhost' && h !== '127.0.0.1') return false;
  return !isLocalTrackerHost();
}

/** GitHub Pages / other HTTPS sites cannot talk to the local auto-log app */
export function needsLocalTrackerForAutoLog() {
  return !isLocalTrackerHost();
}

export function getLocalTrackerUrl() {
  return LOCAL_TRACKER_URL;
}

/** @deprecated Use auth + bridge status instead — always returns true so logging works everywhere */
export function isGrindHost() {
  return true;
}

/** @deprecated Always false — one platform */
export function isGlanceMode() {
  return false;
}
