/** Personal focus dashboard — auto-generated coaching focus */

import { calcStats, getPrimaryMode, getGamesInWeek } from './utils.js';
import { buildWeeklyReport } from './reports.js';
import { getGoalProgress } from './goals.js';
import { getPerformanceInsights, getTagLossCorrelations, ACTION_FOCUS_TIPS } from './insights.js';
import { rankBadgeHTML } from './ranks.js';
import { getLoggingSessionNum } from './sessions.js';
import { state } from './state.js';

function gamesSinceLastTag(games, tag) {
  for (let i = games.length - 1; i >= 0; i--) {
    if ((games[i].tags || []).includes(tag)) return games.length - 1 - i;
  }
  return games.length;
}

function focusSuccessRate(games, tags, windowSize = 10) {
  const recent = games.slice(-windowSize);
  if (!recent.length || !tags.length) return null;
  const clean = recent.filter(g => !tags.some(t => (g.tags || []).includes(t))).length;
  return Math.round(clean / recent.length * 100);
}

function improvementStreak(games, tags) {
  let streak = 0;
  for (let i = games.length - 1; i >= 0; i--) {
    if (tags.some(t => (games[i].tags || []).includes(t))) break;
    streak++;
  }
  return streak;
}

export function renderFocusPage(games, goals, display) {
  const container = document.getElementById('focus-content');
  if (!container) return;

  const stats = calcStats(games);
  const week = buildWeeklyReport(games, 0);
  const insights = getPerformanceInsights(games);
  const goalItems = getGoalProgress(games, goals);
  const mode = getPrimaryMode(games);
  const correlations = getTagLossCorrelations(games);
  const primary = correlations.find(c => c.inLosses >= 2) ?? correlations[0] ?? null;
  const secondary = correlations.find(c => c.tag !== primary?.tag && c.inLosses >= 1) ?? correlations[1] ?? null;
  const focusTags = [primary?.tag, secondary?.tag].filter(Boolean);
  const successRate = focusSuccessRate(games, focusTags);
  const sincePrimary = primary ? gamesSinceLastTag(games, primary.tag) : games.length;
  const streak = improvementStreak(games, focusTags);
  const sessionNum = getLoggingSessionNum();
  const sessionGames = state.session.active
    ? games.filter(g => parseInt(g.session, 10) === sessionNum)
    : [];

  const focusGoalGames = 10;
  const primaryTip = primary ? (ACTION_FOCUS_TIPS[primary.tag] ?? 'Tag honestly after losses to track progress.') : '';

  const autoFocusHTML = primary ? `
    <div class="focus-auto-card">
      <div class="focus-auto-col">
        <span class="focus-auto-label">Primary</span>
        <strong class="focus-auto-tag">${primary.tag}</strong>
        <span class="focus-auto-meta">${primary.inLosses}× in losses</span>
      </div>
      ${secondary ? `
      <div class="focus-auto-col">
        <span class="focus-auto-label">Secondary</span>
        <strong class="focus-auto-tag">${secondary.tag}</strong>
        <span class="focus-auto-meta">${secondary.inLosses}× in losses</span>
      </div>` : ''}
      <div class="focus-auto-col focus-auto-goal">
        <span class="focus-auto-label">Goal</span>
        <strong>Play ${focusGoalGames} games without either tag</strong>
      </div>
    </div>
    <p class="focus-auto-tip">${primaryTip}</p>
    <div class="focus-progress-grid">
      <div class="focus-progress-stat">
        <span class="focus-progress-val">${successRate ?? '—'}${successRate != null ? '%' : ''}</span>
        <span class="focus-progress-lbl">Focus success (last 10)</span>
      </div>
      <div class="focus-progress-stat">
        <span class="focus-progress-val">${sincePrimary}</span>
        <span class="focus-progress-lbl">Games since last "${primary.tag}"</span>
      </div>
      <div class="focus-progress-stat">
        <span class="focus-progress-val">${streak} 🔥</span>
        <span class="focus-progress-lbl">Clean-game streak</span>
      </div>
    </div>` : `
    <div class="empty-state">Log at least 3 games and tag losses — your auto focus will appear here.</div>`;

  const customFocusHTML = goals?.focusTag ? `
    <div class="coach-section coach-focus-week">
      <h3>Custom Focus · ${goals.focusTag}</h3>
      ${(() => {
        const weekGames = getGamesInWeek(games, 0);
        const focusCount = weekGames.filter(g => (g.tags || []).includes(goals.focusTag)).length;
        const focusPct = weekGames.length ? Math.round(focusCount / weekGames.length * 100) : 0;
        return `
        <div class="coach-focus-stat">
          <span class="coach-focus-count">${focusCount}</span>
          <span class="coach-focus-of">of ${weekGames.length} games tagged this week</span>
          <div class="goal-progress-track" style="margin-top:10px">
            <div class="goal-progress-fill${focusPct <= 20 ? ' met' : ''}" style="width:${Math.min(100, focusPct)}%"></div>
          </div>
        </div>`;
      })()}
    </div>` : '';

  const actionHTML = (insights.actionItems ?? []).slice(0, 3).map(item => `
    <div class="action-item-card action-${item.type}">
      <span class="action-item-kicker">Action Item</span>
      <h4 class="action-item-title">${item.tag ?? item.text.split('—')[0]?.trim()}</h4>
      ${item.focus ? `<p class="action-item-stat">${item.focus}</p>` : `<p class="action-item-stat">${item.text}</p>`}
    </div>`).join('');

  const goalsHTML = goalItems.length ? goalItems.map(g => `
    <div class="goal-progress-row">
      <div class="goal-progress-head"><span>${g.label}</span><span class="goal-progress-val">${g.display}</span></div>
      <div class="goal-progress-track"><div class="goal-progress-fill${g.met ? ' met' : ''}" style="width:${g.pct}%"></div></div>
    </div>`).join('') : '<div class="empty" style="padding:12px">Set goals on the Reports page</div>';

  container.innerHTML = `
    <div class="coach-player-card focus-page-card">
      <div class="coach-player-header">
        <div>
          <h2 style="color:${display.color}">Focus Mode</h2>
          <div class="coach-sub">${stats.totalGames} games · ${state.session.active ? `Session ${sessionNum} · ${sessionGames.length} logged` : week.label}</div>
        </div>
        ${stats.currentMMR ? rankBadgeHTML(stats.currentMMR, 24, mode) : ''}
      </div>
      <div class="coach-section"><h3>Auto Focus</h3>${autoFocusHTML}</div>
      ${customFocusHTML}
      <div class="coach-section"><h3>Actions</h3><div class="action-item-grid">${actionHTML || '<div class="empty">Log games for insights</div>'}</div></div>
      <div class="coach-section coach-section-compact"><h3>Goals</h3>${goalsHTML}</div>
    </div>`;
}
