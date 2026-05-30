/** Grind Squads — create, join, coach + duo stat views */

import { calcStats } from './utils.js';
import { buildWeeklyReport } from './reports.js';
import { getPerformanceInsights } from './insights.js';
import { rankBadgeHTML } from './ranks.js';
import { loadGroupMembers, loadMemberGames } from './supabase.js';
import { showToast } from './ui.js';

const ui = {
  selectedGroupId: null,
  selectedMemberId: null,
  membersCache: {},
  gamesCache: {},
};

function roleLabel(role) {
  return { owner: 'Owner', member: 'Grinder', coach: 'Coach' }[role] ?? role;
}

function canViewMemberStats(myRole, theirRole) {
  if (theirRole === 'coach') return false;
  if (myRole === 'coach') return theirRole === 'owner' || theirRole === 'member';
  return theirRole === 'owner' || theirRole === 'member';
}

function parseRpcError(err) {
  const raw = err?.message ?? String(err);
  try {
    const parsed = JSON.parse(raw);
    return parsed.message ?? parsed.error ?? parsed.details ?? raw;
  } catch {
    return raw.replace(/^.*?"message"\s*:\s*"([^"]+)".*$/, '$1') || raw;
  }
}

function avatarHTML(member, size = 32) {
  if (member.avatar_url) {
    return `<img class="group-avatar" src="${member.avatar_url}" alt="" width="${size}" height="${size}">`;
  }
  const initial = (member.display_name || '?')[0].toUpperCase();
  return `<span class="group-avatar group-avatar-fallback" style="background:${member.accent_color}">${initial}</span>`;
}

function statMiniHTML(stats, games) {
  const last = games[games.length - 1];
  const mode = last?.mode ?? "2's";
  return `
    <div class="group-stat-grid">
      <div class="group-stat"><span class="group-stat-label">Games</span><span class="group-stat-val">${stats.totalGames}</span></div>
      <div class="group-stat"><span class="group-stat-label">Win Rate</span><span class="group-stat-val">${stats.winRate}%</span></div>
      <div class="group-stat"><span class="group-stat-label">MMR Gain</span><span class="group-stat-val ${stats.totalMMRGain >= 0 ? 'green' : 'red'}">${stats.totalMMRGain >= 0 ? '+' : ''}${stats.totalMMRGain}</span></div>
      <div class="group-stat"><span class="group-stat-label">Current</span><span class="group-stat-val">${stats.currentMMR || '—'}${stats.currentMMR ? rankBadgeHTML(stats.currentMMR, 16, mode) : ''}</span></div>
    </div>`;
}

function recentGamesHTML(games) {
  const recent = [...games].slice(-5).reverse();
  if (!recent.length) return '<div class="empty" style="padding:12px">No games logged yet</div>';
  return `<div class="group-recent">
    ${recent.map(g => `
      <div class="group-recent-row ${g.result === 'W' ? 'win' : 'loss'}">
        <span>#${g.match}</span>
        <span>${g.mode}</span>
        <span class="group-recent-result">${g.result}</span>
        <span>${g.mmrDiff >= 0 ? '+' : ''}${g.mmrDiff} MMR</span>
      </div>`).join('')}
  </div>`;
}

function insightsHTML(games) {
  const { actionItems } = getPerformanceInsights(games);
  const items = (actionItems ?? []).slice(0, 3);
  if (!items.length) return '';
  return `<div class="group-insights">
    <h4>Coach Notes</h4>
    ${items.map(i => `<div class="coach-action coach-action-${i.type}">${i.text}</div>`).join('')}
  </div>`;
}

async function renderWeeklySnapshot(members, userId) {
  const grinders = members.filter(m => m.role !== 'coach');
  if (!grinders.length) return '';

  const rows = await Promise.all(grinders.map(async m => {
    if (!ui.gamesCache[m.user_id]) {
      ui.gamesCache[m.user_id] = await loadMemberGames(m.user_id);
    }
    const week = buildWeeklyReport(ui.gamesCache[m.user_id], 0);
    return { member: m, week };
  }));

  const cards = rows.map(({ member, week }) => {
    if (week.empty) {
      return `<div class="group-week-card">
        ${avatarHTML(member, 24)}
        <span class="group-week-name">${member.display_name}</span>
        <span class="group-week-empty">No games this week</span>
      </div>`;
    }
    const wrClass = week.winRate >= 50 ? 'green' : 'red';
    return `<div class="group-week-card">
      ${avatarHTML(member, 24)}
      <span class="group-week-name">${member.display_name}</span>
      <span class="group-week-stat">${week.games}g · <span class="${wrClass}">${week.winRate}%</span></span>
      <span class="group-week-stat ${week.mmrGain >= 0 ? 'green' : 'red'}">${week.mmrGain >= 0 ? '+' : ''}${week.mmrGain} MMR</span>
    </div>`;
  }).join('');

  return `
    <div class="group-weekly-snapshot coach-player-card">
      <h4 class="group-section-label">This week · ${rows[0]?.week?.label ?? 'Squad snapshot'}</h4>
      <div class="group-week-grid">${cards}</div>
    </div>`;
}

async function loadMemberDetail(groupId, member, myRole) {
  const key = member.user_id;
  if (!ui.gamesCache[key]) {
    ui.gamesCache[key] = await loadMemberGames(key);
  }
  const games = ui.gamesCache[key];
  const stats = calcStats(games);
  return `
    <div class="group-member-detail">
      <div class="group-member-detail-head">
        ${avatarHTML(member, 40)}
        <div>
          <h3 style="color:${member.accent_color}">${member.display_name}</h3>
          <div class="coach-sub">${roleLabel(member.role)} · ${stats.totalGames} games logged</div>
        </div>
      </div>
      ${statMiniHTML(stats, games)}
      <h4 class="group-section-label">Recent Games</h4>
      ${recentGamesHTML(games)}
      ${myRole === 'coach' ? insightsHTML(games) : ''}
    </div>`;
}

function renderCreateJoinPanel() {
  return `
    <div class="group-actions-grid">
      <div class="group-panel group-panel-create">
        <div class="group-panel-icon create">+</div>
        <h3>Create Squad</h3>
        <p class="group-panel-desc">Start a duo or team grind and get an invite code to share.</p>
        <label class="group-field-label" for="group-create-name">Squad name</label>
        <input type="text" id="group-create-name" class="group-input" placeholder="e.g. Team H4unt" maxlength="40">
        <button class="btn btn-primary group-btn-full" type="button" id="group-create-btn">Create Squad</button>
      </div>
      <div class="group-panel group-panel-join">
        <div class="group-panel-icon join">→</div>
        <h3>Join Squad</h3>
        <p class="group-panel-desc">Paste an invite code from your duo partner or coach.</p>
        <label class="group-field-label" for="group-join-code">Invite code</label>
        <input type="text" id="group-join-code" class="group-input group-input-code" placeholder="AB12CD34" maxlength="12" autocapitalize="characters" spellcheck="false">
        <span class="group-field-label">Join as</span>
        <div class="group-role-toggle">
          <label class="group-role-option">
            <input type="radio" name="join-role" value="member" checked>
            <span class="group-role-option-inner">
              <strong>Grind partner</strong>
              <small>Share stats with your duo</small>
            </span>
          </label>
          <label class="group-role-option">
            <input type="radio" name="join-role" value="coach">
            <span class="group-role-option-inner">
              <strong>Coach</strong>
              <small>View grinder stats & notes</small>
            </span>
          </label>
        </div>
        <button class="btn btn-secondary group-btn-full" type="button" id="group-join-btn">Join Squad</button>
      </div>
    </div>`;
}

function renderEmptySquads() {
  return `
    <div class="group-empty">
      <div class="group-empty-icon">👥</div>
      <p>No squads yet</p>
      <span>Create one above or join with an invite code</span>
    </div>`;
}

function renderSquadList(groups, userId) {
  if (!groups?.length) return renderEmptySquads();
  return groups.map(g => {
    const id = g.id ?? g.group_id;
    const active = ui.selectedGroupId === id ? ' active' : '';
    const roleCls = g.role === 'coach' ? 'coach' : g.role === 'owner' ? 'owner' : 'member';
    return `
      <button class="group-squad-card${active}" type="button" data-group-id="${id}">
        <div class="group-squad-card-top">
          <span class="group-squad-name">${g.name}</span>
          <span class="group-role-badge ${roleCls}">${roleLabel(g.role)}</span>
        </div>
        <div class="group-squad-code-row">
          <span class="group-code">${g.invite_code}</span>
          <span class="group-squad-hint">${active ? 'Selected' : 'Tap to open'}</span>
        </div>
      </button>`;
  }).join('');
}

function renderSquadDetail(group, members, myRole, userId, memberDetailHTML, weeklyHTML = '') {
  const id = group.id ?? group.group_id;
  const rosterHTML = members.map(m => {
    const isSelf = m.user_id === userId;
    const viewable = isSelf || (canViewMemberStats(group.role, m.role) && !isSelf);
    const selected = ui.selectedMemberId === m.user_id ? ' selected' : '';
    return `
      <button class="group-roster-item${selected}" type="button"
        data-member-id="${m.user_id}"
        ${viewable ? '' : 'disabled'}
        title="${viewable ? 'View stats' : 'Coaches cannot view other coaches'}">
        ${avatarHTML(m, 28)}
        <span class="group-roster-name">${m.display_name}${isSelf ? ' (you)' : ''}</span>
        <span class="group-role-badge sm">${roleLabel(m.role)}</span>
        ${viewable ? '<span class="group-view-stat">View →</span>' : ''}
      </button>`;
  }).join('');

  return `
    <div class="group-detail">
      <div class="group-detail-head">
        <div class="group-detail-title">
          <h3>${group.name}</h3>
          <div class="group-invite-strip">
            <span class="group-invite-label">Invite code</span>
            <code class="group-code-lg">${group.invite_code}</code>
            <button class="btn-copy" type="button" data-copy-code="${group.invite_code}">Copy code</button>
            <button class="btn-copy btn-share" type="button" data-share-code="${group.invite_code}" data-share-name="${group.name}">Share invite</button>
          </div>
        </div>
        <button class="btn btn-cancel btn-sm group-leave-btn" type="button" id="group-leave-btn" data-group-id="${id}">Leave squad</button>
      </div>
      ${weeklyHTML}
      <div class="group-detail-grid">
        <div class="group-roster coach-player-card">
          <h4 class="group-section-label">Roster</h4>
          ${rosterHTML}
        </div>
        <div class="group-member-view coach-player-card" id="group-member-view">
          ${memberDetailHTML || `
            <div class="group-member-placeholder">
              <div class="group-member-placeholder-icon">📊</div>
              <p>Select a grinder from the roster</p>
              <span>View their stats, recent games, and coach notes</span>
            </div>`}
        </div>
      </div>
    </div>`;
}

export async function renderGroupsPage(ctx) {
  const el = document.getElementById('group-content');
  if (!el) return;

  const { groups, userId, onCreate, onJoin, onLeave, onRefresh } = ctx;
  const selectedGroup = groups.find(g => (g.id ?? g.group_id) === ui.selectedGroupId);

  el.innerHTML = `
    <div class="group-page">
      <div class="group-hero">
        <div>
          <span class="group-hero-kicker">Squad up</span>
          <h2>Squads</h2>
          <p class="group-hero-desc">Team up with a duo partner or invite a coach to track progress together.</p>
        </div>
        ${groups?.length ? `<div class="group-hero-badge">${groups.length} squad${groups.length === 1 ? '' : 's'}</div>` : ''}
      </div>

      <div class="group-layout">
        <div class="group-layout-main">
          ${renderCreateJoinPanel()}
          <div id="group-detail-wrap"></div>
        </div>
        <aside class="group-sidebar">
          <h3 class="group-section-label">Your Squads</h3>
          <div class="group-list" id="group-list">${renderSquadList(groups, userId)}</div>
        </aside>
      </div>
    </div>`;

  wireCreateJoin(el, { onCreate, onJoin, onRefresh });
  wireSquadList(el, groups, userId, { onLeave, onRefresh });
}

async function wireSquadList(el, groups, userId, { onLeave, onRefresh }) {
  const detailWrap = el.querySelector('#group-detail-wrap');

  el.querySelector('#group-list')?.addEventListener('click', async e => {
    const card = e.target.closest('[data-group-id]');
    if (!card || card.id === 'group-leave-btn') return;
    ui.selectedGroupId = card.dataset.groupId;
    ui.selectedMemberId = null;
    ui.gamesCache = {};
    await renderDetail(detailWrap, groups, userId, { onLeave, onRefresh });
    el.querySelectorAll('.group-squad-card').forEach(c => {
      c.classList.toggle('active', c.dataset.groupId === ui.selectedGroupId);
    });
  });

  if (ui.selectedGroupId && groups.some(g => (g.id ?? g.group_id) === ui.selectedGroupId)) {
    await renderDetail(detailWrap, groups, userId, { onLeave, onRefresh });
  }
}

async function renderDetail(detailWrap, groups, userId, { onLeave, onRefresh }) {
  const group = groups.find(g => (g.id ?? g.group_id) === ui.selectedGroupId);
  if (!group || !detailWrap) return;

  const groupId = group.id ?? group.group_id;
  if (!ui.membersCache[groupId]) {
    ui.membersCache[groupId] = await loadGroupMembers(groupId);
  }
  const members = ui.membersCache[groupId];

  let memberDetailHTML = '';
  if (ui.selectedMemberId) {
    const member = members.find(m => m.user_id === ui.selectedMemberId);
    if (member && (member.user_id === userId || canViewMemberStats(group.role, member.role))) {
      memberDetailHTML = await loadMemberDetail(groupId, member, group.role);
    }
  }

  const weeklyHTML = await renderWeeklySnapshot(members, userId);
  detailWrap.innerHTML = renderSquadDetail(group, members, group.role, userId, memberDetailHTML, weeklyHTML);
  wireDetail(detailWrap, group, members, groups, userId, { onLeave, onRefresh });
}

function wireDetail(detailWrap, group, members, groups, userId, { onLeave, onRefresh }) {
  detailWrap.querySelector('[data-copy-code]')?.addEventListener('click', async e => {
    const code = e.target.dataset.copyCode;
    try {
      await navigator.clipboard.writeText(code);
      showToast('Invite code copied!');
    } catch {
      showToast('Copy failed — code: ' + code, 'error');
    }
  });

  detailWrap.querySelector('[data-share-code]')?.addEventListener('click', async e => {
    const code = e.target.dataset.shareCode;
    const name = e.target.dataset.shareName;
    const text = `Join my squad "${name}" on Twans Ultimate Tracker — invite code: ${code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Twans Ultimate Tracker squad invite', text });
      } else {
        await navigator.clipboard.writeText(text);
        showToast('Invite message copied!');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(text);
          showToast('Invite message copied!');
        } catch {
          showToast(text, 'error');
        }
      }
    }
  });

  detailWrap.querySelector('#group-leave-btn')?.addEventListener('click', async () => {
    if (!confirm(`Leave "${group.name}"?`)) return;
    try {
      await onLeave(group.id ?? group.group_id);
      ui.selectedGroupId = null;
      ui.selectedMemberId = null;
      ui.membersCache = {};
      ui.gamesCache = {};
      showToast('Left squad');
      await onRefresh();
    } catch (err) {
      showToast(parseRpcError(err), 'error');
    }
  });

  detailWrap.querySelectorAll('[data-member-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      ui.selectedMemberId = btn.dataset.memberId;
      await renderDetail(detailWrap, groups, userId, { onLeave, onRefresh });
    });
  });
}

function wireCreateJoin(el, { onCreate, onJoin, onRefresh }) {
  el.querySelector('#group-create-btn')?.addEventListener('click', async () => {
    const name = el.querySelector('#group-create-name')?.value?.trim();
    if (!name || name.length < 2) {
      showToast('Enter a squad name (2+ characters)', 'error');
      return;
    }
    const btn = el.querySelector('#group-create-btn');
    btn.disabled = true;
    btn.textContent = 'Creating...';
    try {
      const created = await onCreate(name);
      ui.selectedGroupId = created.id;
      ui.membersCache = {};
      showToast(`Squad created! Code: ${created.invite_code}`);
      await onRefresh();
    } catch (err) {
      showToast(parseRpcError(err), 'error');
    }
    btn.disabled = false;
    btn.textContent = 'Create Squad';
  });

  el.querySelector('#group-join-btn')?.addEventListener('click', async () => {
    const code = el.querySelector('#group-join-code')?.value?.trim();
    const role = el.querySelector('input[name="join-role"]:checked')?.value ?? 'member';
    if (!code) {
      showToast('Enter an invite code', 'error');
      return;
    }
    const btn = el.querySelector('#group-join-btn');
    btn.disabled = true;
    btn.textContent = 'Joining...';
    try {
      const joined = await onJoin(code, role);
      ui.selectedGroupId = joined.id;
      ui.membersCache = {};
      showToast(`Joined ${joined.name}!`);
      await onRefresh();
    } catch (err) {
      showToast(parseRpcError(err), 'error');
    }
    btn.disabled = false;
    btn.textContent = 'Join Squad';
  });
}

export function resetGroupsUI() {
  ui.selectedGroupId = null;
  ui.selectedMemberId = null;
  ui.membersCache = {};
  ui.gamesCache = {};
}
