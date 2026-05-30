/** Personal profile page — Steam-style header + RL stats showcase */

import { calcStats, getPlaylistMMRRows, groupBySession } from './utils.js';
import { getRank, rankBadgeHTML } from './ranks.js';
import { getRlDisplayName, saveRlDisplayName } from './rl-live.js';
import { savePrefs } from './quicklog.js';
import { showToast } from './ui.js';

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

function bannerGradient(color) {
  const base = color || '#e65c00';
  return `linear-gradient(135deg, ${base}88 0%, #2a1848 45%, #4a2060 70%, #1a1028 100%)`;
}

export function renderProfilePage({ games, profile, display, authUser, bio = '', onSave }) {
  const el = document.getElementById('profile-content');
  if (!el) return;

  const stats = calcStats(games);
  const rows = getPlaylistMMRRows(games);
  const sessions = groupBySession(games).length;
  const level = trackerLevel(stats.totalGames);
  const rlName = getRlDisplayName() || '';
  const accent = profile?.accent_color || display.color || '#e65c00';
  const avatar = display.avatar
    ? `<img class="profile-avatar" src="${escapeAttr(display.avatar)}" alt="">`
    : `<span class="profile-avatar profile-avatar-fallback" style="background:${escapeAttr(accent)}">${escapeHtml(display.name.charAt(0).toUpperCase())}</span>`;

  const ranksHTML = rows.length
    ? rows.map(r => {
      const rank = getRank(r.mmr, r.mode);
      const wkCls = r.weekGain >= 0 ? 'up' : 'down';
      return `
        <div class="profile-rank-card">
          ${rankBadgeHTML(r.mmr, 36, r.mode)}
          <div class="profile-rank-meta">
            <span class="profile-rank-mode">${r.mode}</span>
            <span class="profile-rank-name">${rank.name}</span>
            <span class="profile-rank-mmr">${r.mmr} MMR <span class="profile-rank-week ${wkCls}">${r.weekGain >= 0 ? '+' : ''}${r.weekGain} wk</span></span>
          </div>
        </div>`;
    }).join('')
    : `<p class="profile-empty">Log ranked games to show your playlist ranks here.</p>`;

  el.innerHTML = `
    <div class="profile-page">
      <div class="profile-hero">
        <div class="profile-banner" style="background:${bannerGradient(accent)}"></div>
        <div class="profile-hero-inner">
          <div class="profile-hero-left">
            <div class="profile-avatar-wrap">${avatar}</div>
            <div class="profile-identity">
              <h1 class="profile-display-name">${escapeHtml(display.name)}</h1>
              <div class="profile-subline">
                ${rlName
    ? `<span class="profile-rl-tag">RL · ${escapeHtml(rlName)}</span>`
    : `<span class="profile-rl-tag profile-rl-missing">RL name not set</span>`}
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
            <p class="profile-level-hint">${stats.totalGames} games logged</p>
          </div>
        </div>
      </div>

      <div class="profile-stats-bar">
        <div class="profile-stat">
          <strong>${stats.totalGames}</strong>
          <span>Games</span>
        </div>
        <div class="profile-stat">
          <strong>${stats.winRate}%</strong>
          <span>Win rate</span>
        </div>
        <div class="profile-stat">
          <strong class="${stats.totalMMRGain >= 0 ? 'pos' : 'neg'}">${stats.totalMMRGain >= 0 ? '+' : ''}${stats.totalMMRGain}</strong>
          <span>Net MMR</span>
        </div>
        <div class="profile-stat">
          <strong>${sessions}</strong>
          <span>Sessions</span>
        </div>
        <div class="profile-stat">
          <strong>${stats.streak.count || 0}${stats.streak.type ? stats.streak.type : ''}</strong>
          <span>Streak</span>
        </div>
      </div>

      <p class="section-title">Playlist ranks</p>
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
            <div class="form-group">
              <label for="profile-rl-input">Rocket League display name</label>
              <input type="text" id="profile-rl-input" value="${escapeAttr(rlName)}" maxlength="32" spellcheck="false">
              <span class="form-hint">Must match in-game exactly — used for auto-stats.</span>
            </div>
            <div class="form-group">
              <label for="profile-accent-input">Accent color</label>
              <div class="profile-accent-row">
                <input type="color" id="profile-accent-input" value="${escapeAttr(accent)}">
                <span class="profile-accent-preview" style="background:${escapeAttr(accent)}"></span>
              </div>
            </div>
            <div class="form-group form-span-2">
              <label for="profile-bio-input">Bio <span class="form-optional">optional</span></label>
              <input type="text" id="profile-bio-input" value="${escapeAttr(bio)}" maxlength="120" placeholder="What you're grinding toward…">
            </div>
          </div>
          <div class="profile-edit-actions">
            <button type="button" class="btn btn-secondary btn-sm" id="profile-setup-link">Auto tracker setup →</button>
            <button type="button" class="btn btn-primary" id="profile-save-btn">Save profile</button>
          </div>
        </div>
      </details>
    </div>`;

  wireProfilePage({ onSave, accent });
}

function wireProfilePage({ onSave, accent }) {
  const colorInput = document.getElementById('profile-accent-input');
  const preview = document.querySelector('.profile-accent-preview');
  const banner = document.querySelector('.profile-banner');

  colorInput?.addEventListener('input', e => {
    const c = e.target.value;
    preview?.style.setProperty('background', c);
    if (banner) banner.style.background = bannerGradient(c);
  });

  document.getElementById('profile-setup-link')?.addEventListener('click', () => {
    window.__navigate?.('setup', 'home');
  });

  document.getElementById('profile-save-btn')?.addEventListener('click', async () => {
    const displayName = document.getElementById('profile-display-input')?.value.trim() ?? '';
    const rlName = document.getElementById('profile-rl-input')?.value.trim() ?? '';
    const accentColor = document.getElementById('profile-accent-input')?.value ?? accent;
    const bio = document.getElementById('profile-bio-input')?.value.trim() ?? '';

    if (!displayName) {
      showToast('Display name is required', 'error');
      return;
    }

    saveRlDisplayName(rlName);
    savePrefs({ rlDisplayName: rlName });

    try {
      await onSave({ displayName, rlName, accentColor, bio });
      showToast('Profile saved');
      document.getElementById('profile-edit-panel')?.removeAttribute('open');
    } catch (e) {
      showToast(e?.message || 'Could not save profile', 'error');
    }
  });
}
