/** Bridge auto-log handlers — RL Stats API + Valorant Henrik/Overwolf */

import { state, getActiveGames } from './state.js';
import { GAME_IDS } from './games.js';
import { getLastMMR } from './matches.js';
import { getActiveGameModule } from './games/router.js';
import { estimateMMRDelta } from './utils.js';
import { VAL_DEFAULT_RR_SWING } from './valorant-config.js';
import { getBridgeUrl } from './bridge-client.js';
import { getDockModePillsEl } from './dock-ui.js';
import {
  applyLiveStats, flashAutoLogged, setQuickResult, setQuickMode,
  getQuickMode, getQuickEndRankInput, getLastModeForGame,
} from './quicklog.js';
import { refreshLiveStatus } from './rl-live.js';
import { refreshValorantStatus } from './valorant-live.js';
import { startSession } from './sessions.js';
import { showToast } from './ui.js';

let ctx = { submitGameLog: async () => false };

export function wireAutoLogHandlers(next) {
  ctx = next;
}

function estimateMMRDeltaForMode(result, mode) {
  return estimateMMRDelta(getActiveGames(), result, mode);
}

function getQuickModeFromDock() {
  return getDockModePillsEl()?.querySelector('.active')?.dataset.mode
    ?? getLastModeForGame(state.activeGame);
}

function recentGamesHaveMMR() {
  const mod = getActiveGameModule();
  return getActiveGames().slice(-3).some(g => mod.getRankValue(g));
}

export async function handleValorantAutoLog(match) {
  if (state.activeGame !== GAME_IDS.VALORANT) return false;

  if (match.matchId && getActiveGames().some(g =>
    (g.game ?? GAME_IDS.ROCKET_LEAGUE) === GAME_IDS.VALORANT
    && (g.notes ?? '').includes(`id:${match.matchId}`))) {
    try {
      await fetch(`${getBridgeUrl()}/valorant/last-match/consume`, { method: 'POST' });
    } catch { /* optional */ }
    return true;
  }

  const activity = Number(match.kills ?? 0) + Number(match.deaths ?? 0) + Number(match.valAssists ?? 0);
  if (activity === 0) {
    try {
      await fetch(`${getBridgeUrl()}/valorant/last-match/consume`, { method: 'POST' });
    } catch { /* optional */ }
    showToast('Match stats not ready yet — wait ~30s after the scoreboard or log manually', 'error');
    return false;
  }

  const logMode = match.mode || getQuickMode() || 'Competitive';
  if (match.mode) setQuickMode(match.mode);
  if (match.result) setQuickResult(match.result);
  applyLiveStats({
    goals: match.kills,
    assists: match.deaths,
    saves: match.acs,
    kills: match.kills,
    deaths: match.deaths,
    valAssists: match.valAssists,
    acs: match.acs,
    result: match.result,
    mode: match.mode,
    agent: match.agent,
    map: match.map,
  });

  const priorEnd = getLastMMR(logMode);
  let startRR;
  let endRR;

  if (match.endRR != null && match.rrChange != null) {
    endRR = parseInt(match.endRR, 10);
    startRR = Math.max(0, endRR - parseInt(match.rrChange, 10));
  } else if (match.rrChange != null && priorEnd !== '') {
    startRR = parseInt(priorEnd, 10);
    endRR = Math.max(0, Math.min(100, startRR + parseInt(match.rrChange, 10)));
  } else {
    const delta = match.result === 'W' ? VAL_DEFAULT_RR_SWING.W : VAL_DEFAULT_RR_SWING.L;
    if (priorEnd !== '') {
      startRR = parseInt(priorEnd, 10);
      endRR = Math.max(0, Math.min(100, startRR + delta));
    } else {
      startRR = 0;
      endRR = Math.abs(delta);
      showToast(`First ${logMode} log — confirm your real RR after the match`, 'error');
    }
  }

  document.getElementById('quick-endrr').value = endRR;
  const fStart = document.getElementById('f-startmmr');
  if (fStart) fStart.value = priorEnd !== '' ? startRR : '';

  state.ui.autoLogNote = [
    match.matchId ? `id:${match.matchId}` : '',
    priorEnd === '' ? 'RR estimated' : '',
    match.agent ? match.agent : '',
    match.map ? match.map : '',
  ].filter(Boolean).join(' · ');

  if (!state.session.active) startSession();

  const ok = await ctx.submitGameLog('auto');
  if (!ok) return false;
  flashAutoLogged();
  refreshValorantStatus();
  return true;
}

export async function handleAutoLog(match) {
  if (state.activeGame !== GAME_IDS.ROCKET_LEAGUE) return false;
  const logMode = match.mode || getQuickModeFromDock() || "2's";
  if (match.mode) setQuickMode(match.mode);
  if (match.result) setQuickResult(match.result);
  applyLiveStats(match);

  const priorEnd = getLastMMR(logMode);
  const delta = estimateMMRDeltaForMode(match.result, logMode);
  let startMMR;
  let endMMR;

  if (priorEnd !== '') {
    startMMR = parseInt(priorEnd, 10);
    endMMR = Math.max(0, startMMR + delta);
  } else {
    startMMR = 0;
    endMMR = delta;
    showToast(`First ${logMode} log — confirm your real MMR after the match`, 'error');
  }

  if (Number.isNaN(startMMR) || Number.isNaN(endMMR)) {
    showToast('Confirm MMR from the ranked screen after this match', 'error');
    getQuickEndRankInput()?.focus();
    return false;
  }

  const fStart = document.getElementById('f-startmmr');
  const qEnd = getQuickEndRankInput();
  if (fStart) fStart.value = priorEnd !== '' ? startMMR : '';
  if (qEnd) qEnd.value = endMMR;

  state.ui.autoLogNote = [
    !recentGamesHaveMMR() ? 'MMR estimated' : '',
    match.playlist ? (match.isRanked ? `Ranked · ${match.playlist}` : match.playlist) : '',
  ].filter(Boolean).join(' · ');

  const ok = await ctx.submitGameLog('auto');
  if (!ok) return false;

  flashAutoLogged();
  refreshLiveStatus();
  return true;
}
