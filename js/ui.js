/** DOM rendering, toasts, modals, filters UI */

import { TAG_CATS, TAG_COLORS, TAG_GROUPS, PLAYERS, PLAYLISTS } from './config.js';
import { getRank, rankIconHTML, rankBadgeHTML } from './ranks.js';
import { calcStats, getPrimaryMode } from './utils.js';
import { getGoalProgress } from './goals.js';
import { getUniqueSessions } from './filters.js';

export function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => { t.className = 'toast'; }, 2800);
}

export function setSyncUI(status) {
  const map = {
    live: ['live', 'Live'],
    saving: ['saving', 'Saving...'],
    error: ['error', 'Error'],
    connecting: ['connecting', 'Connecting...'],
  };
  const [cls, txt] = map[status] ?? ['', 'Offline'];
  const dot = document.getElementById('sync-dot');
  const label = document.getElementById('sync-label');
  if (dot) dot.className = 'sync-dot ' + cls;
  if (label) label.textContent = txt;
}

export function renderInlineTags(tags) {
  if (!tags?.length) return '';
  return tags.map(t => `<span class="inline-tag ${TAG_CATS[t] || 'def'}">${t}</span>`).join('');
}

export function renderTagChips(containerId, selectedTags, onToggle) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = TAG_GROUPS.map(group => `
    <div class="tag-section">
      <div class="tag-section-label"><span class="dot ${group.cat}"></span>${group.label}</div>
      <div class="tags-row">
        ${group.tags.map(tag => `
          <span class="tag-chip ${group.cat}${selectedTags.includes(tag) ? ' selected' : ''}"
                data-tag="${tag}" role="button" tabindex="0">${tag}</span>`).join('')}
      </div>
    </div>`).join('');

  container.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const tag = chip.dataset.tag;
      chip.classList.toggle('selected');
      onToggle(tag, chip.classList.contains('selected'));
    });
  });
}

export function renderStats(containerId, stats, playlist = 'all') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const modeLabel = { '1s': "1's", '2s': "2's", '3s': "3's", all: "2's" };
  const rankMode = modeLabel[playlist] || "2's";
  const cards = [
    { label: 'Current MMR', val: stats.currentMMR, cls: 'gold', extra: stats.currentMMR ? rankBadgeHTML(stats.currentMMR, 18, rankMode) : '' },
    { label: 'Total Games', val: stats.totalGames, cls: 'teal' },
    { label: 'Wins', val: stats.wins, cls: 'green' },
    { label: 'Losses', val: stats.losses, cls: 'red' },
    { label: 'Win Rate', val: stats.winRate + '%', cls: 'orange' },
    { label: 'MMR Gain', val: (stats.totalMMRGain >= 0 ? '+' : '') + stats.totalMMRGain, cls: stats.totalMMRGain >= 0 ? 'green' : 'red' },
    { label: 'Avg/Session', val: (stats.avgMMRSession >= 0 ? '+' : '') + stats.avgMMRSession, cls: stats.avgMMRSession >= 0 ? 'green' : 'red' },
    { label: 'Best Game', val: (stats.bestGame !== '-' && stats.bestGame > 0 ? '+' : '') + stats.bestGame, cls: 'green' },
    { label: 'Worst Game', val: stats.worstGame, cls: 'red' },
    { label: 'Streak', val: stats.streak.count > 0 ? (stats.streak.type === 'W' ? '🔥' : '💀') + ' ' + stats.streak.count : '—', cls: stats.streak.type === 'W' ? 'green' : stats.streak.type === 'L' ? 'red' : 'teal' },
  ];
  el.innerHTML = cards.map(c => `
    <div class="stat-card ${c.cls}">
      <div class="stat-label">${c.label}</div>
      <div class="stat-val ${c.cls}">${c.val}</div>
      ${c.extra ? `<div style="margin-top:5px">${c.extra}</div>` : ''}
    </div>`).join('');
}

export function renderLog(tableId, games, limit, player) {
  const t = document.getElementById(tableId);
  if (!t) return;
  const rows = limit ? [...games].reverse().slice(0, limit) : [...games].reverse();
  if (!rows.length) {
    t.innerHTML = `<tr><td colspan="12" class="empty">No games logged yet. Start grinding!</td></tr>`;
    return;
  }
  t.innerHTML = `
    <thead><tr>
      <th>#</th><th>Date</th><th>Mode</th><th>Result</th>
      <th>G</th><th>S</th><th>Start</th><th>End</th><th>+/-</th>
      <th>Tags / Notes</th><th></th>
    </tr></thead>
    <tbody>${rows.map(g => `
      <tr>
        <td style="color:#555">${g.match}</td>
        <td style="color:#777;white-space:nowrap">${g.date}</td>
        <td style="color:#777">${g.mode}</td>
        <td><span class="badge ${g.result}">${g.result === 'W' ? 'WIN' : 'LOSS'}</span></td>
        <td>${g.goals}</td><td>${g.saves}</td>
        <td>${g.startMMR}</td>
        <td><span style="margin-right:4px">${g.endMMR}</span>${rankIconHTML(getRank(g.endMMR, g.mode), 22)}</td>
        <td class="${(g.mmrDiff || 0) >= 0 ? 'pos' : 'neg'}">${(g.mmrDiff || 0) >= 0 ? '+' : ''}${g.mmrDiff || 0}</td>
        <td style="max-width:190px">${renderInlineTags(g.tags)}${g.notes ? `<div class="note-cell">${g.notes}</div>` : ''}</td>
        <td style="white-space:nowrap">${player ? `
          <button class="action-btn edit" data-player="${player}" data-match="${g.match}" title="Edit">✏️</button>
          <button class="action-btn del" data-player="${player}" data-match="${g.match}" title="Delete">🗑️</button>` : ''}</td>
      </tr>`).join('')}</tbody>`;
}

export function renderTeamGrid(data, goals = {}) {
  const grid = document.getElementById('team-grid');
  if (!grid) return;
  grid.innerHTML = PLAYERS.map(p => {
    const s = calcStats(data[p.id] ?? []);
    const mode = getPrimaryMode(data[p.id] ?? []);
    const goalItems = goals[p.id] ? getGoalProgress(data[p.id] ?? [], goals[p.id]) : [];
    const goalsHTML = goalItems.length ? `
      <div class="dashboard-goals">
        ${goalItems.slice(0, 2).map(g => `
          <div class="goal-mini"><span>${g.label}: ${g.display}</span>
            <div class="goal-progress-track"><div class="goal-progress-fill${g.met ? ' met' : ''}" style="width:${g.pct}%"></div></div>
          </div>`).join('')}
      </div>` : '';
    return `
      <div class="player-card">
        <div class="player-name ${p.cls}">${p.name}${s.currentMMR ? '&nbsp;' + rankBadgeHTML(s.currentMMR, 15, mode) : ''}</div>
        <div class="mini-stat"><span class="mini-label">Current MMR</span><span class="mini-val" style="color:#ffd700">${s.currentMMR}</span></div>
        <div class="mini-stat"><span class="mini-label">Games</span><span class="mini-val">${s.totalGames}</span></div>
        <div class="mini-stat"><span class="mini-label">W / L</span><span class="mini-val"><span style="color:#00c851">${s.wins}W</span> / <span style="color:#ff4444">${s.losses}L</span></span></div>
        <div class="mini-stat"><span class="mini-label">Win Rate</span><span class="mini-val" style="color:#e65c00">${s.winRate}%</span></div>
        <div class="mini-stat"><span class="mini-label">MMR Gain</span><span class="mini-val ${s.totalMMRGain >= 0 ? 'pos' : 'neg'}">${s.totalMMRGain >= 0 ? '+' : ''}${s.totalMMRGain}</span></div>
        <div class="mini-stat"><span class="mini-label">Streak</span><span class="mini-val">${s.streak.count > 1 ? `<span class="streak-badge ${s.streak.type === 'W' ? 'win' : 'loss'}">${s.streak.type === 'W' ? '🔥' : '💀'} ${s.streak.count}</span>` : '—'}</span></div>
        ${goalsHTML}
      </div>`;
  }).join('');
}

export function renderPlaylistTabs(playerId, activePlaylist, onSelect) {
  const container = document.getElementById(`${playerId}-pl-tabs`);
  if (!container) return;
  container.innerHTML = PLAYLISTS.map(pl => `
    <button class="pl-tab${pl.id === activePlaylist ? ' active' : ''}" data-playlist="${pl.id}">${pl.label}</button>
  `).join('');
  container.querySelectorAll('.pl-tab').forEach(btn => {
    btn.addEventListener('click', () => onSelect(btn.dataset.playlist, btn));
  });
}

export function renderFilterBar(containerId, games, filters, onChange) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const sessions = getUniqueSessions(games);

  el.innerHTML = `
    <div class="filter-bar">
      <div class="filter-row">
        <div class="filter-group">
          <label>From</label>
          <input type="date" id="filter-date-from" value="${filters.dateFrom}">
        </div>
        <div class="filter-group">
          <label>To</label>
          <input type="date" id="filter-date-to" value="${filters.dateTo}">
        </div>
        <div class="filter-group">
          <label>Session</label>
          <select id="filter-session">
            <option value="">All</option>
            ${sessions.map(s => `<option value="${s.session}"${filters.session == s.session ? ' selected' : ''}>${s.label}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label>Result</label>
          <select id="filter-result">
            <option value="all"${filters.result === 'all' ? ' selected' : ''}>All</option>
            <option value="W"${filters.result === 'W' ? ' selected' : ''}>Wins</option>
            <option value="L"${filters.result === 'L' ? ' selected' : ''}>Losses</option>
          </select>
        </div>
        <button class="filter-clear" type="button" id="filter-clear">Clear</button>
      </div>
      <div class="filter-tags-row">
        <span class="filter-tags-label">Tags:</span>
        ${Object.keys(TAG_CATS).map(tag => `
          <button type="button" class="filter-tag-chip${filters.tags.includes(tag) ? ' active' : ''}" data-tag="${tag}">${tag}</button>
        `).join('')}
      </div>
    </div>`;

  const emit = () => {
    const next = {
      dateFrom: el.querySelector('#filter-date-from')?.value ?? '',
      dateTo: el.querySelector('#filter-date-to')?.value ?? '',
      session: el.querySelector('#filter-session')?.value ?? '',
      result: el.querySelector('#filter-result')?.value ?? 'all',
      tags: [...el.querySelectorAll('.filter-tag-chip.active')].map(c => c.dataset.tag),
      playlist: filters.playlist,
    };
    onChange(next);
  };

  el.querySelectorAll('input, select').forEach(inp => inp.addEventListener('change', emit));
  el.querySelectorAll('.filter-tag-chip').forEach(chip => {
    chip.addEventListener('click', () => { chip.classList.toggle('active'); emit(); });
  });
  el.querySelector('#filter-clear')?.addEventListener('click', () => onChange({ dateFrom: '', dateTo: '', session: '', result: 'all', tags: [], playlist: filters.playlist }));
}

export function renderInsightCards(cards) {
  const el = document.getElementById('insight-cards');
  if (!el) return;
  if (!cards?.length) {
    el.innerHTML = '<div class="empty">Log more games to see insights.</div>';
    return;
  }
  el.innerHTML = cards.map(c => `
    <div class="insight-card ${c.cls}">
      <div class="insight-icon">${c.icon}</div>
      <div class="insight-label">${c.label}</div>
      <div class="insight-val">${c.val}</div>
      <div class="insight-sub">${c.sub}</div>
    </div>`).join('');
}

export function renderCoachReport(lines) {
  const el = document.getElementById('coach-report');
  if (!el) return;
  if (!lines?.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="coach-report">
      <h3>Coach Notes</h3>
      ${lines.map(l => `<div class="coach-line coach-${l.type}">${l.text}</div>`).join('')}
    </div>`;
}

export function renderActionItems(items) {
  const el = document.getElementById('action-items');
  if (!el) return;
  if (!items?.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="coach-report action-items-block">
      <h3>Priority Actions</h3>
      ${items.slice(0, 5).map(item => `
        <div class="coach-action coach-action-${item.type}">
          <span class="coach-action-priority">${item.priority <= 2 ? '!' : '·'}</span>
          ${item.text}
        </div>`).join('')}
    </div>`;
}

export function barRows(entries, max, cmap) {
  if (!entries.length) return '<div class="empty" style="padding:12px">No tags logged yet</div>';
  return entries.slice(0, 8).map(([tag, count]) => `
    <div class="bar-row">
      <div class="bar-label">${tag}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(count / max * 100)}%;background:${cmap[TAG_CATS[tag] || 'def']}"></div></div>
      <div class="bar-count">${count}</div>
    </div>`).join('');
}

export function showLoading(show) {
  document.body.classList.toggle('is-loading', show);
}

export function showPage(pageId, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + pageId)?.classList.add('active');
  if (btn) btn.classList.add('active');
}

export function setPlayerSelector(prefix, activeId) {
  PLAYERS.forEach(p => {
    const el = document.getElementById(`${prefix}-${p.id}`);
    if (el) el.className = 'pselector' + (p.id === activeId ? ` active ${p.cls}` : '');
  });
}
