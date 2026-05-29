/** Supabase persistence — normalized matches table with Tracker JSON fallback */

import { SUPABASE_URL, SUPABASE_KEY, SEED_ANTHONY, SCHEMA_VERSION, PLAYERS } from './config.js';
import {
  normalizePlayerGames, normalizeGame, parseDisplayDate, formatDisplayDate,
} from './utils.js';
import { setSyncStatus } from './state.js';
import { loadGoalsLocal, saveGoalsLocal } from './goals.js';

const SETTINGS_KEY = 'app_settings';

/** @type {'matches' | 'tracker'} */
let storageBackend = 'tracker';

export function getStorageBackend() {
  return storageBackend;
}

async function sbFetch(path, method = 'GET', body = null, extra = {}) {
  const opts = {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...extra,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── Tracker JSON blob (legacy) ────────────────────────────────────────────────

function trackerRowsToData(rows) {
  const data = Object.fromEntries(PLAYERS.map(p => [p.id, []]));
  if (!rows?.length) return data;
  rows.forEach(row => {
    const key = row.Player?.toLowerCase();
    if (key && data[key] !== undefined) {
      data[key] = normalizePlayerGames(row.games);
    }
  });
  return data;
}

async function loadFromTracker() {
  const rows = await sbFetch('Tracker?select=id,Player,games');
  if (!rows?.length) return null;
  return trackerRowsToData(rows);
}

async function saveToTracker(data) {
  const rows = await sbFetch('Tracker?select=id,Player');
  for (const player of PLAYERS) {
    const games = data[player.id] ?? [];
    const existing = rows?.find(r => r.Player === player.id);
    const payload = { games };
    if (existing) {
      await sbFetch(`Tracker?id=eq.${existing.id}`, 'PATCH', payload);
    } else {
      await sbFetch('Tracker', 'POST', [{ Player: player.id, games }], { Prefer: 'return=minimal' });
    }
  }
}

// ── Normalized matches table ──────────────────────────────────────────────────

function matchRowToGame(row) {
  const raw = row.played_at ?? '';
  const iso = typeof raw === 'string' ? raw.slice(0, 10) : raw;
  const date = iso ? formatDisplayDate(new Date(`${iso}T12:00:00`)) : '';
  return normalizeGame({
    date,
    session: row.session,
    match: row.match_num,
    mode: row.mode,
    result: row.result,
    goals: row.goals,
    assists: row.assists,
    saves: row.saves,
    startMMR: row.start_mmr,
    endMMR: row.end_mmr,
    mmrDiff: row.mmr_diff ?? row.end_mmr - row.start_mmr,
    notes: row.notes,
    tags: row.tags,
  });
}

function matchesRowsToData(rows) {
  const data = Object.fromEntries(PLAYERS.map(p => [p.id, []]));
  (rows ?? []).forEach(row => {
    const key = row.player?.toLowerCase();
    if (key && data[key] !== undefined) data[key].push(matchRowToGame(row));
  });
  PLAYERS.forEach(p => { data[p.id] = normalizePlayerGames(data[p.id]); });
  return data;
}

function gameToMatchRow(playerId, game) {
  const d = parseDisplayDate(game.date);
  const played_at = d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : new Date().toISOString().slice(0, 10);
  return {
    player: playerId,
    match_num: game.match,
    session: game.session,
    played_at,
    mode: game.mode,
    result: game.result,
    goals: game.goals ?? 0,
    assists: game.assists ?? 0,
    saves: game.saves ?? 0,
    start_mmr: game.startMMR ?? 0,
    end_mmr: game.endMMR ?? 0,
    notes: game.notes ?? '',
    tags: game.tags ?? [],
  };
}

async function loadFromMatches() {
  const rows = await sbFetch('matches?select=*&order=player.asc,match_num.asc');
  return matchesRowsToData(rows);
}

async function saveToMatches(data) {
  for (const player of PLAYERS) {
    const games = normalizePlayerGames(data[player.id] ?? []);
    await sbFetch(`matches?player=eq.${player.id}`, 'DELETE');
    if (games.length) {
      const rows = games.map(g => gameToMatchRow(player.id, g));
      await sbFetch('matches', 'POST', rows, {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      });
    }
  }
}

async function matchesTableAvailable() {
  try {
    await sbFetch('matches?select=id&limit=0');
    return true;
  } catch {
    return false;
  }
}

function hasAnyGames(data) {
  return PLAYERS.some(p => (data[p.id] ?? []).length > 0);
}

const SEED = { anthony: SEED_ANTHONY, trystan: [] };

// ── Public API ────────────────────────────────────────────────────────────────

export async function loadData() {
  try {
    if (await matchesTableAvailable()) {
      storageBackend = 'matches';
      const existing = await sbFetch('matches?select=id&limit=1');

      if (existing?.length) {
        const data = await loadFromMatches();
        setSyncStatus('live');
        return data;
      }

      // Empty matches table — pull from Tracker if populated, then migrate
      const trackerData = await loadFromTracker();
      if (trackerData && hasAnyGames(trackerData)) {
        await saveToMatches(trackerData);
        setSyncStatus('live');
        return trackerData;
      }

      await saveToMatches(SEED);
      setSyncStatus('live');
      return SEED;
    }

    storageBackend = 'tracker';
    const trackerData = await loadFromTracker();
    if (!trackerData) {
      await saveToTracker(SEED);
      setSyncStatus('live');
      return SEED;
    }
    setSyncStatus('live');
    return trackerData;
  } catch (e) {
    setSyncStatus('error');
    throw e;
  }
}

export async function saveData(data) {
  setSyncStatus('saving');
  try {
    if (storageBackend === 'matches') {
      await saveToMatches(data);
    } else {
      await saveToTracker(data);
    }
    setSyncStatus('live');
  } catch (e) {
    setSyncStatus('error');
    throw e;
  }
}

/** Load goals from Supabase settings table, fallback to localStorage */
export async function loadSettings() {
  try {
    const rows = await sbFetch(`${SETTINGS_KEY}?select=data&limit=1`);
    if (rows?.[0]?.data?.goals) {
      saveGoalsLocal(rows[0].data.goals);
      return rows[0].data;
    }
  } catch {
    /* settings table may not exist yet */
  }
  return { goals: loadGoalsLocal() };
}

export async function saveSettings(settings) {
  if (settings.goals) saveGoalsLocal(settings.goals);
  try {
    const rows = await sbFetch(`${SETTINGS_KEY}?select=id&limit=1`);
    const payload = { data: settings, updated_at: new Date().toISOString() };
    if (rows?.[0]?.id) {
      await sbFetch(`${SETTINGS_KEY}?id=eq.${rows[0].id}`, 'PATCH', payload);
    } else {
      await sbFetch(SETTINGS_KEY, 'POST', [payload], { Prefer: 'return=minimal' });
    }
  } catch {
    /* localStorage fallback already saved */
  }
}

/** Wrap data for export/debug */
export function dataToPayload(data) {
  return {
    schemaVersion: SCHEMA_VERSION,
    storageBackend,
    players: Object.fromEntries(PLAYERS.map(p => [p.id, data[p.id] ?? []])),
  };
}
