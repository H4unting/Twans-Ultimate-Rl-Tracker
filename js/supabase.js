/** Supabase persistence — auth-scoped user data */

import { SUPABASE_URL, SUPABASE_KEY, LEGAL_CONTACT, DESKTOP_APP } from './config.js';
import {
  normalizePlayerGames, normalizeGame, parseDisplayDate, formatDisplayDate,
} from './utils.js';
import { setSyncStatus } from './state.js';
import { DEFAULT_GOALS } from './goals.js';
import { getAccessToken, getAuthUser } from './auth.js';
import { DEFAULT_GAME, GAME_IDS } from './games.js';
import { logError } from './core/error-log.js';
import {
  enqueueOfflineWrite,
  flushOfflineQueue,
  shouldQueueSyncError,
} from './offline-queue.js';

/** Set from loadProfile — avoids PATCHing columns that are not in Supabase yet */
let profileSchemaExtended = false;
let sbRequestCount = 0;

export function getSupabaseRequestCount() {
  return sbRequestCount;
}

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
    if (parsed?.message === 'invalid API key') {
      return `Database connection failed — app config may be outdated. Hard-refresh (Ctrl+F5) or reopen ${DESKTOP_APP.name}.`;
    }
    if (parsed?.message) return parsed.message;
    if (parsed?.hint) return `${parsed.message || 'Error'}: ${parsed.hint}`;
  } catch {
    /* plain text */
  }
  if (raw.includes('invalid API key')) {
    return `Database connection failed — hard-refresh (Ctrl+F5) or reopen ${DESKTOP_APP.name}.`;
  }
  return raw || fallback;
}

function fetchTimeout(ms) {
  if (typeof AbortSignal?.timeout === 'function') return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function sbFetch(path, method = 'GET', body = null, extra = {}) {
  sbRequestCount += 1;
  if (typeof window !== 'undefined') window.__SUPABASE_REQUEST_COUNT = sbRequestCount;
  const token = getAccessToken() ?? SUPABASE_KEY;
  const opts = {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...extra,
    },
    signal: fetchTimeout(25000),
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Valorant fields are stored in normalized columns + matches.stats JSONB:
 *  - K/D/A/ACS → goals/assists/saves columns (legacy RL shape) AND stats.kills/deaths/valAssists/acs
 *  - RR → start_mmr/end_mmr columns AND stats.startRR/endRR/rrDiff
 *  - agent, map → stats only
 *  See gameToMatchRow() for the write path. */
function matchRowToGame(row) {
  const raw = row.played_at ?? '';
  const iso = typeof raw === 'string' ? raw.slice(0, 10) : raw;
  const date = iso ? formatDisplayDate(new Date(`${iso}T12:00:00`)) : '';
  const gameId = row.game ?? DEFAULT_GAME;
  const stats = row.stats ?? {};
  return normalizeGame({
    game: gameId,
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
    mmrDiff: Number.isFinite(row.mmr_diff) ? row.mmr_diff
      : (Number.isFinite(row.end_mmr) && Number.isFinite(row.start_mmr) ? row.end_mmr - row.start_mmr : 0),
    notes: row.notes,
    tags: row.tags,
    kills: stats.kills ?? (gameId === GAME_IDS.VALORANT ? row.goals : undefined),
    deaths: stats.deaths ?? (gameId === GAME_IDS.VALORANT ? row.assists : undefined),
    valAssists: stats.valAssists ?? (gameId === GAME_IDS.VALORANT ? row.saves : undefined),
    acs: stats.acs,
    agent: stats.agent,
    map: stats.map,
    startRR: stats.startRR ?? row.start_mmr,
    endRR: stats.endRR ?? row.end_mmr,
    startRank: stats.startRank,
    endRank: stats.endRank,
    rrDiff: stats.rrDiff,
  });
}

function gameToMatchRow(userId, game) {
  const d = parseDisplayDate(game.date);
  const played_at = d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : new Date().toISOString().slice(0, 10);
  const gameId = game.game ?? DEFAULT_GAME;
  const row = {
    user_id: userId,
    game: gameId,
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
    stats: {},
  };

  if (gameId === GAME_IDS.VALORANT) {
    row.goals = game.kills ?? game.goals ?? 0;
    row.assists = game.deaths ?? game.assists ?? 0;
    row.saves = game.acs ?? game.saves ?? 0;
    row.start_mmr = game.startRR ?? game.startMMR ?? 0;
    row.end_mmr = game.endRR ?? game.endMMR ?? 0;
    row.stats = {
      kills: game.kills ?? game.goals ?? 0,
      deaths: game.deaths ?? game.assists ?? 0,
      valAssists: game.valAssists ?? 0,
      acs: game.acs ?? game.saves ?? 0,
      agent: game.agent ?? '',
      map: game.map ?? '',
      startRR: game.startRR ?? game.startMMR ?? 0,
      endRR: game.endRR ?? game.endMMR ?? 0,
      startRank: game.startRank ?? '',
      endRank: game.endRank ?? '',
      rrDiff: game.rrDiff ?? game.mmrDiff ?? 0,
    };
  }

  return row;
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
  try {
    const rows = await sbFetch(
      `matches?user_id=eq.${user.id}&select=*&order=game.asc,match_num.asc`,
    );
    return normalizePlayerGames((rows ?? []).map(matchRowToGame));
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (isMissingColumnError(e) || msg.includes('"game"') || msg.includes('game')) {
      const rows = await sbFetch(
        `matches?user_id=eq.${user.id}&select=*&order=match_num.asc`,
      );
      return normalizePlayerGames((rows ?? []).map(matchRowToGame));
    }
    throw e;
  }
}

async function syncGameSliceLegacy(userId, gameId, slice) {
  await sbFetch(`matches?user_id=eq.${userId}&game=eq.${gameId}`, 'DELETE');
  if (!slice.length) return;
  const rows = slice.map(g => gameToMatchRow(userId, g));
  await sbFetch('matches', 'POST', rows, { Prefer: 'return=minimal' });
}

function isUpsertUnavailable(e) {
  const msg = String(e?.message ?? e);
  return msg.includes('on_conflict')
    || msg.includes('42P10')
    || msg.includes('matches_user_game_match_num_key')
    || msg.includes('there is no unique')
    || msg.includes('duplicate key');
}

async function syncGameSlice(userId, gameId, slice) {
  if (!slice.length) {
    await sbFetch(`matches?user_id=eq.${userId}&game=eq.${gameId}`, 'DELETE');
    return;
  }

  const rows = slice.map(g => gameToMatchRow(userId, g));
  try {
    await sbFetch(
      'matches?on_conflict=user_id,game,match_num',
      'POST',
      rows,
      { Prefer: 'resolution=merge-duplicates,return=minimal' },
    );

    const matchNums = [...new Set(slice.map(g => g.match))].join(',');
    await sbFetch(
      `matches?user_id=eq.${userId}&game=eq.${gameId}&match_num=not.in.(${matchNums})`,
      'DELETE',
    );
  } catch (e) {
    if (isUpsertUnavailable(e)) {
      console.warn('[supabase] upsert unavailable — falling back to replace save');
      await syncGameSliceLegacy(userId, gameId, slice);
      return;
    }
    throw e;
  }
}

export async function saveGames(games, gameId = null, { fromQueue = false } = {}) {
  const user = getAuthUser();
  if (!user) throw new Error('Not signed in');
  const targetGame = gameId ?? null;
  setSyncStatus('saving');
  try {
    const normalized = normalizePlayerGames(games);

    const runSlice = async (gid, slice) => {
      try {
        await syncGameSlice(user.id, gid, slice);
      } catch (e) {
        const msg = String(e?.message ?? e);
        if (isMissingColumnError(e) || msg.includes('"game"') || msg.includes('game')) {
          throw new Error(
            'Multi-game database column missing — run docs/supabase/multi-game.sql in Supabase before clearing or saving per-game data.',
          );
        }
        throw e;
      }
    };

    if (targetGame) {
      const slice = normalized.filter(g => (g.game ?? DEFAULT_GAME) === targetGame);
      await runSlice(targetGame, slice);
    } else {
      for (const gid of [GAME_IDS.ROCKET_LEAGUE, GAME_IDS.VALORANT]) {
        const slice = normalized.filter(g => (g.game ?? DEFAULT_GAME) === gid);
        await runSlice(gid, slice);
      }
    }
    setSyncStatus('live');
    if (!fromQueue) void flushOfflineQueue({ saveGames, saveSettings });
  } catch (e) {
    if (!fromQueue && shouldQueueSyncError(e)) {
      enqueueOfflineWrite({ type: 'games', games, gameId: targetGame });
      setSyncStatus('error');
      import('./ui.js').then(({ showToast }) => {
        showToast('Saved offline — will sync when connection returns', 'error');
      }).catch(() => {});
      return;
    }
    setSyncStatus('error');
    throw e;
  }
}

export async function loadSettings() {
  const user = getAuthUser();
  if (!user) {
    return {
      goals: { ...DEFAULT_GOALS },
      bio: '',
      rlDisplayName: '',
      riotId: '',
      riotRegion: 'na',
      activeGame: DEFAULT_GAME,
      primaryColor: '',
      secondaryColor: '',
      rankBaselines: {},
      rankBaselinesComplete: false,
    };
  }
  try {
    const rows = await sbFetch(`user_settings?user_id=eq.${user.id}&select=data`);
    const data = rows?.[0]?.data ?? {};
    return {
      goals: { ...DEFAULT_GOALS, ...(data.goals ?? {}) },
      bio: data.bio ?? '',
      rlDisplayName: data.rlDisplayName ?? '',
      riotId: data.riotId ?? '',
      riotRegion: data.riotRegion ?? 'na',
      activeGame: data.activeGame ?? DEFAULT_GAME,
      primaryColor: data.primaryColor ?? '',
      secondaryColor: data.secondaryColor ?? '',
      rankBaselines: data.rankBaselines ?? {},
      rankBaselinesComplete: Boolean(data.rankBaselinesComplete),
    };
  } catch (e) {
    logError('loadSettings', e);
    import('./ui.js')
      .then(({ showToast }) => showToast(
        'Could not load your settings — showing defaults. Refresh before saving.',
        'error',
      ))
      .catch(() => {});
  }
  return {
    goals: { ...DEFAULT_GOALS },
    bio: '',
    rlDisplayName: '',
    riotId: '',
    riotRegion: 'na',
    activeGame: DEFAULT_GAME,
    primaryColor: '',
    secondaryColor: '',
    rankBaselines: {},
    rankBaselinesComplete: false,
  };
}

export async function saveSettings(settings, { fromQueue = false } = {}) {
  const user = getAuthUser();
  if (!user) return;
  setSyncStatus('saving');
  try {
    const payload = { user_id: user.id, data: settings, updated_at: new Date().toISOString() };
    await sbFetch('user_settings', 'POST', [payload], {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    });
    setSyncStatus('live');
    if (!fromQueue) void flushOfflineQueue({ saveGames, saveSettings });
  } catch (e) {
    if (!fromQueue && shouldQueueSyncError(e)) {
      enqueueOfflineWrite({ type: 'settings', settings });
      setSyncStatus('error');
      import('./ui.js').then(({ showToast }) => {
        showToast('Settings saved offline — will sync when connection returns', 'error');
      }).catch(() => {});
      return;
    }
    setSyncStatus('error');
    throw e;
  }
}

function buildProfilePatch(updates, extended) {
  const payload = {};
  if (updates.display_name != null) payload.display_name = updates.display_name;
  if (updates.avatar_url != null) payload.avatar_url = updates.avatar_url;
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

const AVATAR_INLINE_MAX_CHARS = 180000;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

async function compressImageForInlineAvatar(file) {
  if (typeof createImageBitmap !== 'function') {
    return readFileAsDataUrl(file);
  }

  const bitmap = await createImageBitmap(file);
  const maxDim = 256;
  let { width, height } = bitmap;
  const scale = Math.min(1, maxDim / Math.max(width, height, 1));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let quality = 0.88;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > AVATAR_INLINE_MAX_CHARS && quality > 0.45) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  if (dataUrl.length > AVATAR_INLINE_MAX_CHARS) {
    throw new Error('Image too large — use a smaller photo or run docs/supabase/avatar-storage.sql');
  }
  return dataUrl;
}

function isAvatarStorageMissingError(errText) {
  return /bucket|not found|404|does not exist|RLS|policy|Unauthorized|InvalidJWT/i.test(errText || '');
}

/** Upload to Supabase Storage, or embed a compressed data URL if the bucket is not set up. */
export async function uploadProfileAvatar(file) {
  const user = getAuthUser();
  if (!user) throw new Error('Not signed in');
  if (!file?.type?.startsWith('image/')) throw new Error('Choose a JPG, PNG, or WebP image');

  const ext = file.type === 'image/png' ? 'png'
    : file.type === 'image/webp' ? 'webp'
      : file.type === 'image/gif' ? 'gif'
        : 'jpg';
  const objectPath = `${user.id}/avatar.${ext}`;
  const token = getAccessToken() ?? SUPABASE_KEY;

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': file.type,
      'x-upsert': 'true',
    },
    body: file,
    signal: fetchTimeout(60000),
  });

  if (!res.ok) {
    const err = await res.text();
    if (isAvatarStorageMissingError(err)) {
      return { url: await compressImageForInlineAvatar(file), inline: true };
    }
    throw new Error(err || 'Upload failed');
  }

  return {
    url: `${SUPABASE_URL}/storage/v1/object/public/avatars/${objectPath}?t=${Date.now()}`,
    inline: false,
  };
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

export async function loadUserGroups() {
  const user = getAuthUser();
  if (!user) return [];
  try {
    const members = await sbFetch(`group_members?user_id=eq.${user.id}&select=role,group_id,groups(id,name,invite_code,created_at)`);
    return (members ?? []).map(m => ({ ...m.groups, role: m.role, group_id: m.group_id }));
  } catch (err) {
    logError('loadUserGroups', err);
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

const AVATAR_EXTENSIONS = ['jpg', 'png', 'webp', 'gif'];

/** Best-effort removal of uploaded avatar objects before account deletion. */
async function deleteProfileAvatars(userId) {
  const token = getAccessToken() ?? SUPABASE_KEY;
  await Promise.all(AVATAR_EXTENSIONS.map(async (ext) => {
    const objectPath = `${userId}/avatar.${ext}`;
    try {
      await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${objectPath}`, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
        },
        signal: fetchTimeout(15000),
      });
    } catch {
      /* optional cleanup */
    }
  }));
}

function isDeleteAccountUnavailableError(errText) {
  return /delete_own_account|PGRST202|42883|function.*does not exist|Could not find the function/i.test(errText || '');
}

/** Permanently delete the signed-in user's cloud data and auth account (requires delete-own-account.sql). */
export async function deleteOwnAccount() {
  const user = getAuthUser();
  if (!user) throw new Error('Not signed in');

  await deleteProfileAvatars(user.id);

  try {
    await sbFetch('rpc/delete_own_account', 'POST', {});
  } catch (e) {
    const msg = formatApiError(e, 'Account deletion failed');
    if (isDeleteAccountUnavailableError(msg)) {
      throw new Error(
        `Account deletion is not enabled on the server yet. Ask the operator to run docs/supabase/delete-own-account.sql, or email ${LEGAL_CONTACT.privacyEmail}.`,
      );
    }
    throw new Error(msg);
  }
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

const FOUNDER_EMAIL = 'anthonyinf354332@gmail.com';

/** Assign UID 1 to the app creator (requires claim-founder-uid.sql in Supabase). */
async function ensureFounderUid(profile) {
  const user = getAuthUser();
  if (!user?.email || user.email.toLowerCase() !== FOUNDER_EMAIL) return profile;
  if (Number(profile?.profile_number) === 1) return profile;
  try {
    await Promise.race([
      sbFetch('rpc/claim_founder_uid', 'POST', {}),
      new Promise((_, reject) => setTimeout(() => reject(new Error('founder uid timeout')), 4000)),
    ]);
    return await loadProfile();
  } catch {
    return profile;
  }
}

export async function loadUserData() {
  setSyncStatus('connecting');
  try {
    let profile = await loadProfile();
    profile = await ensureFounderUid(profile);
    const games = await loadGames();
    const settings = await loadSettings();
    const groups = await loadUserGroups();
    setSyncStatus('live');
    void flushOfflineQueue({ saveGames, saveSettings });
    return {
      profile, games, goals: settings.goals, groups, bio: settings.bio,
      rlDisplayName: settings.rlDisplayName, primaryColor: settings.primaryColor,
      secondaryColor: settings.secondaryColor, activeGame: settings.activeGame,
      riotId: settings.riotId, riotRegion: settings.riotRegion,
      rankBaselines: settings.rankBaselines, rankBaselinesComplete: settings.rankBaselinesComplete,
    };
  } catch (e) {
    setSyncStatus('error');
    throw e;
  }
}
