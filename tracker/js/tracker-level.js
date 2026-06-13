/** Persistent profile level — never decreases when matches are cleared */

import { GAME_IDS, filterGamesByTitle } from './games.js';
import { calcStats } from './utils.js';
import { state } from './state.js';
import { getAuthUser } from './auth.js';

const LS_KEY = 'twans-tracker-level';

let levels = {};
let settingsSaver = null;

export function computeTrackerLevel(totalGames) {
  return Math.max(1, Math.min(999, Math.floor(totalGames / 10) + 1));
}

function readLocalLevels(userId) {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const entry = parsed?.[userId];
    return entry && typeof entry === 'object' ? { ...entry } : {};
  } catch {
    return {};
  }
}

function writeLocalLevels(userId, next) {
  if (!userId) return;
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[userId] = { ...next };
    localStorage.setItem(LS_KEY, JSON.stringify(parsed));
  } catch { /* quota / private mode */ }
}

function normalizeStoredLevels(stored = {}) {
  const out = {};
  for (const [gameId, value] of Object.entries(stored)) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 1) out[gameId] = Math.min(999, Math.floor(n));
  }
  return out;
}

function syncState() {
  state.trackerLevels = { ...levels };
}

export function registerTrackerLevelSettingsSaver(fn) {
  settingsSaver = fn;
}

export function applyTrackerLevelsFromSettings(stored = {}) {
  const userId = getAuthUser()?.id;
  const merged = { ...readLocalLevels(userId), ...normalizeStoredLevels(stored) };
  levels = merged;
  syncState();
}

export function getTrackerLevelsForSettings() {
  return { trackerLevels: { ...levels } };
}

export function getDisplayTrackerLevel(gameId, games) {
  const gameGames = filterGamesByTitle(games, gameId);
  const stats = calcStats(gameGames, gameId);
  const computed = computeTrackerLevel(stats.totalGames);
  const stored = levels[gameId] ?? 0;
  return Math.max(computed, stored, 1);
}

function bumpTrackerLevelForGame(gameId, games) {
  const gameGames = filterGamesByTitle(games, gameId);
  const stats = calcStats(gameGames, gameId);
  const computed = computeTrackerLevel(stats.totalGames);
  const prev = levels[gameId] ?? 0;
  const next = Math.max(prev, computed);
  if (next === prev) return false;
  levels[gameId] = next;
  syncState();
  writeLocalLevels(getAuthUser()?.id, levels);
  return true;
}

/** On load — raise stored level to match existing match count (migration). */
export function syncTrackerLevelsFromGames(games) {
  let changed = false;
  for (const gameId of [GAME_IDS.ROCKET_LEAGUE, GAME_IDS.VALORANT]) {
    if (bumpTrackerLevelForGame(gameId, games)) changed = true;
  }
  return changed;
}

/** After a new match — bump stored level upward only. */
export async function maybeBumpTrackerLevel(gameId, games) {
  if (!bumpTrackerLevelForGame(gameId, games)) return;
  if (settingsSaver) await settingsSaver();
}

export function resetTrackerLevels() {
  levels = {};
  syncState();
}
