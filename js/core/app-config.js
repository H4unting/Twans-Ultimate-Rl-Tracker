/** Shared app constants — no game-specific data */

export const APP_NAME = 'Twans Ultimate Tracker';

export const DESKTOP_APP = {
  name: 'Twans Auto-Log',
  launcher: 'Rocket League Tracker.bat',
  launcherRl: 'Rocket League Tracker.bat',
  launcherVal: 'Valorant Tracker.bat',
  exe: 'Twans Auto-Log.exe',
  legacyExe: 'Twans-Tracker-Bridge.exe',
  shortName: 'auto-log app',
  whatItDoes: 'Runs on your PC while you play and sends match stats to the tracker',
};

/** Game-specific launcher filename for UI copy */
export function getDesktopLauncher(gameId) {
  return gameId === 'valorant' ? DESKTOP_APP.launcherVal : DESKTOP_APP.launcherRl;
}

export const LOCAL_TRACKER_URL = 'http://localhost:8080';

export const SUPABASE_URL = 'https://pwuxocijdnuhhghufizn.supabase.co';
/** Supabase anon key — public by design; access controlled via Row Level Security policies. */
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3dXhvY2lqZG51aGhnaHVmaXpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjUyNzMsImV4cCI6MjA5NTQwMTI3M30.FZocCo3mNOVkXXqmfYL0XVrUY6czUYuTTAq8vgBE1EU';
