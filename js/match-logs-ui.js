/** Match logs — session groups, quick filters, expand/collapse */

import { formatDisplayDate } from './utils.js';
import { getGamesInWeek } from './utils.js';
import { renderInlineTags } from './ui.js';
import { getRank, rankIconHTML } from './ranks.js';
import { getLoggingSessionNum } from './sessions.js';

export const QUICK_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'last50', label: 'Last 50' },
  { id: 'session', label: 'Current Session' },
];

let activeQuickFilter = 'all';

export function applyQuickFilter(games, filterId, sessionNum) {
  switch (filterId) {
    case 'today': {
      const today = formatDisplayDate(new Date());
      return games.filter(g => g.date === today);
    }
    case 'week':
      return getGamesInWeek(games, 0);
    case 'last50':
      return games.slice(-50);
    case 'session':
      return games.filter(g => parseInt(g.session, 10) === sessionNum);
    default:
      return games;
  }
}

export function renderQuickFilters(containerId, onChange) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="quick-filter-bar">
      ${QUICK_FILTERS.map(f => `
        <button type="button" class="quick-filter-btn${f.id === activeQuickFilter ? ' active' : ''}" data-qf="${f.id}">${f.label}</button>
      `).join('')}
    </div>`;
  el.querySelectorAll('[data-qf]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeQuickFilter = btn.dataset.qf;
      renderQuickFilters(containerId, onChange);
      onChange(activeQuickFilter);
    });
  });
}

/** Group filtered games by session # — keeps game arrays intact */
function groupForMatchLogs(games) {
  const map = new Map();
  games.forEach(g => {
    const sn = parseInt(g.session, 10) || 1;
    if (!map.has(sn)) map.set(sn, []);
    map.get(sn).push(g);
  });
  return [...map.entries()]
    .map(([sessionNum, sessionGames]) => {
      const wins = sessionGames.filter(x => x.result === 'W').length;
      const losses = sessionGames.filter(x => x.result === 'L').length;
      const mmrGain = sessionGames.reduce((s, x) => s + (x.mmrDiff || 0), 0);
      return { sessionNum, sessionGames, wins, losses, mmrGain };
    })
    .sort((a, b) => b.sessionNum - a.sessionNum);
}

export function renderGroupedMatchLogs(games, editable = false) {
  const el = document.getElementById('matchlogs-list');
  if (!el) return;

  if (!games.length) {
    el.innerHTML = '<div class="empty-state">No games match this filter. Log a match or try another filter.</div>';
    return;
  }

  const sessions = groupForMatchLogs(games);

  el.innerHTML = sessions.map(sess => {
    const gainCls = sess.mmrGain >= 0 ? 'pos' : 'neg';
    const gainStr = `${sess.mmrGain >= 0 ? '+' : ''}${sess.mmrGain} MMR`;
    const ordered = [...sess.sessionGames].reverse();
    return `
      <section class="session-log-group">
        <header class="session-log-head ${gainCls}">
          <span class="session-log-title">Session ${sess.sessionNum}</span>
          <span class="session-log-meta">${sess.wins}W · ${sess.losses}L · <strong>${gainStr}</strong></span>
        </header>
        <div class="session-log-games">
          ${ordered.map((g, i) => matchRowHTML(g, i + 1, editable)).join('')}
        </div>
      </section>`;
  }).join('');
}

function matchRowHTML(g, gameNum, editable) {
  const diffCls = (g.mmrDiff || 0) >= 0 ? 'pos' : 'neg';
  const diffStr = `${(g.mmrDiff || 0) >= 0 ? '+' : ''}${g.mmrDiff || 0}`;
  return `
    <details class="match-log-row">
      <summary class="match-log-summary">
        <span class="match-log-game-num">Game ${gameNum}</span>
        <span class="badge ${g.result}">${g.result === 'W' ? 'W' : 'L'}</span>
        <span class="match-log-mmr ${diffCls}">${diffStr} MMR</span>
        <span class="match-log-mode">${g.mode}</span>
        ${renderInlineTags(g.tags)}
      </summary>
      <div class="match-log-detail">
        <div class="match-log-detail-grid">
          <span><b>Date</b> ${g.date}</span>
          <span><b>Match #</b> ${g.match}</span>
          <span><b>G/A/S</b> ${g.goals}/${g.assists || 0}/${g.saves}</span>
          <span><b>MMR</b> ${g.startMMR} → ${g.endMMR} ${rankIconHTML(getRank(g.endMMR, g.mode), 18)}</span>
        </div>
        ${g.notes ? `<p class="match-log-notes">${g.notes}</p>` : ''}
        ${editable ? `
          <div class="match-log-actions">
            <button class="action-btn edit" data-match="${g.match}" title="Edit">✏️ Edit</button>
            <button class="action-btn del" data-match="${g.match}" title="Delete">🗑️ Delete</button>
          </div>` : ''}
      </div>
    </details>`;
}

export function getActiveQuickFilter() {
  return activeQuickFilter;
}

export function resetQuickFilter() {
  activeQuickFilter = 'all';
}

export function getQuickFilterSessionNum() {
  return getLoggingSessionNum();
}
