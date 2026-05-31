/** Reports page — personal weekly summaries + goals */

import { buildWeeklyReport } from './reports.js';
import { getGoalProgress, weekRankGain, getActiveGoals, mergeActiveGoals, getFocusTagOptions } from './goals.js';
import { getPerformanceInsights } from './insights.js';
import { exportGamesCSV, exportWeeklyReportCSV, printWeeklyReport } from './export.js';
import { state } from './state.js';
import { GAME_IDS, getGameMeta } from './games.js';

export function renderReportsPage(games, displayName, weekOffset, onWeekChange, onGoalsSave) {
  renderWeekNav(weekOffset, onWeekChange);
  renderGoalsEditor(onGoalsSave);
  renderWeeklyReport(games, displayName, weekOffset);
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

function renderGoalsEditor(onGoalsSave) {
  const el = document.getElementById('goals-editor');
  if (!el) return;
  const g = getActiveGoals();
  const meta = getGameMeta(state.activeGame);
  const isVal = state.activeGame === GAME_IDS.VALORANT;

  el.innerHTML = `
    <div class="goals-form-grid">
      <div class="form-group"><label for="goal-mmr">${isVal ? 'Weekly RR Goal' : `${meta.rankLabel} Target`}</label>
        <input type="number" id="goal-mmr" min="0" value="${g.mmrTarget || ''}" placeholder="${isVal ? 'e.g. 100' : 'e.g. 850'}"></div>      <div class="form-group"><label>${isVal ? 'Matches / Week' : 'Games / Week'}</label>
        <input type="number" id="goal-games" min="1" value="${g.gamesPerWeek || (isVal ? 20 : 15)}"></div>
      <div class="form-group"><label>Win Rate Target %</label>
        <input type="number" id="goal-wr" min="0" max="100" value="${g.winRateTarget || 50}"></div>
      <div class="form-group"><label>Focus Tag</label>
        <select id="goal-tag">
          <option value="">None</option>
          ${getFocusTagOptions().map(t =>
            `<option value="${t}"${g.focusTag === t ? ' selected' : ''}>${t}</option>`).join('')}
        </select></div>
    </div>
    <button class="btn btn-primary" type="button" id="save-goals-btn">Save Goals</button>`;

  el.querySelector('#save-goals-btn')?.addEventListener('click', () => {
    const patch = {
      mmrTarget: parseInt(document.getElementById('goal-mmr')?.value, 10) || 0,
      gamesPerWeek: parseInt(document.getElementById('goal-games')?.value, 10) || (isVal ? 20 : 15),
      winRateTarget: parseInt(document.getElementById('goal-wr')?.value, 10) || 50,
      focusTag: document.getElementById('goal-tag')?.value ?? '',
    };
    onGoalsSave(mergeActiveGoals(patch));
  });
}

function renderWeeklyReport(games, displayName, weekOffset) {
  const el = document.getElementById('reports-weekly');
  if (!el) return;

  const meta = getGameMeta(state.activeGame);
  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const report = buildWeeklyReport(games, weekOffset);
  const insights = getPerformanceInsights(games, state.activeGame);
  const goalItems = weekOffset === 0 ? getGoalProgress(games, getActiveGoals()) : [];

  if (report.empty) {
    el.innerHTML = `<div class="report-card"><div class="empty">No ${isVal ? 'matches' : 'games'} logged this week</div></div>`;
    return;
  }

  const vsHTML = report.vsLastWeek ? `
    <div class="report-vs">
      <span class="${report.vsLastWeek.games >= 0 ? 'pos' : 'neg'}">${report.vsLastWeek.games >= 0 ? '+' : ''}${report.vsLastWeek.games} ${isVal ? 'matches' : 'games'}</span>
      <span class="${report.vsLastWeek.winRate >= 0 ? 'pos' : 'neg'}">${report.vsLastWeek.winRate >= 0 ? '+' : ''}${report.vsLastWeek.winRate}% WR</span>
      <span class="${report.vsLastWeek.mmrGain >= 0 ? 'pos' : 'neg'}">${report.vsLastWeek.mmrGain >= 0 ? '+' : ''}${report.vsLastWeek.mmrGain} ${meta.diffLabel}</span>
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
        <div class="report-stat"><div class="val">${report.games}</div><div class="lbl">${isVal ? 'Matches' : 'Games'}</div></div>
        <div class="report-stat"><div class="val">${report.winRate}%</div><div class="lbl">Win Rate</div></div>
        <div class="report-stat"><div class="val ${report.mmrGain >= 0 ? 'pos' : 'neg'}">${report.mmrGain >= 0 ? '+' : ''}${report.mmrGain}</div><div class="lbl">${meta.diffLabel}</div></div>
        <div class="report-stat"><div class="val">${report.sessions}</div><div class="lbl">${isVal ? 'Blocks' : 'Sessions'}</div></div>
      </div>
      ${report.topMistake ? `<div class="report-highlight">Top leak: <strong>${report.topMistake[0]}</strong> (${report.topMistake[1]}×)</div>` : ''}
      ${vsHTML}${goalsHTML}
      <div class="report-export-row">
        <button class="btn btn-cancel btn-sm" type="button" id="export-csv">Export CSV</button>
        <button class="btn btn-cancel btn-sm" type="button" id="export-pdf">Print PDF</button>
        <button class="btn btn-cancel btn-sm" type="button" id="export-all">${isVal ? 'All Matches CSV' : 'All Games CSV'}</button>
      </div>
    </div>`;

  el.querySelector('#export-csv')?.addEventListener('click', () => exportWeeklyReportCSV(report, displayName, state.activeGame));
  el.querySelector('#export-pdf')?.addEventListener('click', () => printWeeklyReport(report, displayName, insights.report ?? [], state.activeGame));
  el.querySelector('#export-all')?.addEventListener('click', () => exportGamesCSV(games, displayName, state.activeGame));
}
