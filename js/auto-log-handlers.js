/** Bridge auto-log handlers — RL Stats API + Valorant Henrik/Overwolf */

import { state, getActiveGames } from './state.js';
import { GAME_IDS } from './games.js';
import { getLastMMR } from './matches.js';
import { getActiveGameModule } from './games/router.js';
import { estimateMMRDelta } from './utils.js';
import { VAL_DEFAULT_RR_SWING } from './valorant-config.js';
import { applyRRDelta, normalizeRankName } from './games/valorant/rank-ladder.js';
import { getStoredValorantBaseline } from './rank-baseline-store.js';
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

function resolveValorantPriorState(mode) {
  const games = getActiveGames();
  const mod = getActiveGameModule();
  const prior = mod.getPriorEndRankState?.(games, mode);
  if (prior) {
    return { rank: prior.rank, rr: prior.rr, hasPrior: true };
  }
  const baseline = getStoredValorantBaseline(GAME_IDS.VALORANT, mode);
  if (baseline) {
    return { rank: baseline.rank, rr: baseline.rr, hasPrior: true };
  }
  const legacyRR = getLastMMR(mode);
  if (legacyRR !== '') {
    return { rank: 'Iron 1', rr: parseInt(legacyRR, 10) || 0, hasPrior: true };
  }
  return { rank: 'Iron 1', rr: 0, hasPrior: false };
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

  const priorState = resolveValorantPriorState(logMode);
  let startRank = priorState.rank;
  let startRR = priorState.rr;
  let endRank;
  let endRR;
  let rrDiff;

  if (match.endRR != null && match.rrChange != null) {
    endRR = parseInt(match.endRR, 10);
    rrDiff = parseInt(match.rrChange, 10);
    endRank = normalizeRankName(match.endRank);
    if (endRank) {
      const startApplied = applyRRDelta(endRank, endRR, -rrDiff);
      startRank = startApplied.rank;
      startRR = startApplied.rr;
    } else {
      const applied = applyRRDelta(startRank, startRR, rrDiff);
      endRank = applied.rank;
      endRR = applied.rr;
    }
  } else if (match.rrChange != null && priorState.hasPrior) {
    rrDiff = parseInt(match.rrChange, 10);
    const applied = applyRRDelta(startRank, startRR, rrDiff);
    endRank = applied.rank;
    endRR = applied.rr;
  } else {
    rrDiff = match.result === 'W' ? VAL_DEFAULT_RR_SWING.W : VAL_DEFAULT_RR_SWING.L;
    if (priorState.hasPrior) {
      const applied = applyRRDelta(startRank, startRR, rrDiff);
      endRank = applied.rank;
      endRR = applied.rr;
    } else {
      startRank = 'Iron 1';
      startRR = 0;
      endRank = 'Iron 1';
      endRR = Math.abs(rrDiff);
      showToast(`First ${logMode} log — confirm your real RR after the match`, 'error');
    }
  }

  if (!endRank) {
    const applied = applyRRDelta(startRank, startRR, rrDiff);
    endRank = applied.rank;
    endRR = applied.rr;
  }

  state.ui.valAutoRank = { startRank, startRR, endRank, endRR, rrDiff };

  document.getElementById('quick-endrr').value = endRR;
  const qRank = document.getElementById('quick-endrank');
  if (qRank && endRank) qRank.value = endRank;
  const fStart = document.getElementById('f-startmmr');
  const fEndRank = document.getElementById('f-endrank');
  const fStartRank = document.getElementById('f-startrank');
  if (fStart) fStart.value = priorState.hasPrior ? startRR : '';
  if (fEndRank && endRank) fEndRank.value = endRank;
  if (fStartRank && priorState.hasPrior) fStartRank.value = startRank;

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
