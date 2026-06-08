/** DOM rendering, toasts, modals, filters UI */

import { TAG_COLORS, PLAYLISTS } from './config.js';
import { getRank, rankIconHTML, rankBadgeHTML } from './ranks.js';
import {
  valRankStartCellHTML, valRankEndCellHTML, resolveValorantMatchDisplayRanks,
} from './games/valorant/ranks.js';
import { calcStats } from './utils.js';
import { escapeHtml, escapeAttr, sanitizeImageUrl, escapeCssColor } from './core/dom-safe.js';
import { getGoalProgress } from './goals.js';
import { getUniqueSessions } from './filters.js';
import { state, getActiveGames } from './state.js';
import {
  GAME_IDS, getPlaylists, getTagGroups, getTagColors, getTagCat, getGameMeta, getDefaultMode,
  getTagDefinitions, getRankDiff, getRankValue, getGameRankStart, getQueueLabel,
} from './games.js';
import { formatRRDelta } from './games/valorant/ranks.js';

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

export function renderInlineTags(tags, gameId = state.activeGame) {
  if (!tags?.length) return '';
  return tags.map(t => `<span class="inline-tag ${getTagCat(t, gameId)}">${escapeHtml(t)}</span>`).join('');
}

export function renderTagChips(containerId, selectedTags, onToggle, gameId = state.activeGame) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = getTagGroups(gameId).map(group => `
    <div class="tag-section">
      <div class="tag-section-label"><span class="dot ${group.cat}"></span>${group.label}</div>
      <div class="tags-row">
        ${group.tags.map(tag => `
          <span class="tag-chip ${group.cat}${selectedTags.includes(tag) ? ' selected' : ''}"
                data-tag="${tag}" role="button" tabindex="0">${tag}</span>`).join('')}
      </div>
    </div>`).join('');

  container.querySelectorAll('.tag-chip').forEach(chip => {
    const toggle = () => {
      const tag = chip.dataset.tag;
      chip.classList.toggle('selected');
      onToggle(tag, chip.classList.contains('selected'));
    };
    chip.addEventListener('click', toggle);
    chip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  });
}

export function renderStats(containerId, stats, playlist = 'all', gameId = state.activeGame) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const meta = getGameMeta(gameId);
  const diffLabel = meta.diffLabel;
  const isVal = gameId === GAME_IDS.VALORANT;
  const playlists = getPlaylists(gameId);
  const pl = playlists.find(p => p.id === playlist) ?? playlists[0];
  const rankMode = pl?.mode ?? getDefaultMode(gameId);

  const cards = [
    {
      label: `Current ${diffLabel}`,
      val: stats.currentMMR,
      cls: 'gold',
      extra: !isVal && stats.currentMMR
        ? rankBadgeHTML(stats.currentMMR, 18, rankMode)
        : (isVal && stats.currentRankDisplay ? rankBadgeHTML(stats.currentRankDisplay, 18, rankMode) : ''),
    },
    { label: isVal ? 'Matches' : 'Total Games', val: stats.totalGames, cls: 'teal' },
    { label: 'Wins', val: stats.wins, cls: 'green' },
    { label: 'Losses', val: stats.losses, cls: 'red' },
    { label: 'Win Rate', val: stats.winRate + '%', cls: 'orange' },
    { label: `${diffLabel} Gain`, val: (stats.totalMMRGain >= 0 ? '+' : '') + stats.totalMMRGain, cls: stats.totalMMRGain >= 0 ? 'green' : 'red' },
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

export function renderLog(tableId, games, limit, editable = false, gameId = state.activeGame) {
  const t = document.getElementById(tableId);
  if (!t) return;
  const meta = getGameMeta(gameId);
  const isVal = gameId === GAME_IDS.VALORANT;
  const rows = limit ? [...games].reverse().slice(0, limit) : [...games].reverse();
  if (!rows.length) {
    t.innerHTML = `<tr><td colspan="12" class="empty">No ${isVal ? 'matches' : 'games'} logged yet. Start grinding!</td></tr>`;
    return;
  }
  if (isVal) {
    t.innerHTML = `
    <thead><tr>
      <th>#</th><th>Date</th><th>Mode</th><th>Result</th>
      <th>K</th><th>D</th><th>A</th><th class="val-rank-col val-rank-col--start">Start</th><th class="val-rank-col val-rank-col--end">End</th><th>+/-</th>
      <th class="log-table-col-notes">Tags / Notes</th><th></th>
    </tr></thead>
    <tbody>${rows.map(g => {
      const diff = getRankDiff(g, gameId);
      const chainGames = getActiveGames();
      const d = resolveValorantMatchDisplayRanks(chainGames, g);
      const startCell = valRankStartCellHTML(d.startRank, d.startRR);
      const endCell = valRankEndCellHTML(d.endRank, d.endRR, d.startRank);
      const noteHtml = g.notes
        ? `<div class="note-cell" title="${escapeAttr(g.notes)}">${escapeHtml(g.notes)}</div>`
        : '';
      return `
      <tr>
        <td style="color:#555">${g.match}</td>
        <td style="color:#777;white-space:nowrap">${g.date}</td>
        <td style="color:#777">${getQueueLabel(g.mode, gameId)}${g.agent ? `<br><span style="font-size:11px;color:#888">${g.agent}</span>` : ''}</td>
        <td><span class="badge ${g.result}">${g.result === 'W' ? 'WIN' : 'LOSS'}</span></td>
        <td>${g.kills ?? g.goals ?? 0}</td><td>${g.deaths ?? 0}</td><td>${g.valAssists ?? g.assists ?? 0}</td>
        <td class="val-rank-col val-rank-col--start">${startCell}</td>
        <td class="val-rank-col val-rank-col--end">${endCell}</td>
        <td class="${diff >= 0 ? 'pos' : 'neg'}">${formatRRDelta(diff)}</td>
        <td class="log-table-cell-notes">${renderInlineTags(g.tags, gameId)}${noteHtml}</td>
        <td style="white-space:nowrap">${editable ? `
          <button class="action-btn edit" data-match="${g.match}" title="Edit" aria-label="Edit match ${g.match}">✏️</button>
          <button class="action-btn del" data-match="${g.match}" title="Delete" aria-label="Delete match ${g.match}">🗑️</button>` : ''}</td>
      </tr>`;
    }).join('')}</tbody>`;
    return;
  }
  t.innerHTML = `
    <thead><tr>
      <th>#</th><th>Date</th><th>Mode</th><th>Result</th>
      <th>G</th><th>S</th><th>Start</th><th>End</th><th>+/-</th>
      <th class="log-table-col-notes">Tags / Notes</th><th></th>
    </tr></thead>
    <tbody>${rows.map(g => {
      const diff = getRankDiff(g, gameId);
      const startRank = getGameRankStart(g, gameId);
      const endRank = getRankValue(g, gameId);
      const noteHtml = g.notes
        ? `<div class="note-cell" title="${escapeAttr(g.notes)}">${escapeHtml(g.notes)}</div>`
        : '';
      return `
      <tr>
        <td style="color:#555">${g.match}</td>
        <td style="color:#777;white-space:nowrap">${g.date}</td>
        <td style="color:#777">${g.mode}</td>
        <td><span class="badge ${g.result}">${g.result === 'W' ? 'WIN' : 'LOSS'}</span></td>
        <td>${g.goals}</td><td>${g.saves}</td>
        <td>${startRank}</td>
        <td><span style="margin-right:4px">${endRank}</span>${rankIconHTML(getRank(endRank, g.mode), 22)}</td>
        <td class="${diff >= 0 ? 'pos' : 'neg'}">${diff >= 0 ? '+' : ''}${diff}</td>
        <td class="log-table-cell-notes">${renderInlineTags(g.tags, gameId)}${noteHtml}</td>
        <td style="white-space:nowrap">${editable ? `
          <button class="action-btn edit" data-match="${g.match}" title="Edit" aria-label="Edit game ${g.match}">✏️</button>
          <button class="action-btn del" data-match="${g.match}" title="Delete" aria-label="Delete game ${g.match}">🗑️</button>` : ''}</td>
      </tr>`;
    }).join('')}</tbody>`;
}

export function renderAuthBar(display, onSignOut, onProfileClick) {
  const el = document.getElementById('user-bar');
  if (!el) return;
  const safeAvatar = sanitizeImageUrl(display.avatar);
  const avatar = safeAvatar
    ? `<img class="user-avatar" src="${escapeAttr(safeAvatar)}" alt="">`
    : `<span class="user-avatar user-avatar-fallback">${escapeHtml(display.name.charAt(0))}</span>`;
  el.innerHTML = `
    <button type="button" class="user-bar-profile" id="user-bar-profile" aria-label="Open profile">
      ${avatar}
      <span class="user-name">${escapeHtml(display.name)}</span>
      <span class="user-bar-caret" aria-hidden="true">▼</span>
    </button>
    <button class="btn-signout" type="button" id="sign-out-btn">Sign out</button>`;
  el.querySelector('#sign-out-btn')?.addEventListener('click', onSignOut);
  el.querySelector('#user-bar-profile')?.addEventListener('click', () => onProfileClick?.());
}

export function renderGoalProgress(containerId, games, goals) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const items = getGoalProgress(games, goals);
  if (!items.length) {
    el.innerHTML = '<div class="empty" style="padding:12px">Set goals on the Reports page</div>';
    return;
  }
  el.innerHTML = items.map(g => `
    <div class="goal-progress-row">
      <div class="goal-progress-head"><span>${g.label}</span><span class="goal-progress-val">${g.display}</span></div>
      <div class="goal-progress-track"><div class="goal-progress-fill${g.met ? ' met' : ''}" style="width:${g.pct}%"></div></div>
    </div>`).join('');
}

export function showLoginScreen(show) {
  document.body.classList.toggle('logged-out', show);
  document.getElementById('login-screen')?.classList.toggle('hidden', !show);
  document.getElementById('app-shell')?.classList.toggle('hidden', show);
}

export function renderPlaylistTabs(containerId, activePlaylist, onSelect, gameId = state.activeGame) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const playlists = getPlaylists(gameId);
  if (gameId === GAME_IDS.VALORANT && playlists.length <= 1) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');
  container.innerHTML = playlists.map(pl => `
    <button class="pl-tab${pl.id === activePlaylist ? ' active' : ''}" data-playlist="${pl.id}">${pl.label}</button>
  `).join('');
  container.querySelectorAll('.pl-tab').forEach(btn => {
    btn.addEventListener('click', () => onSelect(btn.dataset.playlist, btn));
  });
}

export function renderFilterBar(containerId, games, filters, onChange, gameId = state.activeGame) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const sessions = getUniqueSessions(games, gameId);
  const allTags = Object.keys(getTagDefinitions(gameId));
  const blockLabel = gameId === GAME_IDS.VALORANT ? 'Block' : 'Session';

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
          <label>${blockLabel}</label>
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
        ${allTags.map(tag => `
          <button type="button" class="filter-tag-chip filter-tag-${getTagCat(tag, gameId)}${filters.tags.includes(tag) ? ' active' : ''}" data-tag="${tag}">${tag}</button>
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
      ${lines.map(l => `<div class="coach-line coach-${escapeAttr(l.type)}">${escapeHtml(l.text)}</div>`).join('')}
    </div>`;
}

export function renderActionItems(items) {
  const el = document.getElementById('action-items');
  if (!el) return;
  if (!items?.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="action-items-block">
      <p class="section-title">Priority Actions</p>
      <div class="action-item-grid">
        ${items.slice(0, 5).map(item => {
          const title = item.tag ?? item.title ?? (item.text?.split('—')[0]?.trim() || 'Focus');
          return `
          <div class="action-item-card action-${escapeAttr(item.type)}">
            <span class="action-item-kicker">Action Item</span>
            <h4 class="action-item-title">${escapeHtml(title)}</h4>
            ${item.lossPct != null
              ? `<p class="action-item-stat">Responsible for ${item.lossPct}% of tagged losses.</p>`
              : `<p class="action-item-stat">${escapeHtml(item.text)}</p>`}
            ${item.focus ? `<div class="action-item-focus"><span>Focus</span><p>${escapeHtml(item.focus)}</p></div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

export function barRows(entries, max, cmap, gameId = state.activeGame) {
  if (!entries.length) return '<div class="empty" style="padding:12px">No tags logged yet</div>';
  return entries.slice(0, 8).map(([tag, count]) => `
    <div class="bar-row">
      <div class="bar-label">${tag}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(count / max * 100)}%;background:${cmap[getTagCat(tag, gameId)]}"></div></div>
      <div class="bar-count">${count}</div>
    </div>`).join('');
}

export function showLoading(show) {
  document.body.classList.toggle('is-loading', show);
}

export function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + pageId)?.classList.add('active');
}

export function setPlayerSelector(prefix, activeId) {
  /* legacy no-op — personal app has no player selector */
}
