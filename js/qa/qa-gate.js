/** QA tooling gates — localhost + opt-in + account allowlist */

import { QA_SESSION_KEY, QA_NOTE_PREFIX, QA_URL_PARAM, QA_URL_VALUE } from './qa-constants.js';

const DEFAULT_EMAIL_PATTERNS = [/\+qa/i];

let cachedAllowlist = null;

export function isQaHost() {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

export function maybeEnableQaFromUrl() {
  if (!isQaHost()) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get(QA_URL_PARAM) !== QA_URL_VALUE) return false;
  sessionStorage.setItem(QA_SESSION_KEY, '1');
  params.delete(QA_URL_PARAM);
  const qs = params.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', next);
  return true;
}

export function isQaToolsEnabled() {
  return isQaHost() && sessionStorage.getItem(QA_SESSION_KEY) === '1';
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
  if (!isQaToolsEnabled()) {
    throw new Error('QA tools are not enabled. Open http://localhost:8080/?qa=enable once.');
  }
  if (!isQaAllowedUser(user, allowlist)) {
    throw new Error(
      'QA writes blocked for this account. Sign in with a throwaway QA email (e.g. you+qa@gmail.com) '
      + 'or add your email to config/qa.local.js (gitignored).',
    );
  }
}
