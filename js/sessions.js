/** Session management — live grind panel, timer, session summaries */

import { state, notify, getUserDisplay, getActiveGames } from './state.js';
import { getSessionStats, formatDuration } from './utils.js';
import { getAuthUser } from './auth.js';
import { rankBadgeHTML } from './ranks.js';
import { showToast } from './ui.js';
import { getLastMMR, lastGameNeedsMmrConfirm } from './matches.js';
import { detectTilt } from './insights.js';
import { GAME_IDS, getGameMeta, getDefaultMode, getRankDiff, getRankValue } from './games.js';
import { getDockModePillsEl } from './dock-ui.js';
import { isAutoLogEnabled } from './auto-log-prefs.js';
import {
  getLoggingSessionNum, getMaxSessionNum, getNextSessionNum,
} from './core/logging-session.js';
import { isBridgeUp } from './bridge-client.js';
import { getCachedValorantStatus } from './bridge-ui.js';

export { getLoggingSessionNum, getMaxSessionNum, getNextSessionNum };

const STALE_SESSION_MS = 6 * 60 * 60 * 1000;

function sumSessionRankDiff(games) {
  const gameId = games[0]?.game ?? state.activeGame;
  return games.reduce((s, g) => s + (getRankDiff(g, gameId) || 0), 0);
}

function sessionCopy() {
  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const meta = getGameMeta(state.activeGame);
  return {
    isVal,
    blockLabel: isVal ? 'Grind Block' : 'Session',
    matchLabel: isVal ? 'matches' : 'games',
    matchSingular: isVal ? 'match' : 'game',
    rankLabel: meta.diffLabel,
  };
}

function getActiveLogMode() {
  const fromPill = getDockModePillsEl()?.querySelector('.active')?.dataset.mode;
  if (fromPill) return fromPill;
  const fromForm = document.getElementById('f-mode')?.value;
  if (fromForm) return fromForm;
  try {
    const prefs = JSON.parse(localStorage.getItem('rl-grind-prefs') ?? '{}');
    return prefs.lastModes?.[state.activeGame] ?? prefs.lastMode ?? getDefaultMode(state.activeGame);
  } catch {
    return getDefaultMode(state.activeGame);
  }
}

const SESSION_STORE = 'rl-grind-session';

function storageKey(gameId = state.activeGame) {
  const id = getAuthUser()?.id;
  return id ? `${SESSION_STORE}:${gameId}:${id}` : `${SESSION_STORE}:${gameId}`;
}

function loadStoredSession(gameId = state.activeGame) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(gameId)) ?? 'null');
  } catch {
    return null;
  }
}

function saveStoredSession(data, gameId = state.activeGame) {
  try {
    const prev = loadStoredSession(gameId);
    localStorage.setItem(storageKey(gameId), JSON.stringify({
      ...prev,
      ...data,
      history: data.history ?? prev?.history ?? {},
    }));
  } catch { /* quota / private mode */ }
}

export function getSessionHistoryMap() {
  return loadStoredSession()?.history ?? {};
}

export function getSessionDurationMs(sessionNum) {
  const entry = getSessionHistoryMap()[String(sessionNum)];
  return entry?.durationMs ?? null;
}

function clearSessionTimer() {
  if (state.session.timerId) {
    clearInterval(state.session.timerId);
    state.session.timerId = null;
  }
}

export { clearSessionTimer };

function syncSessionField(num) {
  const el = document.getElementById('f-session');
  if (el) el.value = num;
  const dock = document.getElementById('dock-session-num');
  if (dock) dock.value = num;
  state.session.sessionNum = num;
}

function inferOpenSession(games, stored) {
  const maxNum = getMaxSessionNum(games);
  if (!maxNum || !games.length) return null;
  const last = games[games.length - 1];
  if (parseInt(last.session, 10) !== maxNum) return null;
  const lastEnded = stored?.lastEndedSession ?? 0;
  if (maxNum > lastEnded) return maxNum;
  return null;
}

/** Next session # if user has logged games in an "open" block without ending it */
export function getSuggestedSessionNum(games = getActiveGames(), stored = loadStoredSession()) {
  return inferOpenSession(games, stored) ?? stored?.nextSessionNum ?? (getNextSessionNum(games) || 1);
}

function activateSession(sessionNum, { startTime = Date.now(), startMMR = null, silent = false } = {}) {
  clearSessionTimer();

  const activeGames = getActiveGames();
  const copy = sessionCopy();

  state.session = {
    ...state.session,
    active: true,
    startTime,
    startMMR: startMMR ?? (activeGames.length ? getRankValue(activeGames[activeGames.length - 1], state.activeGame) : null),
    sessionNum,
    timerId: setInterval(tickSessionTimer, 1000),
  };

  syncSessionField(sessionNum);
  const prev = loadStoredSession();
  saveStoredSession({
    active: true,
    sessionNum,
    startTime,
    startMMR: state.session.startMMR,
    lastEndedSession: prev?.lastEndedSession ?? 0,
    nextSessionNum: sessionNum,
    history: prev?.history ?? {},
  });

  notify();
  updateSessionBar();
  if (!silent) {
    document.dispatchEvent(new CustomEvent('rl-session-start'));
    showToast(copy.isVal ? 'Grind block started ◆' : 'Session started! 🚀');
  }
}

/** Restore session after page load — call once games are in state */
export function restoreSessionFromStorage(games = getActiveGames()) {
  clearSessionTimer();

  let stored = loadStoredSession();
  if (stored?.active && stored.startTime && (Date.now() - stored.startTime > STALE_SESSION_MS)) {
    saveStoredSession({
      active: false,
      sessionNum: stored.sessionNum,
      startTime: null,
      startMMR: null,
      nextSessionNum: stored.nextSessionNum ?? stored.sessionNum,
      lastEndedSession: stored.lastEndedSession ?? 0,
    });
    stored = loadStoredSession();
  }

  if (stored?.active && stored.startTime && stored.sessionNum) {
    activateSession(stored.sessionNum, {
      startTime: stored.startTime,
      startMMR: stored.startMMR ?? null,
      silent: true,
    });
    return;
  }

  const openNum = inferOpenSession(games, stored);
  const nextNum = openNum ?? stored?.nextSessionNum ?? (getNextSessionNum(games) || 1);
  state.session.active = false;
  state.session.startTime = null;
  state.session.sessionNum = nextNum;
  syncSessionField(nextNum);
  updateSessionBar();
}

/** Reset the session counter (e.g. back to 1 when testing) */
export function resetSessionCounter(num = 1) {
  clearSessionTimer();

  const prev = loadStoredSession();
  const maxLogged = getMaxSessionNum(getActiveGames());
  const copy = sessionCopy();

  state.session.active = false;
  state.session.startTime = null;
  state.session.startMMR = null;
  state.session.sessionNum = num;
  syncSessionField(num);

  saveStoredSession({
    active: false,
    sessionNum: num,
    startTime: null,
    startMMR: null,
    nextSessionNum: num,
    lastEndedSession: maxLogged,
    history: prev?.history ?? {},
  });

  notify();
  updateSessionBar();
  showToast(`Next ${copy.blockLabel.toLowerCase()} set to ${num}${state.session.active ? ' — live session ended' : ''}`);
}

export function initSessionUI() {
  if (!initSessionUI.wired) {
    initSessionUI.wired = true;
    document.getElementById('session-num-apply')?.addEventListener('click', () => {
      const num = parseInt(document.getElementById('dock-session-num')?.value, 10);
      if (!num || num < 1) {
        showToast('Enter a valid session number', 'error');
        return;
      }
      resetSessionCounter(num);
    });
    document.getElementById('dock-session-num')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('session-num-apply')?.click();
    });
  }
  updateSessionBar();
}

export function startSession({ silent = false, sessionNum } = {}) {
  const num = sessionNum
    ?? parseInt(document.getElementById('dock-session-num')?.value, 10)
    ?? parseInt(document.getElementById('f-session')?.value, 10)
    ?? getNextSessionNum(getActiveGames())
    ?? 1;
  activateSession(num, { silent });
}

export function endSession(onComplete) {
  const copy = sessionCopy();
  const sessionNum = state.session.sessionNum || getLoggingSessionNum();
  const sg = getActiveGames().filter(g => parseInt(g.session, 10) === sessionNum);

  if (!sg.length) {
    showToast(`No ${copy.matchLabel} in this ${copy.blockLabel.toLowerCase()} yet`, 'error');
    return;
  }

  const elapsed = state.session.active && state.session.startTime
    ? Date.now() - state.session.startTime : 0;

  const wins = sg.filter(g => g.result === 'W').length;
  const losses = sg.filter(g => g.result === 'L').length;
  const mmrGain = sumSessionRankDiff(sg);
  const wr = sg.length ? Math.round(wins / sg.length * 100) : 0;

  if (state.session.timerId) {
    clearInterval(state.session.timerId);
    state.session.timerId = null;
  }

  const nextSession = sessionNum + 1;
  state.session.active = false;
  state.session.startTime = null;
  state.session.sessionNum = nextSession;
  syncSessionField(nextSession);

  const prev = loadStoredSession();
  const history = { ...(prev?.history ?? {}) };
  history[String(sessionNum)] = {
    durationMs: elapsed,
    endedAt: Date.now(),
    games: sg.length,
    wins,
    losses,
    mmrGain,
    winRate: wr,
  };

  saveStoredSession({
    active: false,
    lastEndedSession: sessionNum,
    nextSessionNum: nextSession,
    history,
  });

  notify();
  updateSessionBar();
  showSessionModal(sessionNum, sg, elapsed);

  if (onComplete) onComplete(nextSession);
}

export function closeSessionModal() {
  document.getElementById('session-modal')?.classList.remove('open');
  const last = getLastMMR(getActiveLogMode());
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
  const sessionNum = getLoggingSessionNum();
  const sessionGames = getActiveGames().filter(g => parseInt(g.session, 10) === sessionNum);
  return { ...getSessionStats(sessionGames), sessionNum, sessionGames };
}

function renderTiltNudge(sessionGames) {
  const tilt = detectTilt(sessionGames, 6);
  if (!tilt.active || tilt.lossStreak < 3) return '';
  return `
    <div class="session-tilt-nudge" role="status">
      💀 ${tilt.lossStreak} losses in a row — take 5 min, review tags, then queue again.
    </div>`;
}

function renderRankConfirmBadge() {
  if (!lastGameNeedsMmrConfirm(getActiveGames())) return '';
  const label = getGameMeta(state.activeGame).rankLabel;
  return `<span class="session-mmr-badge" title="Last ${label} not confirmed">${label}?</span>`;
}

export function updateSessionBar() {
  const bar = document.getElementById('session-bar');
  const dot = document.getElementById('session-live-dot');
  const title = document.getElementById('session-bar-title');
  const stats = document.getElementById('session-live-stats');
  const startBtn = document.getElementById('session-start-btn');
  const numLabel = document.querySelector('.session-num-label');
  const copy = sessionCopy();
  if (!bar) return;

  if (numLabel) numLabel.textContent = `${copy.blockLabel} #`;

  if (!state.session.active) {
    bar.classList.remove('active');
    dot?.classList.remove('active');
    document.querySelector('.quick-dock-inner')?.classList.remove('session-live');
    const next = getLoggingSessionNum();
    if (title) {
      title.textContent = `Ready — ${copy.blockLabel} ${next}`;
      title.classList.remove('active');
    }
    document.getElementById('session-num-setter')?.classList.remove('hidden');
    const dockInput = document.getElementById('dock-session-num');
    if (dockInput && document.activeElement !== dockInput) dockInput.value = next;
    if (stats) {
      if (copy.isVal && isAutoLogEnabled()) {
        if (!isBridgeUp()) {
          stats.innerHTML = '<span class="slive-item neutral">Bridge disconnected — keep start-grind.bat open, then Ctrl+F5</span>';
        } else {
        const vs = getCachedValorantStatus();
        if (vs?.configured && vs?.seeded) {
          stats.innerHTML = '<span class="slive-item neutral">Auto-log ON — saves when the match ends</span>';
        } else if (vs?.configured && !vs?.seeded && vs?.source !== 'overwolf') {
          stats.innerHTML = '<span class="slive-item neutral">Play one full match to finish setup, then auto-log works</span>';
        } else if (vs?.configured) {
          stats.innerHTML = '<span class="slive-item neutral">Open Valorant — bridge is ready</span>';
        } else {
          stats.innerHTML = '<span class="slive-item neutral">Finish Auto-Log Setup (Riot ID + Henrik key)</span>';
        }
        }
      } else {
        stats.innerHTML = '<span class="slive-item neutral">Tap ▶ Start when ready</span>';
      }
    }
    if (startBtn) {
      startBtn.className = 'session-btn start';
      startBtn.textContent = copy.isVal ? '▶ Start Block' : '▶ Start';
      startBtn.onclick = () => startSession();
    }
    return;
  }

  const live = getLiveSessionStats();
  const elapsed = Date.now() - state.session.startTime;

  bar.classList.add('active');
  dot?.classList.add('active');
  document.querySelector('.quick-dock-inner')?.classList.add('session-live');
  title?.classList.add('active');
  if (title) title.textContent = `${copy.blockLabel} ${live.sessionNum} — Live`;
  if (stats) {
    const wlClass = live.wins > live.losses ? 'pos' : live.losses > live.wins ? 'neg' : 'neutral';
    stats.innerHTML = `
      ${renderTiltNudge(live.sessionGames)}
      <div class="session-live-metrics">
        <span class="slive-item time">⏱ <span class="slv" id="session-timer">${formatDuration(elapsed)}</span></span>
        <span class="slive-item neutral">${copy.isVal ? '◆' : '🎮'} <span class="slv">${live.games} ${copy.matchLabel}</span></span>
        <span class="slive-item ${wlClass}">W/L: <span class="slv">${live.wins}/${live.losses}</span></span>
        <span class="slive-item ${live.mmrGain >= 0 ? 'pos' : 'neg'}">${copy.rankLabel}: <span class="slv">${live.mmrGain >= 0 ? '+' : ''}${live.mmrGain}</span></span>
        ${renderRankConfirmBadge()}
      </div>`;
  }
  if (startBtn) {
    startBtn.className = 'session-btn end';
    startBtn.textContent = '■ End';
    startBtn.onclick = () => endSession();
  }
}

function showSessionModal(sessionNum, sg, elapsed) {
  const copy = sessionCopy();
  const wins = sg.filter(g => g.result === 'W').length;
  const losses = sg.filter(g => g.result === 'L').length;
  const mmrGain = sumSessionRankDiff(sg);
  const wr = sg.length ? Math.round(wins / sg.length * 100) : 0;
  const tagCount = {};
  sg.forEach(g => (g.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
  const topTag = Object.entries(tagCount).sort((a, b) => b[1] - a[1])[0];
  const endRank = getRankValue(sg[sg.length - 1], state.activeGame);

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
  document.getElementById('modal-title').textContent = `${copy.blockLabel} ${sessionNum} Complete`;
  document.getElementById('modal-sub').textContent = `${display.name} · ${sg[0].date}${elapsed ? ` · ${formatDuration(elapsed)}` : ''}`;
  document.getElementById('modal-stats').innerHTML = `
    <div class="modal-stat"><div class="val" style="color:#00e5ff">${sg.length}</div><div class="lbl">${copy.isVal ? 'Matches' : 'Games'}</div></div>
    <div class="modal-stat"><div class="val" style="color:${wr >= 50 ? '#00c851' : '#ff4444'}">${wr}%</div><div class="lbl">Win Rate</div></div>
    <div class="modal-stat"><div class="val" style="color:${mmrGain >= 0 ? '#00c851' : '#ff4444'}">${mmrGain >= 0 ? '+' : ''}${mmrGain}</div><div class="lbl">${copy.rankLabel} Change</div></div>
    <div class="modal-stat"><div class="val" style="color:#ffd700">${endRank}</div><div class="lbl">End ${copy.rankLabel}</div></div>
    <div class="modal-stat"><div class="val" style="color:#e65c00">${bestStreak}</div><div class="lbl">Best Win Streak</div></div>
    <div class="modal-stat"><div class="val" style="color:#a855f7">${elapsed ? formatDuration(elapsed) : '—'}</div><div class="lbl">Duration</div></div>
    ${!copy.isVal ? `<div class="modal-stat" style="grid-column:1/-1">${rankBadgeHTML(endRank, 22, sg[0].mode)}</div>` : ''}`;

  document.getElementById('modal-games-row').innerHTML = sg.length
    ? `<span class="modal-games-label">${copy.isVal ? 'Block flow' : 'Session flow'}</span><div class="modal-games-pips">${sg.map(g => {
        const diff = getRankDiff(g, state.activeGame);
        return `<span class="modal-game-pip ${g.result === 'W' ? 'win' : 'loss'}" title="Match ${g.match}: ${g.result} · ${diff >= 0 ? '+' : ''}${diff} ${copy.rankLabel}">${g.result}</span>`;
      }).join('')}</div>`
    : '';

  const coachNotes = [];
  if (lossStreak >= 3) {
    coachNotes.push(`<div class="modal-coach-warn">💀 ${lossStreak} losses in a row — take a short break or review your tags before queueing again.</div>`);
  }
  if (wr < 40 && sg.length >= 5) {
    coachNotes.push(`<div class="modal-coach-tip">Win rate ${wr}% this ${copy.blockLabel.toLowerCase()} — check Match History for recurring mistake tags.</div>`);
  }
  if (mmrGain < 0 && sg.length >= 3) {
    coachNotes.push(`<div class="modal-coach-tip">Down ${Math.abs(mmrGain)} ${copy.rankLabel} — one focused block beats a tilt queue.</div>`);
  }
  if (bestStreak >= 3) {
    coachNotes.push(`<div class="modal-coach-good">🔥 ${bestStreak}-${copy.matchSingular} win streak — ride the momentum, don't force extra ${copy.matchLabel}.</div>`);
  }
  document.getElementById('modal-coach').innerHTML = coachNotes.join('');

  document.getElementById('modal-top-tag').innerHTML = topTag
    ? `🏷️ Top leak this ${copy.blockLabel.toLowerCase()}: <span>${topTag[0]}</span> <span style="color:#555">(${topTag[1]}x)</span>`
    : `<span style="color:#555">No mistakes tagged this ${copy.blockLabel.toLowerCase()} 🎉</span>`;
  document.getElementById('session-modal').classList.add('open');
}

export function refreshSessionUI() {
  updateSessionBar();
  document.dispatchEvent(new CustomEvent('rl-session-ui-refresh'));
}
