/** Session history page */

import { groupSessionsForHistory, formatDuration } from './utils.js';
import { exportSessionsCSV } from './export.js';
import { getLoggingSessionNum, getSessionHistoryMap } from './sessions.js';
import { state } from './state.js';
import { GAME_IDS, getGameMeta } from './games.js';

function sessionDurationLabel(sessionNum, activeNum, history) {
  if (activeNum === sessionNum && state.session.active && state.session.startTime) {
    return formatDuration(Date.now() - state.session.startTime);
  }
  const ms = history[String(sessionNum)]?.durationMs;
  return ms ? formatDuration(ms) : '—';
}

export function renderSessionsPage(games, displayName, { onViewSession, onExport } = {}) {
  const el = document.getElementById('sessions-content');
  if (!el) return;

  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const meta = getGameMeta(state.activeGame);
  const blockLabel = isVal ? 'Grind block' : 'Session';
  const matchLabel = isVal ? 'matches' : 'games';

  const sessions = groupSessionsForHistory(games);
  const activeNum = state.session.active ? getLoggingSessionNum() : null;
  const history = getSessionHistoryMap();

  if (!sessions.length) {
    el.innerHTML = `
      <div class="sessions-empty">
        <div class="sessions-empty-icon">${isVal ? '◆' : '📋'}</div>
        <p>No ${isVal ? 'grind blocks' : 'sessions'} yet</p>
        <span>Start a ${blockLabel.toLowerCase()} from the dock and log ${matchLabel} — they'll show up here.</span>
      </div>`;
    return;
  }

  const rows = sessions.map(s => {
    const wrClass = s.winRate >= 50 ? 'pos' : 'neg';
    const mmrClass = s.mmrGain >= 0 ? 'pos' : 'neg';
    const live = activeNum === s.sessionNum ? '<span class="session-live-pill">Live</span>' : '';
    const duration = sessionDurationLabel(s.sessionNum, activeNum, history);
    const topTag = s.topTag
      ? `<span class="session-tag-pill">${s.topTag[0]}</span>`
      : '<span class="session-tag-none">—</span>';
    return `
      <tr class="session-row" data-session="${s.sessionNum}">
        <td><strong>${isVal ? 'B' : 'S'}${s.sessionNum}</strong> ${live}</td>
        <td>${s.firstDate}${s.lastDate !== s.firstDate ? ` – ${s.lastDate}` : ''}</td>
        <td class="session-dur-col">${duration}</td>
        <td>${s.games}</td>
        <td>${s.wins}W / ${s.losses}L</td>
        <td class="${wrClass}">${s.winRate}%</td>
        <td class="${mmrClass}">${s.mmrGain >= 0 ? '+' : ''}${s.mmrGain}</td>
        <td>${s.endMMR || '—'}</td>
        <td>${topTag}</td>
        <td><button type="button" class="btn-link session-view-btn" data-session="${s.sessionNum}">View ${isVal ? 'matches' : 'games'} →</button></td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="sessions-toolbar">
      <p class="page-desc">${sessions.length} ${isVal ? 'block' : 'session'}${sessions.length === 1 ? '' : 's'} · duration saved when you tap ■ End</p>
      <button type="button" class="btn btn-secondary btn-sm" id="sessions-export-btn">Export ${isVal ? 'blocks' : 'sessions'} CSV</button>
    </div>
    <div class="table-wrap">
      <table class="log-table sessions-table">
        <thead>
          <tr>
            <th>${isVal ? 'Block' : 'Session'}</th>
            <th>Dates</th>
            <th>Duration</th>
            <th>${isVal ? 'Matches' : 'Games'}</th>
            <th>Record</th>
            <th>WR</th>
            <th>${meta.diffLabel}</th>
            <th>End</th>
            <th>Top tag</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  el.querySelector('#sessions-export-btn')?.addEventListener('click', () => {
    const enriched = sessions.map(s => ({
      ...s,
      durationMs: history[String(s.sessionNum)]?.durationMs ?? null,
      durationLabel: sessionDurationLabel(s.sessionNum, activeNum, history),
    }));
    if (onExport) onExport(enriched);
    else exportSessionsCSV(enriched, displayName, state.activeGame);
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
