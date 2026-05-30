/** Supabase persistence — auth-scoped user data */

import { SUPABASE_URL, SUPABASE_KEY, LEGACY_PLAYERS } from './config.js';
import {
  normalizePlayerGames, normalizeGame, parseDisplayDate, formatDisplayDate,
} from './utils.js';
import { setSyncStatus } from './state.js';
import { DEFAULT_GOALS } from './goals.js';
import { getAccessToken, getAuthUser } from './auth.js';

/** Set from loadProfile — avoids PATCHing columns that are not in Supabase yet */
let profileSchemaExtended = false;

export function setProfileSchemaExtended(value) {
  profileSchemaExtended = Boolean(value);
}

export function profileSupportsExtendedColumns() {
  return profileSchemaExtended;
}

function isMissingColumnError(e) {
  const msg = e?.message ?? String(e);
  return msg.includes('PGRST204') || msg.includes('schema cache');
}

export function formatApiError(e, fallback = 'Something went wrong') {
  const raw = e?.message ?? String(e);
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.message) return parsed.message;
  } catch {
    /* plain text */
  }
  return raw || fallback;
}

async function sbFetch(path, method = 'GET', body = null, extra = {}) {
  const token = getAccessToken() ?? SUPABASE_KEY;
  const opts = {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
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

function gameToMatchRow(userId, game) {
  const d = parseDisplayDate(game.date);
  const played_at = d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : new Date().toISOString().slice(0, 10);
  return {
    user_id: userId,
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

export async function loadProfile() {
  const user = getAuthUser();
  if (!user) return null;

  let rows = await sbFetch(`profiles?id=eq.${user.id}&select=*`);
  if (rows?.[0]) {
    setProfileSchemaExtended('primary_color' in rows[0] || 'secondary_color' in rows[0]);
    return rows[0];
  }

  const meta = user.user_metadata ?? {};
  const profile = {
    id: user.id,
    display_name: meta.full_name || meta.name || user.email?.split('@')[0],
    avatar_url: meta.avatar_url || meta.picture || null,
    accent_color: '#e65c00',
    legacy_claimed: null,
  };

  await sbFetch('profiles', 'POST', [profile], {
    Prefer: 'resolution=merge-duplicates,return=minimal',
  });

  rows = await sbFetch(`profiles?id=eq.${user.id}&select=*`);
  const saved = rows?.[0] ?? profile;
  setProfileSchemaExtended('primary_color' in saved || 'secondary_color' in saved);
  return saved;
}

export async function loadGames() {
  const user = getAuthUser();
  if (!user) return [];
  const rows = await sbFetch(`matches?user_id=eq.${user.id}&select=*&order=match_num.asc`);
  return normalizePlayerGames((rows ?? []).map(matchRowToGame));
}

export async function saveGames(games) {
  const user = getAuthUser();
  if (!user) throw new Error('Not signed in');
  setSyncStatus('saving');
  try {
    const normalized = normalizePlayerGames(games);
    await sbFetch(`matches?user_id=eq.${user.id}`, 'DELETE');
    if (normalized.length) {
      const rows = normalized.map(g => gameToMatchRow(user.id, g));
      await sbFetch('matches', 'POST', rows, { Prefer: 'return=minimal' });
    }
    setSyncStatus('live');
  } catch (e) {
    setSyncStatus('error');
    throw e;
  }
}

export async function loadSettings() {
  const user = getAuthUser();
  if (!user) return { goals: { ...DEFAULT_GOALS }, bio: '', rlDisplayName: '', primaryColor: '', secondaryColor: '' };
  try {
    const rows = await sbFetch(`user_settings?user_id=eq.${user.id}&select=data`);
    const data = rows?.[0]?.data ?? {};
    return {
      goals: { ...DEFAULT_GOALS, ...(data.goals ?? {}) },
      bio: data.bio ?? '',
      rlDisplayName: data.rlDisplayName ?? '',
      primaryColor: data.primaryColor ?? '',
      secondaryColor: data.secondaryColor ?? '',
    };
  } catch {
    /* table may not exist yet */
  }
  return { goals: { ...DEFAULT_GOALS }, bio: '', rlDisplayName: '', primaryColor: '', secondaryColor: '' };
}

export async function saveSettings(settings) {
  const user = getAuthUser();
  if (!user) return;
  try {
    const payload = { user_id: user.id, data: settings, updated_at: new Date().toISOString() };
    await sbFetch('user_settings', 'POST', [payload], {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    });
  } catch {
    /* fallback silently */
  }
}

function buildProfilePatch(updates, extended) {
  const payload = {};
  if (updates.display_name != null) payload.display_name = updates.display_name;
  if (updates.accent_color != null) payload.accent_color = updates.accent_color;
  if (extended) {
    if (updates.primary_color != null) payload.primary_color = updates.primary_color;
    if (updates.secondary_color != null) payload.secondary_color = updates.secondary_color;
    if (updates.profile_number != null) payload.profile_number = updates.profile_number;
  } else if (updates.primary_color != null && payload.accent_color == null) {
    payload.accent_color = updates.primary_color;
  }
  return payload;
}

export async function saveProfile(updates) {
  const user = getAuthUser();
  if (!user) throw new Error('Not signed in');

  const extended = profileSchemaExtended;
  const payload = buildProfilePatch(updates, extended);

  try {
    await sbFetch(`profiles?id=eq.${user.id}`, 'PATCH', payload);
    return { ok: true, extended };
  } catch (e) {
    if (!isMissingColumnError(e)) throw e;
    if (!extended) throw e;

    setProfileSchemaExtended(false);
    const legacy = buildProfilePatch(updates, false);
    await sbFetch(`profiles?id=eq.${user.id}`, 'PATCH', legacy);
    return { ok: true, extended: false };
  }
}

/** One-time import from legacy Tracker JSON blob */
export async function claimLegacyData(legacyId) {
  const user = getAuthUser();
  if (!user) throw new Error('Not signed in');
  const legacy = LEGACY_PLAYERS.find(p => p.id === legacyId);
  if (!legacy) throw new Error('Unknown legacy profile');

  const rows = await sbFetch(`Tracker?Player=eq.${legacyId}&select=games`);
  const games = normalizePlayerGames(rows?.[0]?.games ?? []);
  if (!games.length) throw new Error(`No legacy data found for ${legacy.name}`);

  await saveGames(games);
  await sbFetch(`profiles?id=eq.${user.id}`, 'PATCH', { legacy_claimed: legacyId });
  return games;
}

export async function loadUserGroups() {
  const user = getAuthUser();
  if (!user) return [];
  try {
    const members = await sbFetch(`group_members?user_id=eq.${user.id}&select=role,group_id,groups(id,name,invite_code,created_at)`);
    return (members ?? []).map(m => ({ ...m.groups, role: m.role, group_id: m.group_id }));
  } catch {
    return [];
  }
}

export async function createGroup(name) {
  const result = await sbFetch('rpc/create_grind_squad', 'POST', { squad_name: name });
  return result;
}

export async function joinGroup(inviteCode, role = 'member') {
  return sbFetch('rpc/join_grind_squad', 'POST', {
    p_invite_code: inviteCode,
    p_role: role,
  });
}

export async function leaveGroup(groupId) {
  await sbFetch('rpc/leave_grind_squad', 'POST', { p_group_id: groupId });
}

export async function loadGroupMembers(groupId) {
  const rows = await sbFetch(
    `group_members?group_id=eq.${groupId}&select=role,joined_at,user_id,profiles(id,display_name,avatar_url,accent_color)&order=joined_at.asc`,
  );
  return (rows ?? []).map(row => ({
    user_id: row.user_id,
    role: row.role,
    joined_at: row.joined_at,
    display_name: row.profiles?.display_name ?? 'Player',
    avatar_url: row.profiles?.avatar_url ?? null,
    accent_color: row.profiles?.accent_color ?? row.profiles?.primary_color ?? '#e65c00',
  }));
}

export async function loadMemberGames(userId) {
  const rows = await sbFetch(`matches?user_id=eq.${userId}&select=*&order=match_num.asc`);
  return normalizePlayerGames((rows ?? []).map(matchRowToGame));
}

export async function loadUserData() {
  setSyncStatus('connecting');
  try {
    const profile = await loadProfile();
    const games = await loadGames();
    const settings = await loadSettings();
    const groups = await loadUserGroups();
    setSyncStatus('live');
    return { profile, games, goals: settings.goals, groups, bio: settings.bio, rlDisplayName: settings.rlDisplayName, primaryColor: settings.primaryColor, secondaryColor: settings.secondaryColor };
  } catch (e) {
    setSyncStatus('error');
    throw e;
  }
}
