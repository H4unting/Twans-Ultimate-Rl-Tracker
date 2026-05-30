/** Session management — live grind panel, timer, session summaries */

import { state, notify, getUserDisplay } from './state.js';
import { getSessionStats, formatDuration } from './utils.js';
import { getAuthUser } from './auth.js';
import { rankBadgeHTML } from './ranks.js';
import { showToast } from './ui.js';
import { getLastMMR } from './matches.js';

export function initSessionUI() {
  updateSessionBar();
  updateLivePanel();
}

export function startSession() {
  const games = state.games;
  state.session = {
    ...state.session,
    active: true,
    startTime: Date.now(),
    startMMR: games.length ? games[games.length - 1].endMMR : null,
    sessionNum: parseInt(document.getElementById('f-session')?.value, 10) || 1,
  };
  if (state.session.timerId) clearInterval(state.session.timerId);
  state.session.timerId = setInterval(tickSessionTimer, 1000);
  notify();
  updateSessionBar();
  updateLivePanel();
  showToast('Session started! 🚀');
}

export function endSession(onComplete) {
  const sessionNum = state.session.sessionNum || parseInt(document.getElementById('f-session')?.value, 10) || 1;
  const sg = state.games.filter(g => g.session === sessionNum);

  if (!sg.length) {
    showToast('No games in this session yet', 'error');
    return;
  }

  const elapsed = state.session.active && state.session.startTime
    ? Date.now() - state.session.startTime : 0;

  if (state.session.timerId) {
    clearInterval(state.session.timerId);
    state.session.timerId = null;
  }

  state.session.active = false;
  notify();
  updateSessionBar();
  updateLivePanel();
  showSessionModal(sessionNum, sg, elapsed);

  const nextSession = sessionNum + 1;
  const fSession = document.getElementById('f-session');
  if (fSession) fSession.value = nextSession;
  if (onComplete) onComplete(nextSession);
}

export function closeSessionModal() {
  document.getElementById('session-modal')?.classList.remove('open');
  const last = getLastMMR();
  if (last !== '') {
    const el = document.getElementById('f-startmmr');
    if (el) el.value = last;
  }
}

export function closeSessionModalAndContinue() {
  closeSessionModal();
  startSession();
}

function tickSessionTimer() {
  const elapsed = Date.now() - state.session.startTime;
  const text = formatDuration(elapsed);
  const el = document.getElementById('session-timer');
  const panelTimer = document.getElementById('live-panel-timer');
  if (el) el.textContent = text;
  if (panelTimer) panelTimer.textContent = text;
}

function getLiveSessionStats() {
  const sessionNum = state.session.sessionNum || parseInt(document.getElementById('f-session')?.value, 10) || 1;
  const sessionGames = state.games.filter(g => g.session === sessionNum);
  return { ...getSessionStats(sessionGames), sessionNum };
}

export function updateSessionBar() {
  const bar = document.getElementById('session-bar');
  const dot = document.getElementById('session-live-dot');
  const title = document.getElementById('session-bar-title');
  const stats = document.getElementById('session-live-stats');
  const startBtn = document.getElementById('session-start-btn');
  if (!bar) return;

  if (!state.session.active) {
    bar.classList.remove('active');
    dot?.classList.remove('active');
    document.querySelector('.quick-dock-inner')?.classList.remove('session-live');
    if (title) { title.textContent = 'No active session'; title.classList.remove('active'); }
    if (stats) stats.innerHTML = '';
    if (startBtn) {
      startBtn.className = 'session-btn start';
      startBtn.textContent = '▶ Start';
      startBtn.onclick = startSession;
    }
    return;
  }

  const live = getLiveSessionStats();
  const elapsed = Date.now() - state.session.startTime;

  bar.classList.add('active');
  dot?.classList.add('active');
  document.querySelector('.quick-dock-inner')?.classList.add('session-live');
  title?.classList.add('active');
  if (title) title.textContent = `Session ${live.sessionNum} — Live`;
  if (stats) {
    const wlClass = live.wins > live.losses ? 'pos' : live.losses > live.wins ? 'neg' : 'neutral';
    stats.innerHTML = `
      <span class="slive-item time">⏱ <span class="slv" id="session-timer">${formatDuration(elapsed)}</span></span>
      <span class="slive-item neutral">🎮 <span class="slv">${live.games} games</span></span>
      <span class="slive-item ${wlClass}">W/L: <span class="slv">${live.wins}/${live.losses}</span></span>
      <span class="slive-item ${live.mmrGain >= 0 ? 'pos' : 'neg'}">MMR: <span class="slv">${live.mmrGain >= 0 ? '+' : ''}${live.mmrGain}</span></span>`;
  }
  if (startBtn) {
    startBtn.className = 'session-btn end';
    startBtn.textContent = '■ End';
    startBtn.onclick = () => endSession();
  }
}

export function updateLivePanel() {
  const panel = document.getElementById('live-session-panel');
  if (!panel) return;

  if (!state.session.active) {
    panel.classList.remove('visible');
    return;
  }

  const live = getLiveSessionStats();
  const display = getUserDisplay(getAuthUser());
  const streak = live.streak;
  const elapsed = Date.now() - (state.session.startTime || Date.now());

  panel.classList.add('visible');
  panel.innerHTML = `
    <div class="live-panel-pulse"></div>
    <div class="live-panel-body">
      <div class="live-panel-header">
        <span class="live-panel-title">🔴 LIVE · Session ${live.sessionNum}</span>
        <span class="live-panel-player" style="color:${display.color}">${display.name}</span>
      </div>
      <div class="live-panel-stats">
        <div class="live-stat"><span class="live-stat-val" id="live-panel-timer">${formatDuration(elapsed)}</span><span class="live-stat-lbl">Time</span></div>
        <div class="live-stat"><span class="live-stat-val">${live.wins}W ${live.losses}L</span><span class="live-stat-lbl">Record</span></div>
        <div class="live-stat"><span class="live-stat-val ${live.mmrGain >= 0 ? 'pos' : 'neg'}">${live.mmrGain >= 0 ? '+' : ''}${live.mmrGain}</span><span class="live-stat-lbl">MMR</span></div>
        <div class="live-stat"><span class="live-stat-val">${streak.type === 'W' ? '🔥' : streak.type === 'L' ? '💀' : '—'} ${streak.count || 0}</span><span class="live-stat-lbl">Streak</span></div>
      </div>
    </div>
    <button class="live-panel-end" onclick="window.__endSession()" title="End session">■</button>`;
}

function showSessionModal(sessionNum, sg, elapsed) {
  const wins = sg.filter(g => g.result === 'W').length;
  const losses = sg.filter(g => g.result === 'L').length;
  const mmrGain = sg.reduce((s, g) => s + (g.mmrDiff || 0), 0);
  const wr = sg.length ? Math.round(wins / sg.length * 100) : 0;
  const tagCount = {};
  sg.forEach(g => (g.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
  const topTag = Object.entries(tagCount).sort((a, b) => b[1] - a[1])[0];
  const endMMR = sg[sg.length - 1].endMMR;

  let bestStreak = 0, cur = 0, lastR = '';
  sg.forEach(g => {
    if (g.result === lastR) cur++;
    else { cur = 1; lastR = g.result; }
    if (g.result === 'W') bestStreak = Math.max(bestStreak, cur);
  });

  let lossStreak = 0;
  for (let i = sg.length - 1; i >= 0; i--) {
    if (sg[i].result === 'L') lossStreak++;
    else break;
  }

  const display = getUserDisplay(getAuthUser());
  document.getElementById('modal-title').textContent = `Session ${sessionNum} Complete`;
  document.getElementById('modal-sub').textContent = `${display.name} · ${sg[0].date}${elapsed ? ` · ${formatDuration(elapsed)}` : ''}`;
  document.getElementById('modal-stats').innerHTML = `
    <div class="modal-stat"><div class="val" style="color:#00e5ff">${sg.length}</div><div class="lbl">Games</div></div>
    <div class="modal-stat"><div class="val" style="color:${wr >= 50 ? '#00c851' : '#ff4444'}">${wr}%</div><div class="lbl">Win Rate</div></div>
    <div class="modal-stat"><div class="val" style="color:${mmrGain >= 0 ? '#00c851' : '#ff4444'}">${mmrGain >= 0 ? '+' : ''}${mmrGain}</div><div class="lbl">MMR Change</div></div>
    <div class="modal-stat"><div class="val" style="color:#ffd700">${endMMR}</div><div class="lbl">End MMR</div></div>
    <div class="modal-stat"><div class="val" style="color:#e65c00">${bestStreak}</div><div class="lbl">Best Win Streak</div></div>
    <div class="modal-stat"><div class="val" style="color:#a855f7">${elapsed ? formatDuration(elapsed) : '—'}</div><div class="lbl">Duration</div></div>
    <div class="modal-stat" style="grid-column:1/-1">${rankBadgeHTML(endMMR, 22, sg[0].mode)}</div>`;

  document.getElementById('modal-games-row').innerHTML = sg.length
    ? `<span class="modal-games-label">Session flow</span><div class="modal-games-pips">${sg.map(g =>
        `<span class="modal-game-pip ${g.result === 'W' ? 'win' : 'loss'}" title="Match ${g.match}: ${g.result} · ${g.mmrDiff >= 0 ? '+' : ''}${g.mmrDiff}">${g.result}</span>`
      ).join('')}</div>`
    : '';

  const coachNotes = [];
  if (lossStreak >= 3) {
    coachNotes.push(`<div class="modal-coach-warn">💀 ${lossStreak} losses in a row — take a short break or review your tags before queueing again.</div>`);
  }
  if (wr < 40 && sg.length >= 5) {
    coachNotes.push(`<div class="modal-coach-tip">Win rate ${wr}% this session — check Match Logs for recurring mistake tags.</div>`);
  }
  if (mmrGain < 0 && sg.length >= 3) {
    coachNotes.push(`<div class="modal-coach-tip">Down ${Math.abs(mmrGain)} MMR — one focused block beats a tilt queue.</div>`);
  }
  if (bestStreak >= 3) {
    coachNotes.push(`<div class="modal-coach-good">🔥 ${bestStreak}-game win streak — ride the momentum, don't force extra games.</div>`);
  }
  document.getElementById('modal-coach').innerHTML = coachNotes.join('');

  document.getElementById('modal-top-tag').innerHTML = topTag
    ? `🏷️ Top mistake this session: <span>${topTag[0]}</span> <span style="color:#555">(${topTag[1]}x)</span>`
    : `<span style="color:#555">No mistakes tagged this session 🎉</span>`;
  document.getElementById('session-modal').classList.add('open');
}

export function refreshSessionUI() {
  updateSessionBar();
  updateLivePanel();
}
