/** localStorage profile snapshot for instant signed-in shell paint */

const CACHE_KEY = 'twans-profile-cache';

export function loadProfileCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.profile) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveProfileCache(profile, extras = {}) {
  if (!profile) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      profile: {
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        primary_color: profile.primary_color,
        secondary_color: profile.secondary_color,
        accent_color: profile.accent_color,
      },
      activeGame: extras.activeGame ?? null,
      savedAt: Date.now(),
    }));
  } catch { /* quota / private mode */ }
}

export function clearProfileCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}
