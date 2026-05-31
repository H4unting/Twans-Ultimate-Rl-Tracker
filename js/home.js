/** Home — brief glance: per-mode MMR, context, recent activity */

import {
  calcStats, getGamesInWeek, formatDuration, getPlaylistMMRRows,
  getMostRecentMode, getGamesForMode, getCurrentMMRForMode,
} from './utils.js';
import { getRank, rankBadgeHTML } from './ranks.js';
import { getTagLossCorrelations, ACTION_FOCUS_TIPS } from './insights.js';
import { TAG_CATS } from './config.js';
import { state } from './state.js';
import { getGameMeta } from './games.js';
import { getLoggingSessionNum } from './sessions.js';

function ensureHomeChartMode(games) {
  const rows = getPlaylistMMRRows(games);
  if (!rows.length) {
    state.homeChartMode = null;
    return null;
  }
  if (!state.homeChartMode || !rows.some(r => r.mode === state.homeChartMode)) {
    state.homeChartMode = getMostRecentMode(games);
  }
  return state.homeChartMode;
}

export function renderHomeSummary(games, goals) {
  const el = document.getElementById('home-summary');
  if (!el) return;

  const meta = getGameMeta(state.activeGame);
  const rows = getPlaylistMMRRows(games);
  if (!rows.length) {
    el.innerHTML = `<p class="home-summary-empty">Log a ${meta.label} game to see your ${meta.rankLabel} by queue.</p>`;
    return;
  }

  const chartMode = ensureHomeChartMode(games);
  const target = goals?.mmrTarget || 0;
  const activeRow = rows.find(r => r.mode === chartMode) ?? rows[0];

  const goalHTML = target > 0 && activeRow ? (() => {
    const mmr = activeRow.mmr;
    const remaining = target > mmr ? target - mmr : 0;
    const pct = Math.min(100, Math.round(mmr / target * 100));
    return `
      <div class="home-summary-goal">
        <div class="home-summary-goal-row">
          <span>${activeRow.mode} goal ${target}</span>
          <span>${mmr} / ${target}${remaining > 0 ? ` · ${remaining} left` : ''}</span>
        </div>
        <div class="goal-progress-track home-summary-track">
          <div class="goal-progress-fill${pct >= 100 ? ' met' : ''}" style="width:${pct}%"></div>
        </div>
      </div>`;
  })() : '';

  el.innerHTML = `
    <div class="home-mmr-grid">
      ${rows.map(r => {
        const rank = getRank(r.mmr, r.mode);
        const wkCls = r.weekGain >= 0 ? 'up' : 'down';
        const wk = `${r.weekGain >= 0 ? '+' : ''}${r.weekGain}`;
        return `
        <button type="button" class="home-mmr-row${r.mode === chartMode ? ' active' : ''}" data-home-mode="${r.mode}">
          ${rankBadgeHTML(r.mmr, 22, r.mode)}
          <span class="home-mmr-mode">${r.mode}</span>
          <span class="home-mmr-rank">${rank.name}</span>
          <span class="home-mmr-val">${r.mmr} ${meta.rankLabel}</span>
          <span class="home-mmr-week ${wkCls}">${wk} wk</span>
        </button>`;
      }).join('')}
    </div>
    ${goalHTML}`;

  el.querySelectorAll('[data-home-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.homeChartMode = btn.dataset.homeMode;
      window.__refreshHome?.();
    });
  });
}

export function renderHomeContext(games) {
  const el = document.getElementById('home-context');
  if (!el) return;

  if (!games.length) {
    el.innerHTML = `<p class="home-context-line muted">No games yet — start a session and log from the dock below.</p>`;
    return;
  }

  if (state.session.active) {
    const sessionNum = getLoggingSessionNum();
    const sg = games.filter(g => parseInt(g.session, 10) === sessionNum);
    const wins = sg.filter(g => g.result === 'W').length;
    const losses = sg.filter(g => g.result === 'L').length;
    const byMode = {};
    sg.forEach(g => {
      if (!byMode[g.mode]) byMode[g.mode] = 0;
      byMode[g.mode] += g.mmrDiff || 0;
    });
    const modeParts = Object.entries(byMode).map(([mode, gain]) => {
      const cls = gain >= 0 ? 'up' : 'down';
      return `${mode} <span class="${cls}">${gain >= 0 ? '+' : ''}${gain}</span>`;
    }).join(' · ');
    const elapsed = formatDuration(Date.now() - (state.session.startTime || Date.now()));
    el.innerHTML = `
      <p class="home-context-line">
        <span class="home-context-live">Live</span>
        Session ${sessionNum} · ${wins}W ${losses}L · ${elapsed}
        ${modeParts ? ` · ${modeParts}` : ''}
      </p>`;
    return;
  }

  const weekRows = getPlaylistMMRRows(games).filter(r => r.weekGameCount > 0);
  if (weekRows.length) {
    const parts = weekRows.map(r => {
      const cls = r.weekGain >= 0 ? 'up' : 'down';
      return `${r.mode} <span class="${cls}">${r.weekGain >= 0 ? '+' : ''}${r.weekGain}</span> (${r.weekGameCount}g)`;
    }).join(' · ');
    el.innerHTML = `
      <p class="home-context-line">
        This week · ${parts}
        · <a href="#" class="home-link" data-goto="analytics">Analytics</a>
      </p>`;
    wireHomeLinks(el);
    return;
  }

  el.innerHTML = `
    <p class="home-context-line muted">
      No games this week · last played ${games[games.length - 1].date}
      · <a href="#" class="home-link" data-goto="log">Match history</a>
    </p>`;
  wireHomeLinks(el);
}

function wireHomeLinks(el) {
  el.querySelectorAll('[data-goto]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const page = link.dataset.goto;
      const section = ['analytics', 'reports', 'sessions'].includes(page) ? 'review' : 'home';
      window.__navigate?.(page, section);
    });
  });
}

export function renderHomeFocus(games) {
  const el = document.getElementById('home-focus');
  if (!el) return;

  if (games.length < 2) {
    el.innerHTML = `
      <div class="home-focus-card home-focus-card-empty">
        <span class="home-focus-label">Today's Focus</span>
        <p class="home-focus-empty-text">Log a few games and tag losses — your top mistake shows up here.</p>
      </div>`;
    return;
  }

  const correlations = getTagLossCorrelations(games);
  const top = correlations.find(c => c.inLosses >= 1) ?? null;
  if (!top) {
    el.innerHTML = `
      <div class="home-focus-card home-focus-card-empty">
        <span class="home-focus-label">Today's Focus</span>
        <p class="home-focus-empty-text">Tag mistakes after losses to unlock your focus area.</p>
      </div>`;
    return;
  }

  const losses = games.filter(g => g.result === 'L').length;
  const lossNote = losses
    ? `${top.inLosses}× in ${losses} loss${losses === 1 ? '' : 'es'}`
    : `${top.inLosses}× tagged`;
  const tip = ACTION_FOCUS_TIPS[top.tag] ?? 'Slow down and review before you queue again.';

  el.innerHTML = `
    <div class="home-focus-card">
      <div class="home-focus-card-head">
        <span class="home-focus-label">Today's Focus</span>
        <a href="#" class="home-focus-more" data-goto="focus">Details →</a>
      </div>
      <div class="home-focus-tag-name">${top.tag}</div>
      <p class="home-focus-stat">${lossNote}</p>
      <p class="home-focus-tip">${tip}</p>
    </div>`;
  wireHomeLinks(el);
}

export function renderHomeActivity(games, limit = 10) {
  const el = document.getElementById('home-activity');
  if (!el) return;

  const recent = [...games].reverse().slice(0, limit);
  if (!recent.length) {
    el.innerHTML = `<div class="empty-state">Your recent games will show up here.</div>`;
    return;
  }

  el.innerHTML = `
    <ul class="home-activity-list">
      ${recent.map(g => {
        const diff = g.mmrDiff || 0;
        const diffCls = diff >= 0 ? 'up' : 'down';
        const tags = (g.tags || []).slice(0, 2).map(t =>
          `<span class="home-activity-tag ${TAG_CATS[t] || 'def'}">${t}</span>`,
        ).join('');
        return `
        <li class="home-activity-row">
          <span class="home-activity-result ${g.result}">${g.result}</span>
          <span class="home-activity-mmr ${diffCls}">${diff >= 0 ? '+' : ''}${diff}</span>
          <span class="home-activity-meta">${g.mode} · S${g.session}</span>
          <span class="home-activity-tags">${tags || '<span class="home-activity-none">—</span>'}</span>
          <span class="home-activity-date">${g.date}</span>
        </li>`;
      }).join('')}
    </ul>`;
}

export function getHomeChartGames(games) {
  const mode = ensureHomeChartMode(games) ?? getMostRecentMode(games);
  return getGamesForMode(games, mode);
}

export function renderHome(games, goals) {
  renderHomeSummary(games, goals);
  renderHomeContext(games);
  renderHomeFocus(games);
  renderHomeActivity(games);
}

export function getHomeChartModeLabel(games) {
  return ensureHomeChartMode(games) ?? getMostRecentMode(games);
}
