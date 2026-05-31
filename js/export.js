/** CSV and print export for reports */

import { getPlayerMeta, APP_NAME } from './config.js';
import { getGameMeta, GAME_IDS } from './games.js';

function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(val) {
  const s = String(val ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportGamesCSV(games, playerName, gameId = GAME_IDS.ROCKET_LEAGUE) {
  const meta = getGameMeta(gameId);
  const isVal = gameId === GAME_IDS.VALORANT;
  const headers = isVal
    ? ['Match', 'Date', 'Block', 'Mode', 'Result', 'K', 'D', 'A', 'Agent', 'Map', `Start ${meta.rankLabel}`, `End ${meta.rankLabel}`, `${meta.diffLabel} Diff`, 'Tags', 'Notes']
    : ['Match', 'Date', 'Session', 'Mode', 'Result', 'Goals', 'Assists', 'Saves', 'Start MMR', 'End MMR', 'MMR Diff', 'Tags', 'Notes'];
  const rows = games.map(g => (isVal
    ? [g.match, g.date, g.session, g.mode, g.result, g.kills ?? g.goals, g.deaths, g.assists, g.agent ?? '', g.map ?? '', g.startMMR, g.endMMR, g.mmrDiff, (g.tags || []).join('; '), g.notes || '']
    : [g.match, g.date, g.session, g.mode, g.result, g.goals, g.assists, g.saves, g.startMMR, g.endMMR, g.mmrDiff, (g.tags || []).join('; '), g.notes || '']
  ).map(csvEscape).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  downloadBlob(`${playerName}-${isVal ? 'valorant' : 'games'}.csv`, csv, 'text/csv');
}

export function exportWeeklyReportCSV(report, playerName, gameId = GAME_IDS.ROCKET_LEAGUE) {
  const meta = getGameMeta(gameId);
  const isVal = gameId === GAME_IDS.VALORANT;
  const lines = [
    `${APP_NAME} — Weekly Report`,
    `Player,${csvEscape(playerName)}`,
    `Game,${isVal ? 'Valorant' : 'Rocket League'}`,
    `Week,${csvEscape(report.label)}`,
    '',
    'Metric,Value',
    `${isVal ? 'Matches' : 'Games'},${report.games}`,
    `Wins,${report.wins}`,
    `Losses,${report.losses}`,
    `Win Rate,${report.winRate}%`,
    `${meta.diffLabel} Change,${report.mmrGain >= 0 ? '+' : ''}${report.mmrGain}`,
    `Start ${meta.rankLabel},${report.startMMR ?? ''}`,
    `End ${meta.rankLabel},${report.endMMR ?? ''}`,
    `${isVal ? 'Blocks' : 'Sessions'},${report.sessions}`,
    `Top ${isVal ? 'Leak' : 'Mistake'},${report.topMistake ? `${report.topMistake[0]} (${report.topMistake[1]}x)` : 'None'}`,
  ];
  if (report.vsLastWeek) {
    lines.push('', 'vs Last Week,,');
    lines.push(`${isVal ? 'Matches' : 'Games'},${report.vsLastWeek.games >= 0 ? '+' : ''}${report.vsLastWeek.games}`);
    lines.push(`Win Rate,${report.vsLastWeek.winRate >= 0 ? '+' : ''}${report.vsLastWeek.winRate}%`);
    lines.push(`${meta.diffLabel},${report.vsLastWeek.mmrGain >= 0 ? '+' : ''}${report.vsLastWeek.mmrGain}`);
  }
  downloadBlob(`${playerName}-week-${report.label.replace(/\s/g, '')}.csv`, lines.join('\n'), 'text/csv');
}

export function printWeeklyReport(report, playerName, coachLines = [], gameId = GAME_IDS.ROCKET_LEAGUE) {
  const meta = getGameMeta(gameId);
  const isVal = gameId === GAME_IDS.VALORANT;
  const win = window.open('', '_blank');
  if (!win) return false;

  const vsBlock = report.vsLastWeek ? `
    <h3>vs Last Week</h3>
    <ul>
      <li>${isVal ? 'Matches' : 'Games'}: ${report.vsLastWeek.games >= 0 ? '+' : ''}${report.vsLastWeek.games}</li>
      <li>Win Rate: ${report.vsLastWeek.winRate >= 0 ? '+' : ''}${report.vsLastWeek.winRate}%</li>
      <li>${meta.diffLabel}: ${report.vsLastWeek.mmrGain >= 0 ? '+' : ''}${report.vsLastWeek.mmrGain}</li>
    </ul>` : '';

  const coachBlock = coachLines.length
    ? `<h3>Coach Notes</h3><ul>${coachLines.map(l => `<li>${l.text}</li>`).join('')}</ul>` : '';

  win.document.write(`<!DOCTYPE html><html><head><title>${playerName} — Weekly Report</title>
    <style>
      body { font-family: Segoe UI, sans-serif; padding: 32px; color: #111; max-width: 640px; margin: 0 auto; }
      h1 { color: ${isVal ? '#ff4655' : '#e65c00'}; font-size: 22px; }
      h3 { margin-top: 24px; color: #333; }
      .meta { color: #666; margin-bottom: 24px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .stat { background: #f5f5f5; padding: 12px; border-radius: 8px; }
      .stat .lbl { font-size: 11px; color: #888; text-transform: uppercase; }
      .stat .val { font-size: 22px; font-weight: 700; }
    </style></head><body>
    <h1>${APP_NAME}${isVal ? ' · VAL' : ''}</h1>
    <div class="meta">${playerName} · ${report.label}</div>
    <div class="grid">
      <div class="stat"><div class="lbl">${isVal ? 'Matches' : 'Games'}</div><div class="val">${report.games}</div></div>
      <div class="stat"><div class="lbl">Win Rate</div><div class="val">${report.winRate}%</div></div>
      <div class="stat"><div class="lbl">W / L</div><div class="val">${report.wins} / ${report.losses}</div></div>
      <div class="stat"><div class="lbl">${meta.diffLabel} Change</div><div class="val">${report.mmrGain >= 0 ? '+' : ''}${report.mmrGain}</div></div>
    </div>
    ${report.topMistake ? `<h3>Top ${isVal ? 'Leak' : 'Mistake'}</h3><p>${report.topMistake[0]} (${report.topMistake[1]}×)</p>` : ''}
    ${vsBlock}${coachBlock}
    <p style="margin-top:32px;color:#aaa;font-size:11px">Generated by ${APP_NAME}</p>
    </body></html>`);
  win.document.close();
  win.focus();
  win.print();
  return true;
}

export function exportAllPlayersCSV(data) {
  Object.entries(data).forEach(([id, games]) => {
    if (games?.length) exportGamesCSV(games, getPlayerMeta(id).name);
  });
}

export function exportSessionsCSV(sessions, playerName, gameId = GAME_IDS.ROCKET_LEAGUE) {
  const isVal = gameId === GAME_IDS.VALORANT;
  const meta = getGameMeta(gameId);
  const headers = isVal
    ? ['Grind Block', 'First Date', 'Last Date', 'Duration', 'Matches', 'Wins', 'Losses', 'Win Rate', `${meta.rankLabel} Change`, `End ${meta.rankLabel}`, 'Top Tag']
    : ['Session', 'First Date', 'Last Date', 'Duration', 'Games', 'Wins', 'Losses', 'Win Rate', 'MMR Change', 'End MMR', 'Top Tag'];
  const suffix = isVal ? 'valorant-grind-blocks' : 'sessions';
  const rows = sessions.map(s => [
    s.sessionNum, s.firstDate, s.lastDate,
    s.durationLabel ?? (s.durationMs ? `${Math.round(s.durationMs / 60000)}m` : ''),
    s.games, s.wins, s.losses,
    `${s.winRate}%`, s.mmrGain, s.endMMR || '', s.topTag ? s.topTag[0] : '',
  ].map(csvEscape).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  downloadBlob(`${playerName}-${suffix}.csv`, csv, 'text/csv');
}
