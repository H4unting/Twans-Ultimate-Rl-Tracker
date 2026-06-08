/** Single unified app — no separate glance/grind sites */

import { LOCAL_TRACKER_URL, USER_SETUP_DOC_URL } from './config.js';

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

export function getUserSetupDocUrl() {
  return USER_SETUP_DOC_URL;
}

/** Banner copy when opened from GitHub Pages / non-localhost (manual log only). */
export function getWebOnlyHostBannerHtml(launcher) {
  const localUrl = getLocalTrackerUrl();
  const setupUrl = getUserSetupDocUrl();
  return `This web bookmark supports <strong>manual logging only</strong> — auto-log needs `
    + `<code>${launcher}</code> on your gaming PC at `
    + `<a href="${localUrl}" class="btn-link">${localUrl}</a>. `
    + `<a href="${setupUrl}" class="btn-link" target="_blank" rel="noopener">Player setup guide →</a>`;
}
