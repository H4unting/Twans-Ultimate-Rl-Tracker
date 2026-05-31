/** Personal profile page — game-aware stats showcase */

import { calcStats, getPlaylistMMRRows, groupBySession } from './utils.js';
import { getRank, rankBadgeHTML } from './ranks.js';
import { getRlDisplayName, saveRlDisplayName } from './rl-live.js';
import { savePrefs, loadPrefs } from './quicklog.js';
import { showToast } from './ui.js';
import { formatApiError } from './supabase.js';
import { GAME_IDS, getGameMeta } from './games.js';
import { state } from './state.js';
import { DESKTOP_APP } from './config.js';

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

function profileUrlTag(profileNumber) {
  if (profileNumber == null || profileNumber === '') return '';
  return `url#${profileNumber}`;
}

function resolveProfileColors(profile, display) {
  const primary = profile?.primary_color || profile?.accent_color || display.color || '#e65c00';
  const secondary = profile?.secondary_color || '#4a2060';
  return { primary, secondary };
}

export function renderProfilePage({
  games, profile, display, authUser, bio = '', onSave, gameId = state.activeGame,
}) {
  const el = document.getElementById('profile-content');
  if (!el) return;

  const isVal = gameId === GAME_IDS.VALORANT;
  const meta = getGameMeta(gameId);
  const stats = calcStats(games);
  const rows = getPlaylistMMRRows(games, gameId);
  const sessions = groupBySession(games).length;
  const level = trackerLevel(stats.totalGames);
  const rlName = getRlDisplayName() || '';
  const riotId = loadPrefs().riotId ?? '';
  const { primary, secondary } = resolveProfileColors(profile, display);
  const urlTag = profileUrlTag(profile?.profile_number);
  const avatar = display.avatar
    ? `<img class="profile-avatar" src="${escapeAttr(display.avatar)}" alt="">`
    : `<span class="profile-avatar profile-avatar-fallback" style="background:${escapeAttr(primary)}">${escapeHtml(display.name.charAt(0).toUpperCase())}</span>`;

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
      const rank = getRank(r.mmr, r.mode);
      return `
        <div class="profile-rank-card">
          ${rankBadgeHTML(r.mmr, 36, r.mode)}
          <div class="profile-rank-meta">
            <span class="profile-rank-mode">${escapeHtml(r.mode)}</span>
            <span class="profile-rank-name">${rank.name}</span>
            <span class="profile-rank-mmr">${r.mmr} MMR <span class="profile-rank-week ${wkCls}">${r.weekGain >= 0 ? '+' : ''}${r.weekGain} wk</span></span>
          </div>
        </div>`;
    }).join('')
    : `<p class="profile-empty">Log ranked ${isVal ? 'matches' : 'games'} to show your ${isVal ? 'queue' : 'playlist'} ranks here.</p>`;

  el.innerHTML = `
    <div class="profile-page" style="--profile-primary:${escapeAttr(primary)};--profile-secondary:${escapeAttr(secondary)}">
      <div class="profile-hero">
        <div class="profile-banner" id="profile-banner-preview" style="background:${bannerGradient(primary, secondary)}"></div>
        <div class="profile-hero-inner">
          <div class="profile-hero-left">
            <div class="profile-avatar-wrap">${avatar}</div>
            <div class="profile-identity">
              <h1 class="profile-display-name">${escapeHtml(display.name)}</h1>
              <div class="profile-subline">
                ${urlTag ? `<span class="profile-url-tag">${escapeHtml(urlTag)}</span><span class="profile-dot">·</span>` : ''}
                ${identityTag}
                <span class="profile-dot">·</span>
                <span>${formatMemberSince(profile?.created_at)}</span>
              </div>
              ${bio ? `<p class="profile-bio">${escapeHtml(bio)}</p>` : ''}
            </div>
          </div>
          <div class="profile-hero-right">
            <div class="profile-level-block">
              <span class="profile-level-label">Level</span>
              <span class="profile-level-badge">${level}</span>
            </div>
            <p class="profile-level-hint">${stats.totalGames} ${isVal ? 'matches' : 'games'} logged</p>
          </div>
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

      <details class="profile-edit-panel" id="profile-edit-panel">
        <summary>Edit profile</summary>
        <div class="profile-edit-form">
          <div class="profile-edit-grid">
            <div class="form-group">
              <label for="profile-display-input">Tracker display name</label>
              <input type="text" id="profile-display-input" value="${escapeAttr(display.name)}" maxlength="32">
              <span class="form-hint">Shown on your dashboard and in squads.</span>
            </div>
            <div class="form-group${isVal ? ' hidden' : ''}">
              <label for="profile-rl-input">Rocket League display name</label>
              <input type="text" id="profile-rl-input" value="${escapeAttr(rlName)}" maxlength="32" spellcheck="false">
              <span class="form-hint">Must match in-game exactly — used for auto-stats.</span>
            </div>
            <div class="form-group${isVal ? '' : ' hidden'}">
              <label for="profile-riot-input">Riot ID</label>
              <input type="text" id="profile-riot-input" value="${escapeAttr(riotId)}" maxlength="48" spellcheck="false" placeholder="Name#TAG">
              <span class="form-hint">Used for Valorant auto-log — also set in Auto-Log Setup.</span>
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
              <span class="form-hint">Primary tints your banner start; secondary fills the gradient.</span>
            </div>
            ${urlTag ? `
            <div class="form-group">
              <label>Profile URL ID</label>
              <div class="profile-url-readonly">${escapeHtml(urlTag)}</div>
              <span class="form-hint">Your signup number — assigned when you joined.</span>
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
    </div>`;

  wireProfilePage({ onSave, primary, secondary, isVal });
}

function wireProfilePage({ onSave, primary, secondary, isVal }) {
  const primaryInput = document.getElementById('profile-primary-input');
  const secondaryInput = document.getElementById('profile-secondary-input');
  const banner = document.getElementById('profile-banner-preview');
  const preview = document.getElementById('profile-colors-preview');
  const page = document.querySelector('.profile-page');

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
    document.querySelector('.profile-level-badge')?.style.setProperty('border-color', s);
    document.querySelector('.profile-level-badge')?.style.setProperty(
      'background',
      `radial-gradient(circle at 30% 30%, ${p}, ${s} 70%)`,
    );
  };

  primaryInput?.addEventListener('input', applyColorPreview);
  secondaryInput?.addEventListener('input', applyColorPreview);
  applyColorPreview();

  document.getElementById('profile-save-btn')?.addEventListener('click', async () => {
    const displayName = document.getElementById('profile-display-input')?.value.trim() ?? '';
    const rlName = document.getElementById('profile-rl-input')?.value.trim() ?? '';
    const riotId = document.getElementById('profile-riot-input')?.value.trim() ?? '';
    const primaryColor = primaryInput?.value ?? primary;
    const secondaryColor = secondaryInput?.value ?? secondary;
    const bio = document.getElementById('profile-bio-input')?.value.trim() ?? '';

    if (!displayName) {
      showToast('Display name is required', 'error');
      return;
    }

    saveRlDisplayName(rlName);
    savePrefs({ rlDisplayName: rlName, ...(riotId ? { riotId } : {}) });

    try {
      const result = await onSave({ displayName, rlName, primaryColor, secondaryColor, bio });
      showToast(
        result?.extended === false
          ? 'Profile saved — run profile-customization.sql in Supabase for url# IDs'
          : 'Profile saved',
      );
      document.getElementById('profile-edit-panel')?.removeAttribute('open');
    } catch (e) {
      showToast(formatApiError(e, 'Could not save profile'), 'error');
    }
  });
}
