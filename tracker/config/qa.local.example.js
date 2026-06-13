/** Copy to qa.local.js (gitignored) — QA write allowlist for localhost testing */

/** Exact emails allowed to persist/clear QA data in Supabase */
export const QA_ALLOWED_EMAILS = [
  // 'test123@gmail.com',
  // 'you+qa@gmail.com',
];

/** Supabase user UUIDs allowed to persist QA data */
export const QA_ALLOWED_USER_IDS = [];

/**
 * RegExp sources (case-insensitive) matched against signed-in email.
 * Default (without this file): email must contain "+qa"
 */
export const QA_EMAIL_PATTERN_SOURCES = [
  '\\+qa',
];
