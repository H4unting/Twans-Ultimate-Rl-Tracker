/** Personal focus dashboard — self-coaching view */

import { calcStats, getPrimaryMode } from './utils.js';
import { buildWeeklyReport } from './reports.js';
import { getGoalProgress } from './goals.js';
import { getPerformanceInsights } from './insights.js';
import { rankBadgeHTML } from './ranks.js';

export function renderFocusPage(games, goals, display) {
  const container = document.getElementById('focus-content');
  if (!container) return;

  const stats = calcStats(games);
  const week = buildWeeklyReport(games, 0);
  const insights = getPerformanceInsights(games);
  const goalItems = getGoalProgress(games, goals);
  const mode = getPrimaryMode(games);

  const actionHTML = (insights.actionItems ?? []).slice(0, 5).map(item => `
    <div class="coach-action coach-action-${item.type}">
      <span class="coach-action-priority">${item.priority <= 2 ? '!' : '·'}</span>
      ${item.text}
    </div>`).join('');

  const goalsHTML = goalItems.length ? goalItems.map(g => `
    <div class="goal-progress-row">
      <div class="goal-progress-head"><span>${g.label}</span><span class="goal-progress-val">${g.display}</span></div>
      <div class="goal-progress-track"><div class="goal-progress-fill${g.met ? ' met' : ''}" style="width:${g.pct}%"></div></div>
    </div>`).join('') : '<div class="empty" style="padding:12px">Set goals on the Reports page</div>';

  container.innerHTML = `
    <div class="coach-player-card">
      <div class="coach-player-header">
        <div>
          <h2 style="color:${display.color}">${display.name}</h2>
          <div class="coach-sub">${stats.totalGames} total games · ${week.label}</div>
        </div>
        ${stats.currentMMR ? rankBadgeHTML(stats.currentMMR, 24, mode) : ''}
      </div>
      <div class="coach-section"><h3>Priority Actions</h3>${actionHTML || '<div class="empty" style="padding:12px">Log games for insights</div>'}</div>
      <div class="coach-section"><h3>Goal Progress</h3>${goalsHTML}</div>
      <div class="coach-section"><h3>Coach Notes</h3>
        <div class="coach-notes-readonly">
          ${(insights.report ?? []).slice(0, 5).map(l => `<div class="coach-line coach-${l.type}">${l.text}</div>`).join('') || '<div class="empty" style="padding:12px">No notes yet</div>'}
        </div>
      </div>
    </div>`;
}
