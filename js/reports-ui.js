/** Reports page — personal weekly summaries + goals */

import { TAG_DEFINITIONS } from './config.js';
import { buildWeeklyReport } from './reports.js';
import { getGoalProgress } from './goals.js';
import { getPerformanceInsights } from './insights.js';
import { exportGamesCSV, exportWeeklyReportCSV, printWeeklyReport } from './export.js';

export function renderReportsPage(games, goals, displayName, weekOffset, onWeekChange, onGoalsSave) {
  renderWeekNav(weekOffset, onWeekChange);
  renderGoalsEditor(goals, onGoalsSave);
  renderWeeklyReport(games, goals, displayName, weekOffset);
}

function renderWeekNav(weekOffset, onWeekChange) {
  const el = document.getElementById('reports-week-nav');
  if (!el) return;
  const label = weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Last Week' : `${weekOffset} weeks ago`;
  el.innerHTML = `
    <button class="week-nav-btn" type="button" id="week-prev" ${weekOffset >= 12 ? 'disabled' : ''}>← Older</button>
    <span class="week-nav-label">${label}</span>
    <button class="week-nav-btn" type="button" id="week-next" ${weekOffset === 0 ? 'disabled' : ''}>Newer →</button>`;
  el.querySelector('#week-prev')?.addEventListener('click', () => onWeekChange(weekOffset + 1));
  el.querySelector('#week-next')?.addEventListener('click', () => onWeekChange(Math.max(0, weekOffset - 1)));
}

function renderGoalsEditor(goals, onGoalsSave) {
  const el = document.getElementById('goals-editor');
  if (!el) return;
  const g = goals ?? {};

  el.innerHTML = `
    <div class="goals-form-grid">
      <div class="form-group"><label>MMR Target</label>
        <input type="number" id="goal-mmr" min="0" value="${g.mmrTarget || ''}" placeholder="e.g. 850"></div>
      <div class="form-group"><label>Games / Week</label>
        <input type="number" id="goal-games" min="1" value="${g.gamesPerWeek || 15}"></div>
      <div class="form-group"><label>Win Rate Target %</label>
        <input type="number" id="goal-wr" min="0" max="100" value="${g.winRateTarget || 50}"></div>
      <div class="form-group"><label>Focus Tag</label>
        <select id="goal-tag">
          <option value="">None</option>
          ${Object.keys(TAG_DEFINITIONS).map(t =>
            `<option value="${t}"${g.focusTag === t ? ' selected' : ''}>${t}</option>`).join('')}
        </select></div>
    </div>
    <button class="btn btn-primary" type="button" id="save-goals-btn">Save Goals</button>`;

  el.querySelector('#save-goals-btn')?.addEventListener('click', () => {
    onGoalsSave({
      mmrTarget: parseInt(document.getElementById('goal-mmr')?.value, 10) || 0,
      gamesPerWeek: parseInt(document.getElementById('goal-games')?.value, 10) || 15,
      winRateTarget: parseInt(document.getElementById('goal-wr')?.value, 10) || 50,
      focusTag: document.getElementById('goal-tag')?.value ?? '',
    });
  });
}

function renderWeeklyReport(games, goals, displayName, weekOffset) {
  const el = document.getElementById('reports-weekly');
  if (!el) return;

  const report = buildWeeklyReport(games, weekOffset);
  const insights = getPerformanceInsights(games);
  const goalItems = weekOffset === 0 ? getGoalProgress(games, goals) : [];

  if (report.empty) {
    el.innerHTML = `<div class="report-card"><div class="empty">No games logged this week</div></div>`;
    return;
  }

  const vsHTML = report.vsLastWeek ? `
    <div class="report-vs">
      <span class="${report.vsLastWeek.games >= 0 ? 'pos' : 'neg'}">${report.vsLastWeek.games >= 0 ? '+' : ''}${report.vsLastWeek.games} games</span>
      <span class="${report.vsLastWeek.winRate >= 0 ? 'pos' : 'neg'}">${report.vsLastWeek.winRate >= 0 ? '+' : ''}${report.vsLastWeek.winRate}% WR</span>
      <span class="${report.vsLastWeek.mmrGain >= 0 ? 'pos' : 'neg'}">${report.vsLastWeek.mmrGain >= 0 ? '+' : ''}${report.vsLastWeek.mmrGain} MMR</span>
      <span class="report-vs-lbl">vs last week</span>
    </div>` : '';

  const goalsHTML = goalItems.length ? `
    <div class="report-goals">${goalItems.map(g => `
      <div class="goal-mini"><span>${g.label}</span><div class="goal-progress-track"><div class="goal-progress-fill${g.met ? ' met' : ''}" style="width:${g.pct}%"></div></div></div>`).join('')}</div>` : '';

  el.innerHTML = `
    <div class="report-card">
      <div class="report-card-header">
        <h3>${displayName}</h3>
        <span class="report-week-label">${report.label}</span>
      </div>
      <div class="report-stats-grid">
        <div class="report-stat"><div class="val">${report.games}</div><div class="lbl">Games</div></div>
        <div class="report-stat"><div class="val">${report.winRate}%</div><div class="lbl">Win Rate</div></div>
        <div class="report-stat"><div class="val ${report.mmrGain >= 0 ? 'pos' : 'neg'}">${report.mmrGain >= 0 ? '+' : ''}${report.mmrGain}</div><div class="lbl">MMR</div></div>
        <div class="report-stat"><div class="val">${report.sessions}</div><div class="lbl">Sessions</div></div>
      </div>
      ${report.topMistake ? `<div class="report-highlight">Top mistake: <strong>${report.topMistake[0]}</strong> (${report.topMistake[1]}×)</div>` : ''}
      ${vsHTML}${goalsHTML}
      <div class="report-export-row">
        <button class="btn btn-cancel btn-sm" type="button" id="export-csv">Export CSV</button>
        <button class="btn btn-cancel btn-sm" type="button" id="export-pdf">Print PDF</button>
        <button class="btn btn-cancel btn-sm" type="button" id="export-all">All Games CSV</button>
      </div>
    </div>`;

  el.querySelector('#export-csv')?.addEventListener('click', () => exportWeeklyReportCSV(report, displayName));
  el.querySelector('#export-pdf')?.addEventListener('click', () => printWeeklyReport(report, displayName, insights.report ?? []));
  el.querySelector('#export-all')?.addEventListener('click', () => exportGamesCSV(games, displayName));
}
