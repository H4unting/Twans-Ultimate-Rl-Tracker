/** Shared app constants — no game-specific data */

export const APP_NAME = 'Twans Ultimate Tracker';

/** Public legal / support contact — update when you add a custom domain. */
export const LEGAL_CONTACT = {
  operator: 'Anthony, operator of Twans Ultimate Tracker',
  email: 'anthonyinf354332@gmail.com',
  privacyEmail: 'anthonyinf354332@gmail.com',
  supportEmail: 'anthonyinf354332@gmail.com',
  legalEmail: 'anthonyinf354332@gmail.com',
  siteUrl: 'https://h4unting.github.io/Twans-Ultimate-Rl-Tracker/',
  governingLaw: 'the laws of the United States',
};

export const DESKTOP_APP = {
  name: 'Twans Ultimate Tracker',
  launcher: 'Twans Ultimate Tracker.exe',
  launcherRl: 'Twans Ultimate Tracker.exe',
  launcherVal: 'Twans Ultimate Tracker.exe',
  launcherBatRl: 'Rocket League Tracker.bat',
  launcherBatVal: 'Valorant Tracker.bat',
  exe: 'Twans Ultimate Tracker.exe',
  legacyExe: 'Twans Auto-Log.exe',
  legacyExe2: 'Twans-Tracker-Bridge.exe',
  shortName: 'desktop app',
  whatItDoes: 'Runs on your PC while you play and sends match stats to the tracker',
};

/** Primary launcher for UI — exe when on localhost, .bat as dev fallback label */
export function getPrimaryLauncher() {
  return DESKTOP_APP.exe;
}

/** Game-specific launcher filename for UI copy */
export function getDesktopLauncher(gameId) {
  return getPrimaryLauncher();
}

/** Dev fallback .bat for the active game */
export function getDesktopLauncherBat(gameId) {
  return gameId === 'valorant' ? DESKTOP_APP.launcherBatVal : DESKTOP_APP.launcherBatRl;
}

export const LOCAL_TRACKER_URL = 'http://localhost:8080';

/** Player setup guide (GitHub — not served from Pages SPA) */
export const USER_SETUP_DOC_URL =
  'https://github.com/h4unting/Twans-Ultimate-Rl-Tracker/blob/main/docs/USER-SETUP.md';

export const SUPABASE_URL = 'https://pwuxocijdnuhhghufizn.supabase.co';
/** Supabase anon key — public by design; access controlled via Row Level Security policies. */
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3dXhvY2lqZG51aGhnaHVmaXpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjUyNzMsImV4cCI6MjA5NTQwMTI3M30.FZocCo3mNOVkXXqmfYL0XVrUY6czUYuTTAq8vgBE1EU';
