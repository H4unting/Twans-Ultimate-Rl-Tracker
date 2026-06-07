/** Personal profile page — game-aware stats showcase */

import { calcStats, getPlaylistMMRRows, groupBySession } from './utils.js';
import { getRlDisplayName, saveRlDisplayName } from './rl-live.js';
import { savePrefs, loadPrefs } from './quicklog.js';
import { showToast } from './ui.js';
import { formatApiError } from './supabase.js';
import { GAME_IDS, getGameMeta, getGameModule, filterGamesByTitle } from './games.js';
import { state } from './state.js';
import { sanitizeImageUrl } from './core/dom-safe.js';

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function trackerLevel(totalGames) {
  return Math.max(1, Math.min(999, Math.floor(totalGames / 10) + 1));
}

function formatMemberSince(iso) {
  if (!iso) return 'New grinder';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Member';
  return `Member since ${d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
}

function bannerGradient(primary, secondary) {
  const p = primary || '#e65c00';
  const s = secondary || '#4a2060';
  return `linear-gradient(135deg, ${p}cc 0%, ${s} 48%, #1a1028 100%)`;
}

function profileUidLabel(profileNumber) {
  if (profileNumber == null || profileNumber === '') return '';
  return `UID ${profileNumber}`;
}

function resolveProfileColors(profile, display) {
  const primary = profile?.primary_color || profile?.accent_color || display.color || '#e65c00';
  const secondary = profile?.secondary_color || '#4a2060';
  return { primary, secondary };
}

function renderAvatarHtml(display, primary, avatarId = 'profile-avatar-img') {
  const safeUrl = sanitizeImageUrl(display.avatar);
  if (safeUrl) {
    return `<img class="profile-avatar" id="${avatarId}" src="${escapeAttr(safeUrl)}" alt="">`;
  }
  return `<span class="profile-avatar profile-avatar-fallback" id="${avatarId}" style="background:${escapeAttr(primary)}">${escapeHtml(display.name.charAt(0).toUpperCase())}</span>`;
}

export function renderProfilePage({
  games, profile, display, authUser, bio = '', onSave, onDeleteAccount, gameId = state.activeGame,
}) {
  const el = document.getElementById('profile-content');
  if (!el) return;

  const isVal = gameId === GAME_IDS.VALORANT;
  const meta = getGameMeta(gameId);
  const gameGames = filterGamesByTitle(games, gameId);
  const stats = calcStats(gameGames, gameId);
  const rows = getPlaylistMMRRows(gameGames, gameId);
  const sessions = groupBySession(gameGames, gameId).length;
  const level = trackerLevel(stats.totalGames);
  const rlName = getRlDisplayName() || '';
  const riotId = loadPrefs().riotId ?? '';
  const rankMod = getGameModule(gameId);
  const { primary, secondary } = resolveProfileColors(profile, display);
  const uidLabel = profileUidLabel(profile?.profile_number);

  const identityTag = isVal
    ? (riotId
      ? `<span class="profile-rl-tag">Val · ${escapeHtml(riotId)}</span>`
      : `<span class="profile-rl-tag profile-rl-missing">Riot ID not set</span>`)
    : (rlName
      ? `<span class="profile-rl-tag">RL · ${escapeHtml(rlName)}</span>`
      : `<span class="profile-rl-tag profile-rl-missing">RL name not set</span>`);

  const ranksHTML = rows.length
    ? rows.map(r => {
      const wkCls = r.weekGain >= 0 ? 'up' : 'down';
      if (isVal) {
        return `
        <div class="profile-rank-card profile-val-rank-card">
          <div class="profile-val-rr">${r.mmr}</div>
          <div class="profile-rank-meta">
            <span class="profile-rank-mode">${escapeHtml(r.mode)}</span>
            <span class="profile-rank-name">${meta.rankLabel}</span>
            <span class="profile-rank-mmr">${r.mmr} ${meta.rankLabel} <span class="profile-rank-week ${wkCls}">${r.weekGain >= 0 ? '+' : ''}${r.weekGain} wk</span></span>
          </div>
        </div>`;
      }
      const rank = rankMod.getRank(r.mmr, r.mode);
      return `
        <div class="profile-rank-card">
          ${rankMod.rankIconHTML(rank, 40)}
          <div class="profile-rank-meta">
            <span class="profile-rank-mode">${escapeHtml(r.mode)}</span>
            <span class="profile-rank-name">${rank.name}</span>
            <span class="profile-rank-mmr">${r.mmr} MMR <span class="profile-rank-week ${wkCls}">${r.weekGain >= 0 ? '+' : ''}${r.weekGain} wk</span></span>
          </div>
        </div>`;
    }).join('')
    : `<p class="profile-empty">Log ranked ${isVal ? 'matches' : 'games'} to show your ${isVal ? 'queue' : 'playlist'} ranks here.</p>`;

  el.innerHTML = `
    <div class="profile-page" data-profile-game="${escapeAttr(gameId)}" style="--profile-primary:${escapeAttr(primary)};--profile-secondary:${escapeAttr(secondary)}">
      <div class="profile-hero">
        <div class="profile-banner" id="profile-banner-preview" style="background:${bannerGradient(primary, secondary)}"></div>
        <div class="profile-hero-inner">
          <div class="profile-hero-head">
            <div class="profile-avatar-wrap">
              ${renderAvatarHtml(display, primary)}
              <label class="profile-avatar-change" for="profile-avatar-input">
                <input type="file" id="profile-avatar-input" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
                Change photo
              </label>
              <p class="profile-avatar-legal form-hint">Only upload images you have the right to use. Stored per our <a href="legal/privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>
            </div>
            <div class="profile-hero-title">
              <h1 class="profile-display-name" id="profile-display-heading">${escapeHtml(display.name)}</h1>
              <p class="profile-level-hint profile-level-hint-inline">${stats.totalGames} ${isVal ? 'matches' : 'games'} logged</p>
              <div class="profile-meta">
                <div class="profile-subline">
                  ${uidLabel ? `<span class="profile-uid-tag">${escapeHtml(uidLabel)}</span><span class="profile-dot">·</span>` : ''}
                  ${identityTag}
                  <span class="profile-dot">·</span>
                  <span>${formatMemberSince(profile?.created_at)}</span>
                </div>
                ${bio ? `<p class="profile-bio" id="profile-bio-display">${escapeHtml(bio)}</p>` : '<p class="profile-bio profile-bio-empty hidden" id="profile-bio-display"></p>'}
              </div>
            </div>
            <div class="profile-hero-right">
              <div class="profile-level-block">
                <span class="profile-level-label">Level</span>
                <span class="profile-level-badge" title="${stats.totalGames} ${isVal ? 'matches' : 'games'} logged">${level}</span>
              </div>
            </div>
          </div>

          <details class="profile-edit-dropdown" id="profile-edit-island">
            <summary class="profile-edit-trigger"><span>Edit profile</span></summary>
            <div class="profile-edit-form">
              <div class="profile-edit-grid">
                <div class="form-group">
                  <label for="profile-display-input">Display name</label>
                  <input type="text" id="profile-display-input" value="${escapeAttr(display.name)}" maxlength="32">
                </div>
                <div class="form-group">
                  <label for="profile-avatar-url-input">Photo URL <span class="form-optional">optional</span></label>
                  <input type="url" id="profile-avatar-url-input" value="${escapeAttr(display.avatar || '')}" placeholder="https://… or use Change photo">
                  <span class="form-hint">You must have rights to any image you link. See <a href="legal/privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</span>
                </div>
                <div class="form-group${isVal ? ' hidden' : ''}">
                  <label for="profile-rl-input">Rocket League name</label>
                  <input type="text" id="profile-rl-input" value="${escapeAttr(rlName)}" maxlength="32" spellcheck="false">
                </div>
                <div class="form-group${isVal ? '' : ' hidden'}">
                  <label for="profile-riot-input">Riot ID</label>
                  <input type="text" id="profile-riot-input" value="${escapeAttr(riotId)}" maxlength="48" spellcheck="false" placeholder="Name#TAG">
                </div>
                <div class="form-group form-span-2 profile-colors-group">
                  <label>Profile colors</label>
                  <div class="profile-colors-editor">
                    <div class="profile-color-field">
                      <span class="profile-color-label">Primary</span>
                      <input type="color" id="profile-primary-input" value="${escapeAttr(primary)}">
                    </div>
                    <div class="profile-color-field">
                      <span class="profile-color-label">Secondary</span>
                      <input type="color" id="profile-secondary-input" value="${escapeAttr(secondary)}">
                    </div>
                    <div class="profile-colors-preview" id="profile-colors-preview" style="background:${bannerGradient(primary, secondary)}"></div>
                  </div>
                </div>
                ${uidLabel ? `
                <div class="form-group">
                  <label>Your UID</label>
                  <div class="profile-uid-readonly">${escapeHtml(uidLabel)}</div>
                  <span class="form-hint">Assigned when you joined — cannot be changed.</span>
                </div>` : ''}
                <div class="form-group form-span-2">
                  <label for="profile-bio-input">Bio <span class="form-optional">optional</span></label>
                  <input type="text" id="profile-bio-input" value="${escapeAttr(bio)}" maxlength="120" placeholder="What you're grinding toward…">
                </div>
              </div>
              <div class="profile-edit-actions">
                <button type="button" class="btn btn-primary" id="profile-save-btn">Save profile</button>
              </div>
            </div>
          </details>
        </div>
      </div>

      <div class="profile-stats-bar">
        <div class="profile-stat">
          <strong>${stats.totalGames}</strong>
          <span>${isVal ? 'Matches' : 'Games'}</span>
        </div>
        <div class="profile-stat">
          <strong>${stats.winRate}%</strong>
          <span>Win rate</span>
        </div>
        <div class="profile-stat">
          <strong class="${stats.totalMMRGain >= 0 ? 'pos' : 'neg'}">${stats.totalMMRGain >= 0 ? '+' : ''}${stats.totalMMRGain}</strong>
          <span>Net ${meta.rankLabel}</span>
        </div>
        <div class="profile-stat">
          <strong>${sessions}</strong>
          <span>${isVal ? 'Grind blocks' : 'Sessions'}</span>
        </div>
        <div class="profile-stat">
          <strong>${stats.streak.count || 0}${stats.streak.type ? stats.streak.type : ''}</strong>
          <span>Streak</span>
        </div>
      </div>

      <p class="section-title">${isVal ? 'Queue ranks' : 'Playlist ranks'}</p>
      <div class="profile-ranks-grid">${ranksHTML}</div>

      <div class="profile-danger-zone setup-danger-zone">
        <p class="section-title">Delete account</p>
        <p class="form-hint setup-hint">
          Permanently deletes your cloud matches, settings, squad memberships, profile, and sign-in access.
          This cannot be undone. See our <a href="legal/privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
        </p>
        <div class="form-group">
          <label for="profile-delete-confirm">Type <strong>DELETE</strong> to confirm</label>
          <input type="text" id="profile-delete-confirm" autocomplete="off" spellcheck="false" placeholder="DELETE" maxlength="12">
        </div>
        <button type="button" class="btn profile-delete-btn" id="profile-delete-btn" disabled>Delete my account</button>
      </div>
    </div>`;

  wireProfilePage({ onSave, primary, secondary, isVal, display });
}

function wireProfilePage({ onSave, primary, secondary, isVal, display }) {
  const primaryInput = document.getElementById('profile-primary-input');
  const secondaryInput = document.getElementById('profile-secondary-input');
  const banner = document.getElementById('profile-banner-preview');
  const preview = document.getElementById('profile-colors-preview');
  const page = document.querySelector('.profile-page');
  const displayInput = document.getElementById('profile-display-input');
  const heading = document.getElementById('profile-display-heading');
  const avatarUrlInput = document.getElementById('profile-avatar-url-input');
  const avatarFileInput = document.getElementById('profile-avatar-input');
  let pendingAvatarFile = null;

  const applyColorPreview = () => {
    const p = primaryInput?.value || primary;
    const s = secondaryInput?.value || secondary;
    const grad = bannerGradient(p, s);
    if (banner) banner.style.background = grad;
    if (preview) preview.style.background = grad;
    if (page) {
      page.style.setProperty('--profile-primary', p);
      page.style.setProperty('--profile-secondary', s);
    }
  };

  primaryInput?.addEventListener('input', applyColorPreview);
  secondaryInput?.addEventListener('input', applyColorPreview);
  displayInput?.addEventListener('input', () => {
    if (heading) heading.textContent = displayInput.value.trim() || display.name;
  });

  avatarFileInput?.addEventListener('change', () => {
    const file = avatarFileInput.files?.[0];
    pendingAvatarFile = file || null;
    if (!file) return;
    document.getElementById('profile-edit-island')?.setAttribute('open', '');
    const reader = new FileReader();
    reader.onload = () => {
      const img = document.getElementById('profile-avatar-img');
      if (img?.tagName === 'IMG') {
        img.src = reader.result;
      } else if (img) {
        const newImg = document.createElement('img');
        newImg.className = 'profile-avatar';
        newImg.id = 'profile-avatar-img';
        newImg.alt = '';
        newImg.src = reader.result;
        img.replaceWith(newImg);
      }
      if (avatarUrlInput) avatarUrlInput.value = '';
    };
    reader.readAsDataURL(file);
  });

  avatarUrlInput?.addEventListener('input', () => {
    if (!avatarUrlInput.value.trim()) return;
    pendingAvatarFile = null;
    if (avatarFileInput) avatarFileInput.value = '';
    const url = avatarUrlInput.value.trim();
    const img = document.getElementById('profile-avatar-img');
    if (img?.tagName === 'IMG') {
      img.src = url;
    }
  });

  applyColorPreview();

  document.getElementById('profile-save-btn')?.addEventListener('click', async () => {
    const displayName = displayInput?.value.trim() ?? '';
    const rlName = document.getElementById('profile-rl-input')?.value.trim() ?? '';
    const riotId = document.getElementById('profile-riot-input')?.value.trim() ?? '';
    const primaryColor = primaryInput?.value ?? primary;
    const secondaryColor = secondaryInput?.value ?? secondary;
    const bio = document.getElementById('profile-bio-input')?.value.trim() ?? '';
    const avatarUrl = avatarUrlInput?.value.trim() ?? '';

    if (!displayName) {
      showToast('Display name is required', 'error');
      return;
    }

    saveRlDisplayName(rlName);
    savePrefs({ rlDisplayName: rlName, ...(riotId ? { riotId } : {}) });

    try {
      const result = await onSave({
        displayName,
        rlName,
        primaryColor,
        secondaryColor,
        bio,
        avatarFile: pendingAvatarFile,
        avatarUrl: pendingAvatarFile ? undefined : avatarUrl,
      });
      pendingAvatarFile = null;
      const msg = result?.avatarInline
        ? 'Profile saved — photo stored on your profile (optional: run avatar-storage.sql for cloud uploads)'
        : result?.extended === false
          ? 'Profile saved — run profile-customization.sql in Supabase for UIDs'
          : 'Profile saved';
      showToast(msg);
      document.getElementById('profile-edit-island')?.removeAttribute('open');
      const bioEl = document.getElementById('profile-bio-display');
      if (bioEl) {
        bioEl.textContent = bio;
        bioEl.classList.toggle('hidden', !bio);
        bioEl.classList.toggle('profile-bio-empty', !bio);
      }
    } catch (e) {
      showToast(formatApiError(e, 'Could not save profile'), 'error');
    }
  });

  const deleteConfirm = document.getElementById('profile-delete-confirm');
  const deleteBtn = document.getElementById('profile-delete-btn');

  deleteConfirm?.addEventListener('input', () => {
    if (deleteBtn) deleteBtn.disabled = deleteConfirm.value.trim() !== 'DELETE';
  });

  deleteBtn?.addEventListener('click', async () => {
    if (deleteConfirm?.value.trim() !== 'DELETE') {
      showToast('Type DELETE to confirm', 'error');
      return;
    }
    if (!onDeleteAccount) {
      showToast('Account deletion is unavailable', 'error');
      return;
    }
    const email = authUser?.email ?? 'your account';
    if (!window.confirm(`Delete ${email} and all cloud data permanently? This cannot be undone.`)) return;

    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting…';
    try {
      await onDeleteAccount();
    } catch (e) {
      showToast(formatApiError(e, 'Could not delete account'), 'error');
      deleteBtn.disabled = deleteConfirm?.value.trim() !== 'DELETE';
      deleteBtn.textContent = 'Delete my account';
    }
  });
}
