/** Home — brief glance: status, context, recent activity */

import { calcStats, getPrimaryMode, getGamesInWeek, formatDuration } from './utils.js';
import { buildWeeklyReport } from './reports.js';
import { getRank, rankBadgeHTML } from './ranks.js';
import { getTagLossCorrelations, ACTION_FOCUS_TIPS } from './insights.js';
import { TAG_CATS } from './config.js';
import { state } from './state.js';
import { getLoggingSessionNum } from './sessions.js';

export function renderHomeSummary(games, goals) {
  const el = document.getElementById('home-summary');
  if (!el) return;

  const stats = calcStats(games);
  const mode = getPrimaryMode(games);
  const week = buildWeeklyReport(games, 0);
  const mmr = stats.currentMMR || 0;
  const rank = mmr ? getRank(mmr, mode) : null;
  const target = goals?.mmrTarget || 0;
  const weekGain = week.empty ? 0 : week.mmrGain;
  const weekCls = weekGain >= 0 ? 'up' : 'down';
  const weekLabel = weekGain >= 0 ? `+${weekGain}` : `${weekGain}`;

  const remaining = target > mmr ? target - mmr : 0;
  const pct = target > 0 ? Math.min(100, Math.round(mmr / target * 100)) : 0;

  const goalHTML = target > 0 ? `
    <div class="home-summary-goal">
      <div class="home-summary-goal-row">
        <span>Goal ${target}</span>
        <span>${mmr} / ${target}${remaining > 0 ? ` · ${remaining} left` : ''}</span>
      </div>
      <div class="goal-progress-track home-summary-track">
        <div class="goal-progress-fill${pct >= 100 ? ' met' : ''}" style="width:${pct}%"></div>
      </div>
    </div>` : '';

  el.innerHTML = `
    <div class="home-summary">
      <div class="home-summary-top">
        ${rank ? rankBadgeHTML(mmr, 28, mode) : ''}
        <div class="home-summary-main">
          <div class="home-summary-rankline">
            <span class="home-summary-rank">${rank?.name ?? 'Unranked'}</span>
            <span class="home-summary-dot">·</span>
            <span class="home-summary-mmr">${mmr || '—'} MMR</span>
            <span class="home-summary-dot">·</span>
            <span class="home-summary-week ${weekCls}">${weekLabel} this week</span>
          </div>
          ${goalHTML}
        </div>
      </div>
    </div>`;
}

export function renderHomeContext(games) {
  const el = document.getElementById('home-context');
  if (!el) return;

  if (!games.length) {
    el.innerHTML = `<p class="home-context-line muted">No games yet — start a session and log from the dock below.</p>`;
    return;
  }

  const stats = calcStats(games);
  const weekGames = getGamesInWeek(games, 0);
  const week = buildWeeklyReport(games, 0);

  if (state.session.active) {
    const sessionNum = getLoggingSessionNum();
    const sg = games.filter(g => parseInt(g.session, 10) === sessionNum);
    const wins = sg.filter(g => g.result === 'W').length;
    const losses = sg.filter(g => g.result === 'L').length;
    const mmrGain = sg.reduce((s, g) => s + (g.mmrDiff || 0), 0);
    const elapsed = formatDuration(Date.now() - (state.session.startTime || Date.now()));
    const gainCls = mmrGain >= 0 ? 'up' : 'down';
    const gainStr = `${mmrGain >= 0 ? '+' : ''}${mmrGain}`;
    el.innerHTML = `
      <p class="home-context-line">
        <span class="home-context-live">Live</span>
        Session ${sessionNum} · ${wins}W ${losses}L ·
        <span class="${gainCls}">${gainStr} MMR</span> · ${elapsed}
      </p>`;
    return;
  }

  const streak = stats.streak.count > 0 && stats.streak.type === 'W'
    ? ` · ${stats.streak.count}W streak`
    : stats.streak.count >= 3 && stats.streak.type === 'L'
      ? ` · ${stats.streak.count}L streak`
      : '';

  if (weekGames.length) {
    el.innerHTML = `
      <p class="home-context-line">
        This week · ${weekGames.length} game${weekGames.length === 1 ? '' : 's'} ·
        ${week.winRate}% WR ·
        <span class="${week.mmrGain >= 0 ? 'up' : 'down'}">${week.mmrGain >= 0 ? '+' : ''}${week.mmrGain} MMR</span>${streak}
        · <a href="#" class="home-link" data-goto="analytics">Analytics</a>
      </p>`;
  } else {
    el.innerHTML = `
      <p class="home-context-line muted">
        No games this week · last played ${games[games.length - 1].date}
        · <a href="#" class="home-link" data-goto="matchlogs">Match logs</a>
      </p>`;
  }

  wireHomeLinks(el);
}

function wireHomeLinks(el) {
  el.querySelectorAll('[data-goto]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const page = link.dataset.goto;
      const section = page === 'focus' ? 'home' : 'review';
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

export function renderHome(games, goals) {
  renderHomeSummary(games, goals);
  renderHomeContext(games);
  renderHomeFocus(games);
  renderHomeActivity(games);
}
