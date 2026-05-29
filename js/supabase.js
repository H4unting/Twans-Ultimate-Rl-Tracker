/** Supabase persistence layer — load/save with normalization */

import { SUPABASE_URL, SUPABASE_KEY, SEED_ANTHONY, SCHEMA_VERSION, PLAYERS } from './config.js';
import { normalizePlayerGames } from './utils.js';
import { setSyncStatus } from './state.js';

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

/** Normalize raw Supabase row into app data shape */
function rowToData(rows) {
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

/** Wrap data for Supabase storage with schema metadata */
function dataToPayload(data) {
  return {
    schemaVersion: SCHEMA_VERSION,
    players: Object.fromEntries(
      PLAYERS.map(p => [p.id, data[p.id] ?? []])
    ),
  };
}

export async function loadData() {
  try {
    const rows = await sbFetch('Tracker?select=id,Player,games');
    if (!rows?.length) {
      const seed = { anthony: SEED_ANTHONY, trystan: [] };
      await saveData(seed);
      return seed;
    }
    setSyncStatus('live');
    return rowToData(rows);
  } catch (e) {
    setSyncStatus('error');
    throw e;
  }
}

export async function saveData(data) {
  setSyncStatus('saving');
  try {
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
    setSyncStatus('live');
  } catch (e) {
    setSyncStatus('error');
    throw e;
  }
}

/**
 * Future schema migration path (documented, not yet required):
 *
 * CREATE TABLE matches (
 *   id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
 *   player text NOT NULL,
 *   match_num int NOT NULL,
 *   session int NOT NULL,
 *   played_at date NOT NULL,
 *   mode text NOT NULL,
 *   result text NOT NULL,
 *   goals int, assists int, saves int,
 *   start_mmr int, end_mmr int,
 *   notes text,
 *   tags text[] DEFAULT '{}'
 * );
 *
 * For now, JSON blob per player keeps GitHub Pages + Supabase simple.
 * Tags stored as string labels (validated against TAG_DEFINITIONS on load).
 */

export { dataToPayload };
