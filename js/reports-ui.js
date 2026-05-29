/** Reports page — weekly summaries, goals editor, export */

import { PLAYERS, getPlayerMeta, TAG_DEFINITIONS } from './config.js';
import { getGamesInWeek } from './utils.js';
import { buildWeeklyReport } from './reports.js';
import { getGoalProgress } from './goals.js';
import { getPerformanceInsights } from './insights.js';
import { exportGamesCSV, exportWeeklyReportCSV, printWeeklyReport } from './export.js';

export function renderReportsPage(data, goals, weekOffset, onWeekChange, onGoalsSave) {
  renderWeekNav(weekOffset, onWeekChange);
  renderGoalsEditor(goals, onGoalsSave);
  renderWeeklyReports(data, goals, weekOffset);
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

  el.innerHTML = PLAYERS.map(p => {
    const g = goals[p.id] ?? {};
    return `
      <div class="goals-player-block">
        <h3 class="player-name ${p.cls}">${getPlayerMeta(p.id).name}</h3>
        <div class="goals-form-grid">
          <div class="form-group"><label>MMR Target</label>
            <input type="number" id="goal-mmr-${p.id}" min="0" value="${g.mmrTarget || ''}" placeholder="e.g. 850"></div>
          <div class="form-group"><label>Games / Week</label>
            <input type="number" id="goal-games-${p.id}" min="1" value="${g.gamesPerWeek || 15}"></div>
          <div class="form-group"><label>Win Rate Target %</label>
            <input type="number" id="goal-wr-${p.id}" min="0" max="100" value="${g.winRateTarget || 50}"></div>
          <div class="form-group"><label>Focus Tag</label>
            <select id="goal-tag-${p.id}">
              <option value="">None</option>
              ${Object.keys(TAG_DEFINITIONS).map(t =>
                `<option value="${t}"${g.focusTag === t ? ' selected' : ''}>${t}</option>`).join('')}
            </select></div>
        </div>
      </div>`;
  }).join('') + `<button class="btn btn-primary" type="button" id="save-goals-btn">Save Goals</button>`;

  el.querySelector('#save-goals-btn')?.addEventListener('click', () => {
    const next = {};
    PLAYERS.forEach(p => {
      next[p.id] = {
        mmrTarget: parseInt(document.getElementById(`goal-mmr-${p.id}`)?.value, 10) || 0,
        gamesPerWeek: parseInt(document.getElementById(`goal-games-${p.id}`)?.value, 10) || 15,
        winRateTarget: parseInt(document.getElementById(`goal-wr-${p.id}`)?.value, 10) || 50,
        focusTag: document.getElementById(`goal-tag-${p.id}`)?.value ?? '',
      };
    });
    onGoalsSave(next);
  });
}

function renderWeeklyReports(data, goals, weekOffset) {
  const el = document.getElementById('reports-weekly');
  if (!el) return;

  el.innerHTML = PLAYERS.map(p => {
    const games = data[p.id] ?? [];
    const meta = getPlayerMeta(p.id);
    const report = buildWeeklyReport(games, weekOffset);
    const insights = getPerformanceInsights(games);
    const goalItems = weekOffset === 0 ? getGoalProgress(games, goals[p.id] ?? {}) : [];

    if (report.empty) {
      return `
        <div class="report-card">
          <div class="report-card-header"><h3 class="player-name ${p.cls}">${meta.name}</h3><span class="report-week-label">${report.label}</span></div>
          <div class="empty">No games logged this week</div>
        </div>`;
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

    return `
      <div class="report-card" data-player="${p.id}">
        <div class="report-card-header">
          <h3 class="player-name ${p.cls}">${meta.name}</h3>
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
          <button class="btn btn-cancel btn-sm" type="button" data-export="csv" data-player="${p.id}">Export CSV</button>
          <button class="btn btn-cancel btn-sm" type="button" data-export="pdf" data-player="${p.id}">Print PDF</button>
          <button class="btn btn-cancel btn-sm" type="button" data-export="allcsv" data-player="${p.id}">All Games CSV</button>
        </div>
      </div>`;
  }).join('');

  el.querySelectorAll('[data-export]').forEach(btn => {
    btn.addEventListener('click', () => {
      const playerId = btn.dataset.player;
      const meta = getPlayerMeta(playerId);
      const games = data[playerId] ?? [];
      const report = buildWeeklyReport(games, weekOffset);
      const insights = getPerformanceInsights(games);
      if (btn.dataset.export === 'csv') exportWeeklyReportCSV(report, meta.name);
      else if (btn.dataset.export === 'pdf') printWeeklyReport(report, meta.name, insights.report ?? []);
      else if (btn.dataset.export === 'allcsv') exportGamesCSV(games, meta.name);
    });
  });
}
