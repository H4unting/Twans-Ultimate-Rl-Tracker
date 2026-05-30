/** Grind Squads — create, join, coach + duo stat views */

import { calcStats } from './utils.js';
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
      <h4>Recent Games</h4>
      ${recentGamesHTML(games)}
      ${myRole === 'coach' ? insightsHTML(games) : ''}
    </div>`;
}

function renderCreateJoinPanel() {
  return `
    <div class="group-actions-grid">
      <div class="group-panel">
        <h3>Create Squad</h3>
        <p class="coach-sub">Start a duo or team grind. You get an invite code to share.</p>
        <input type="text" id="group-create-name" class="group-input" placeholder="Squad name (e.g. Team H4unt)" maxlength="40">
        <button class="btn btn-primary" type="button" id="group-create-btn">Create Squad</button>
      </div>
      <div class="group-panel">
        <h3>Join Squad</h3>
        <p class="coach-sub">Enter an invite code from your duo or coach.</p>
        <input type="text" id="group-join-code" class="group-input" placeholder="Invite code" maxlength="12" autocapitalize="characters">
        <div class="group-join-role">
          <label><input type="radio" name="join-role" value="member" checked> Grind partner</label>
          <label><input type="radio" name="join-role" value="coach"> Coach</label>
        </div>
        <button class="btn btn-cancel" type="button" id="group-join-btn">Join Squad</button>
      </div>
    </div>`;
}

function renderSquadList(groups, userId) {
  if (!groups?.length) {
    return '<div class="empty">You are not in any squads yet. Create one or join with a code.</div>';
  }
  return groups.map(g => {
    const id = g.id ?? g.group_id;
    const active = ui.selectedGroupId === id ? ' active' : '';
    return `
      <button class="group-card group-card-btn${active}" type="button" data-group-id="${id}">
        <div class="group-card-top">
          <h3>${g.name}</h3>
          <span class="group-role-badge">${roleLabel(g.role)}</span>
        </div>
        <div class="coach-sub">Code: <strong class="group-code">${g.invite_code}</strong></div>
      </button>`;
  }).join('');
}

function renderSquadDetail(group, members, myRole, userId, memberDetailHTML) {
  const id = group.id ?? group.group_id;
  const isOwner = group.role === 'owner';
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
        <div>
          <h3>${group.name}</h3>
          <div class="coach-sub">
            Invite code:
            <strong class="group-code">${group.invite_code}</strong>
            <button class="btn-copy" type="button" data-copy-code="${group.invite_code}">Copy</button>
          </div>
        </div>
        <button class="btn btn-cancel btn-sm" type="button" id="group-leave-btn" data-group-id="${id}">Leave Squad</button>
      </div>
      <div class="group-detail-grid">
        <div class="group-roster">
          <h4>Roster</h4>
          ${rosterHTML}
        </div>
        <div class="group-member-view" id="group-member-view">
          ${memberDetailHTML || '<div class="empty" style="padding:24px">Select a grinder to view their stats</div>'}
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
    <div class="group-hero">
      <h2>Grind Squads</h2>
      <p class="page-desc">Team up with a duo partner or invite a coach to track progress together.</p>
    </div>
    ${renderCreateJoinPanel()}
    <div class="group-section">
      <h3>Your Squads</h3>
      <div class="group-list" id="group-list">${renderSquadList(groups, userId)}</div>
    </div>
    <div id="group-detail-wrap"></div>`;

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
    el.querySelectorAll('.group-card-btn').forEach(c => {
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

  detailWrap.innerHTML = renderSquadDetail(group, members, group.role, userId, memberDetailHTML);
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
