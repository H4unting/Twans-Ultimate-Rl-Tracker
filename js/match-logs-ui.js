/** Match logs — session groups, quick filters, expand/collapse */

import { formatDisplayDate } from './utils.js';
import { getGamesInWeek } from './utils.js';
import { renderInlineTags } from './ui.js';
import { getRank, rankIconHTML } from './ranks.js';
import { formatRankCompact, valRankChangeIndicatorHTML } from './games/valorant/ranks.js';
import { getLoggingSessionNum } from './sessions.js';
import { state } from './state.js';
import { GAME_IDS, getGameMeta, getRankDiff } from './games.js';

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

/** Group filtered games by session # + date — keeps game arrays intact */
function groupForMatchLogs(games) {
  const map = new Map();
  games.forEach(g => {
    const key = `${parseInt(g.session, 10) || 1}|${g.date ?? ''}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(g);
  });
  return [...map.entries()]
    .map(([key, sessionGames]) => {
      const sessionNum = parseInt(key.split('|')[0], 10) || 1;
      const wins = sessionGames.filter(x => x.result === 'W').length;
      const losses = sessionGames.filter(x => x.result === 'L').length;
      const gameId = sessionGames[0]?.game ?? state.activeGame;
      const mmrGain = sessionGames.reduce((s, x) => s + (getRankDiff(x, gameId) || 0), 0);
      return { sessionNum, sessionGames, wins, losses, mmrGain };
    })
    .sort((a, b) => b.sessionNum - a.sessionNum);
}

export function renderGroupedMatchLogs(games, editable = false) {
  const el = document.getElementById('matchlogs-list');
  if (!el) return;

  const gameId = state.activeGame;
  const meta = getGameMeta(gameId);
  const diffLabel = meta.diffLabel;
  const isVal = gameId === GAME_IDS.VALORANT;

  if (!games.length) {
    el.innerHTML = `<div class="empty-state">No matches match this filter. Log a ${isVal ? 'round' : 'game'} or try another filter.</div>`;
    return;
  }

  const sessions = groupForMatchLogs(games);

  el.innerHTML = sessions.map(sess => {
    const gainCls = sess.mmrGain >= 0 ? 'pos' : 'neg';
    const gainStr = `${sess.mmrGain >= 0 ? '+' : ''}${sess.mmrGain} ${diffLabel}`;
    const ordered = [...sess.sessionGames].reverse();
    return `
      <section class="session-log-group">
        <header class="session-log-head ${gainCls}">
          <span class="session-log-title">${isVal ? 'Grind Block' : 'Session'} ${sess.sessionNum}</span>
          <span class="session-log-meta">${sess.wins}W · ${sess.losses}L · <strong>${gainStr}</strong></span>
        </header>
        <div class="session-log-games">
          ${ordered.map((g, i) => matchRowHTML(g, i + 1, editable, gameId)).join('')}
        </div>
      </section>`;
  }).join('');
}

function valRankDetailHTML(g, startRR, endRR, diffLabel) {
  const change = valRankChangeIndicatorHTML(g.startRank, g.endRank);
  return `<span class="val-rank-detail"><b>${diffLabel}</b> ${formatRankCompact(g.startRank, startRR)} → ${formatRankCompact(g.endRank, endRR)}${change ? ` ${change}` : ''}</span>`;
}

function matchRowHTML(g, gameNum, editable, gameId) {
  const meta = getGameMeta(gameId);
  const diffLabel = meta.diffLabel;
  const isVal = gameId === GAME_IDS.VALORANT;
  const diff = getRankDiff(g, gameId);
  const diffCls = diff >= 0 ? 'pos' : 'neg';
  const diffStr = `${diff >= 0 ? '+' : ''}${diff}`;
  const startRank = g[meta.startRankField ?? 'startMMR'] ?? g.startMMR ?? '';
  const endRank = g[meta.rankField ?? 'endMMR'] ?? g.endMMR ?? '';
  const agent = g.agent ? `<span class="match-log-agent">${g.agent}</span>` : '';
  const map = g.map ? `<span class="match-log-map">${g.map}</span>` : '';

  return `
    <details class="match-log-row">
      <summary class="match-log-summary">
        <span class="match-log-game-num">${isVal ? 'Match' : 'Game'} ${gameNum}</span>
        <span class="badge ${g.result}">${g.result === 'W' ? 'W' : 'L'}</span>
        <span class="match-log-mmr ${diffCls}">${diffStr} ${diffLabel}</span>
        <span class="match-log-mode">${g.mode}</span>
        ${agent}${map}
        ${renderInlineTags(g.tags, gameId)}
      </summary>
      <div class="match-log-detail">
        <div class="match-log-detail-grid">
          <span><b>Date</b> ${g.date}</span>
          <span><b>Match #</b> ${g.match}</span>
          ${isVal
            ? `<span><b>K/D/A</b> ${g.kills ?? g.goals ?? 0}/${g.deaths ?? 0}/${g.valAssists ?? g.assists ?? 0}</span>
               ${valRankDetailHTML(g, startRank, endRank, diffLabel)}
               ${g.agent ? `<span><b>Agent</b> ${g.agent}</span>` : ''}
               ${g.map ? `<span><b>Map</b> ${g.map}</span>` : ''}`
            : `<span><b>G/A/S</b> ${g.goals}/${g.assists || 0}/${g.saves}</span>
               <span><b>MMR</b> ${g.startMMR} → ${g.endMMR} ${rankIconHTML(getRank(g.endMMR, g.mode), 18)}</span>`}
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
