/** Auto-log preference read — avoids sessions ↔ quicklog import cycle */

const PREFS_KEY = 'rl-grind-prefs';

export function isAutoLogEnabled() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}').autoLog !== false;
  } catch {
    return true;
  }
}
