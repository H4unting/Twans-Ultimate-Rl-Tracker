/** QA tooling gates — localhost + dev mode + account allowlist */

import {
  QA_SESSION_KEY, QA_NOTE_PREFIX, QA_URL_PARAM, QA_URL_VALUE,
  DEV_MODE_KEY, QA_PANEL_VISIBLE_KEY,
} from './qa-constants.js';

const DEFAULT_EMAIL_PATTERNS = [/\+qa/i];

let cachedAllowlist = null;

export function isQaHost() {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

export function enableDevMode({ showPanel = false } = {}) {
  if (!isQaHost()) return false;
  sessionStorage.setItem(QA_SESSION_KEY, '1');
  localStorage.setItem(DEV_MODE_KEY, '1');
  if (showPanel) sessionStorage.setItem(QA_PANEL_VISIBLE_KEY, '1');
  return true;
}

export function maybeEnableQaFromUrl() {
  if (!isQaHost()) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get(QA_URL_PARAM) !== QA_URL_VALUE) return false;
  enableDevMode({ showPanel: true });
  params.delete(QA_URL_PARAM);
  const qs = params.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', next);
  return true;
}

/** @deprecated alias */
export function isQaToolsEnabled() {
  return isDevModeEnabled();
}

export function isDevModeEnabled() {
  if (!isQaHost()) return false;
  return sessionStorage.getItem(QA_SESSION_KEY) === '1'
    || localStorage.getItem(DEV_MODE_KEY) === '1';
}

export function shouldShowQaPanelInitially() {
  return sessionStorage.getItem(QA_PANEL_VISIBLE_KEY) === '1';
}

export function setQaPanelVisible(visible) {
  if (visible) sessionStorage.setItem(QA_PANEL_VISIBLE_KEY, '1');
  else sessionStorage.removeItem(QA_PANEL_VISIBLE_KEY);
}

export function isQaMatch(game) {
  return String(game?.notes ?? '').startsWith(QA_NOTE_PREFIX);
}

export async function loadQaAllowlist() {
  if (cachedAllowlist) return cachedAllowlist;
  const base = {
    emails: [],
    userIds: [],
    emailPatterns: [...DEFAULT_EMAIL_PATTERNS],
  };
  try {
    const mod = await import('/config/qa.local.js');
    if (Array.isArray(mod.QA_ALLOWED_EMAILS)) {
      base.emails = mod.QA_ALLOWED_EMAILS.map(e => String(e).toLowerCase().trim()).filter(Boolean);
    }
    if (Array.isArray(mod.QA_ALLOWED_USER_IDS)) {
      base.userIds = mod.QA_ALLOWED_USER_IDS.map(String).filter(Boolean);
    }
    if (Array.isArray(mod.QA_EMAIL_PATTERN_SOURCES)) {
      base.emailPatterns = mod.QA_EMAIL_PATTERN_SOURCES
        .map(src => {
          try { return new RegExp(src, 'i'); } catch { return null; }
        })
        .filter(Boolean);
    }
  } catch {
    /* config/qa.local.js missing — defaults only */
  }
  cachedAllowlist = base;
  return base;
}

export function isQaAllowedUser(user, allowlist) {
  if (!user) return false;
  const email = String(user.email ?? '').toLowerCase().trim();
  if (allowlist.userIds.includes(user.id)) return true;
  if (email && allowlist.emails.includes(email)) return true;
  if (email && allowlist.emailPatterns.some(re => re.test(email))) return true;
  return false;
}

export function assertQaWriteAllowed(user, allowlist) {
  if (!isDevModeEnabled()) {
    throw new Error('Dev mode off. Press Ctrl+Shift+D on localhost or open /?qa=enable');
  }
  if (!isQaAllowedUser(user, allowlist)) {
    throw new Error(
      'DB writes blocked — use a throwaway QA email (e.g. you+qa@gmail.com) or config/qa.local.js',
    );
  }
}

export function wireDevModeShortcut(onToggle) {
  if (!isQaHost()) return;
  document.addEventListener('keydown', (e) => {
    if (!e.ctrlKey || !e.shiftKey || e.key.toLowerCase() !== 'd') return;
    e.preventDefault();
    enableDevMode({ showPanel: true });
    onToggle?.();
  });
}
