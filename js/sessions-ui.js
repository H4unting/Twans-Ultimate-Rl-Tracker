/** Session history page */

import { groupSessionsForHistory } from './utils.js';
import { exportSessionsCSV } from './export.js';
import { getLoggingSessionNum } from './sessions.js';
import { state } from './state.js';

export function renderSessionsPage(games, displayName, { onViewSession, onExport } = {}) {
  const el = document.getElementById('sessions-content');
  if (!el) return;

  const sessions = groupSessionsForHistory(games);
  const activeNum = state.session.active ? getLoggingSessionNum() : null;

  if (!sessions.length) {
    el.innerHTML = `
      <div class="sessions-empty">
        <div class="sessions-empty-icon">📋</div>
        <p>No sessions yet</p>
        <span>Start a session from the dock and log games — they'll show up here.</span>
      </div>`;
    return;
  }

  const rows = sessions.map(s => {
    const wrClass = s.winRate >= 50 ? 'pos' : 'neg';
    const mmrClass = s.mmrGain >= 0 ? 'pos' : 'neg';
    const live = activeNum === s.sessionNum ? '<span class="session-live-pill">Live</span>' : '';
    const topTag = s.topTag
      ? `<span class="session-tag-pill">${s.topTag[0]}</span>`
      : '<span class="session-tag-none">—</span>';
    return `
      <tr class="session-row" data-session="${s.sessionNum}">
        <td><strong>S${s.sessionNum}</strong> ${live}</td>
        <td>${s.firstDate}${s.lastDate !== s.firstDate ? ` – ${s.lastDate}` : ''}</td>
        <td>${s.games}</td>
        <td>${s.wins}W / ${s.losses}L</td>
        <td class="${wrClass}">${s.winRate}%</td>
        <td class="${mmrClass}">${s.mmrGain >= 0 ? '+' : ''}${s.mmrGain}</td>
        <td>${s.endMMR || '—'}</td>
        <td>${topTag}</td>
        <td><button type="button" class="btn-link session-view-btn" data-session="${s.sessionNum}">View games →</button></td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="sessions-toolbar">
      <p class="page-desc">${sessions.length} session${sessions.length === 1 ? '' : 's'} · tap a row to filter match logs</p>
      <button type="button" class="btn btn-secondary btn-sm" id="sessions-export-btn">Export sessions CSV</button>
    </div>
    <div class="table-wrap">
      <table class="log-table sessions-table">
        <thead>
          <tr>
            <th>Session</th>
            <th>Dates</th>
            <th>Games</th>
            <th>Record</th>
            <th>WR</th>
            <th>MMR</th>
            <th>End</th>
            <th>Top tag</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  el.querySelector('#sessions-export-btn')?.addEventListener('click', () => {
    if (onExport) onExport(sessions);
    else exportSessionsCSV(sessions, displayName);
  });

  el.querySelectorAll('.session-view-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const sn = parseInt(btn.dataset.session, 10);
      if (sn && onViewSession) onViewSession(sn);
    });
  });

  el.querySelectorAll('.session-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.session-view-btn')) return;
      const sn = parseInt(row.dataset.session, 10);
      if (sn && onViewSession) onViewSession(sn);
    });
  });
}
