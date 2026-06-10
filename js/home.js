/** Home — v0 dashboard layout (hero, stats, session, activity) */

import {
  calcStats, getGamesInWeek, formatDuration, getPlaylistMMRRows,
  getMostRecentMode, getGamesForMode, calculateWinrate,
} from './utils.js';
import { getRank, rankBadgeHTML, RANK_DATA } from './ranks.js';
import { getTagLossCorrelations } from './insights.js';
import { getActionFocusTips, getGameMeta, GAME_IDS, getTagCat, getRankDiff, getQueueLabel } from './games.js';
import { formatRankDisplay } from './games/valorant/rank-ladder.js';
import { formatRRDelta } from './games/valorant/ranks.js';
import { state } from './state.js';
import { getGamesVersion } from './perf-cache.js';
import { launchGame } from './game-launcher.js';
import { shouldHideManualSessionControls } from './env.js';
import { getLoggingSessionNum } from './core/logging-session.js';
import { weekRankGain } from './goals.js';
import { rankIndex, RANK_LADDER } from './games/valorant/rank-ladder.js';

const DASH_PERF = typeof window !== 'undefined'
  && (window.__DASH_PERF || localStorage?.getItem('dash-perf') === '1');

let mmrRowsRenderKey = '';
let mmrRowsRenderCache = null;

function gamesTailKey(games) {
  if (!games?.length) return '0';
  const last = games[games.length - 1];
  return `${games.length}:${last?.match}:${last?.result}`;
}

function getCachedPlaylistMMRRows(games, gameId) {
  const key = `${getGamesVersion()}|${gameId}|${gamesTailKey(games)}`;
  if (mmrRowsRenderKey === key && mmrRowsRenderCache) return mmrRowsRenderCache;
  mmrRowsRenderCache = getPlaylistMMRRows(games, gameId);
  mmrRowsRenderKey = key;
  return mmrRowsRenderCache;
}

function avgField(games, field, fallbackField) {
  if (!games.length) return 0;
  return games.reduce((s, g) => s + (Number(g[field] ?? g[fallbackField]) || 0), 0) / games.length;
}

function ensureHomeChartMode(games) {
  if (state.activeGame === GAME_IDS.VALORANT) {
    state.homeChartMode = 'Competitive';
    return 'Competitive';
  }
  const rows = getCachedPlaylistMMRRows(games, state.activeGame);
  if (!rows.length) {
    state.homeChartMode = null;
    return null;
  }
  if (!state.homeChartMode || !rows.some(r => r.mode === state.homeChartMode)) {
    state.homeChartMode = getMostRecentMode(games);
  }
  return state.homeChartMode;
}

let homeLinksWired = false;

function wireHomeLinksOnce() {
  if (homeLinksWired) return;
  homeLinksWired = true;
  document.getElementById('page-dashboard')?.addEventListener('click', (e) => {
    const link = e.target.closest('[data-goto], .home-link[data-goto]');
    if (!link) return;
    e.preventDefault();
    const page = link.dataset.goto;
    const section = ['analytics', 'reports', 'focus'].includes(page) ? 'review' : 'home';
    window.__navigate?.(page, section);
  });
}

function wireHomeLinks(el) {
  wireHomeLinksOnce();
}

function wireQueuePicker(container, games) {
  container.querySelectorAll('[data-home-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.homeChartMode = btn.dataset.homeMode;
      window.__refreshHome?.();
    });
  });
}

function wireQuickActions(container) {
  container.querySelectorAll('[data-dash-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.dashAction;
      if (action === 'play') void launchGame(state.activeGame);
      else if (action === 'log') window.__navigate?.('log', 'home');
      else if (action === 'review') window.__navigate?.('focus', 'review');
      else if (action === 'session') {
        document.getElementById('session-start-btn')?.click();
      }
    });
  });
}

function rlModeKey(mode) {
  if (mode === "1's") return '1s';
  if (mode === "3's") return '3s';
  return '2s';
}

function getRankProgressInfo(activeRow, gameId, games) {
  const meta = getGameMeta(gameId);
  const mmr = activeRow?.mmr ?? 0;
  const mode = activeRow?.mode;

  if (gameId === GAME_IDS.VALORANT) {
    const modeGames = getGamesForMode(games, mode);
    const last = modeGames[modeGames.length - 1];
    const rank = last ? getRank({ endRank: last.endRank, endRR: last.endRR ?? mmr }) : getRank(mmr);
    const rr = rank.rr ?? mmr ?? 0;
    const pct = rank.isRadiant ? 100 : Math.max(4, Math.min(100, rr));
    const toNext = rank.isRadiant ? 0 : Math.max(0, 100 - rr);
    const idx = last?.endRank ? rankIndex(last.endRank) : -1;
    const next = idx >= 0 && idx < RANK_LADDER.length - 1
      ? RANK_LADDER[idx + 1]
      : 'Next tier';
    return {
      pct,
      current: rr,
      label: meta.rankLabel,
      toNext,
      currentRank: rank.name,
      nextRank: next,
    };
  }

  const table = RANK_DATA[rlModeKey(mode)] ?? RANK_DATA['2s'];
  const current = getRank(mmr, mode);
  let idx = table.findIndex(r => r.name === current.name);
  if (idx < 0) idx = 0;
  const next = table[idx + 1];
  const floor = table[idx]?.mmr ?? 0;
  const ceil = next?.mmr ?? floor + 100;
  const span = Math.max(ceil - floor, 1);
  const pct = Math.max(4, Math.min(100, ((mmr - floor) / span) * 100));
  const toNext = next ? Math.max(0, ceil - mmr) : 0;

  return {
    pct,
    current: mmr,
    label: meta.rankLabel,
    toNext,
    currentRank: current.name,
    nextRank: next?.name ?? 'Peak',
  };
}

function getLastGameForMode(games, mode) {
  const filtered = getGamesForMode(games, mode);
  return filtered[filtered.length - 1] ?? null;
}

function getSessionNetMmr(games) {
  const sessionNum = getLoggingSessionNum();
  const sg = games.filter(g => parseInt(g.session, 10) === sessionNum);
  return sg.reduce((sum, g) => sum + (g.mmrDiff || 0), 0);
}

function computeDashHeroData(games, rows, activeRow) {
  const meta = getGameMeta(state.activeGame);
  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const displayRows = isVal ? rows.filter(r => r.mode === 'Competitive') : rows;
  if (!displayRows.length) return null;

  const chartMode = ensureHomeChartMode(games);
  const row = activeRow ?? displayRows.find(r => r.mode === chartMode) ?? displayRows[0];
  const lastGame = getLastGameForMode(games, row.mode);
  const rank = isVal && lastGame
    ? getRank({ endRank: lastGame.endRank, endRR: lastGame.endRR ?? row.mmr })
    : getRank(row.mmr, row.mode);
  const stats = calcStats(games, state.activeGame);
  const wr = calculateWinrate(games);
  const diffLabel = meta.diffLabel;
  const weeklyGain = row.weekGain ?? 0;
  const streak = stats.streak?.type === 'W' ? stats.streak.count : 0;
  const weekGames = displayRows.reduce((sum, r) => sum + (r.weekGameCount || 0), 0);

  return {
    meta, isVal, displayRows, chartMode, row, lastGame, rank, stats, wr,
    diffLabel, weeklyGain, streak, weekGames,
    rankName: rank.name ?? 'Unranked',
    rankSub: isVal
      ? `${formatRankDisplay(rank.name, rank.rr)} · ${getQueueLabel(row.mode, state.activeGame)}`
      : `${row.mmr} ${meta.rankLabel} · ${row.mode}`,
    queueModesKey: displayRows.map(r => r.mode).join(','),
  };
}

function dashHeroSig(data) {
  if (!data) return 'empty';
  const { row, wr, streak, weekGames, weeklyGain, stats, rankName, chartMode, queueModesKey } = data;
  return [
    state.activeGame, chartMode, row.mode, row.mmr, rankName, wr, streak,
    weekGames, weeklyGain, stats.totalGames, queueModesKey,
    data.displayRows.map(r => `${r.mode}:${r.weekGain}`).join('|'),
  ].join(':');
}

function patchDashHeroQueueRow(el, displayRows, chartMode) {
  const row = el.querySelector('.dash-queue-row');
  if (!row) return false;
  const btns = row.querySelectorAll('[data-home-mode]');
  const btnModes = [...btns].map(b => b.dataset.homeMode);
  const modes = displayRows.map(r => r.mode);
  if (modes.join(',') !== btnModes.join(',') || btns.length !== modes.length) return false;
  btns.forEach(btn => {
    const r = displayRows.find(x => x.mode === btn.dataset.homeMode);
    if (!r) return;
    btn.classList.toggle('active', r.mode === chartMode);
    const wk = btn.querySelector('.dash-queue-week');
    if (wk) {
      const wkCls = r.weekGain >= 0 ? 'up' : 'down';
      wk.className = `dash-queue-week ${wkCls}`;
      wk.textContent = `${r.weekGain >= 0 ? '+' : ''}${r.weekGain} wk`;
    }
  });
  return true;
}

function patchDashHero(el, data) {
  const {
    isVal, row, lastGame, rank, wr, streak, weekGames, weeklyGain, meta, diffLabel,
    rankName, rankSub, chartMode, displayRows,
  } = data;

  const emblem = el.querySelector('.dash-hero-emblem');
  if (emblem) {
    emblem.innerHTML = rankBadgeHTML(
      isVal && lastGame ? { endRank: lastGame.endRank, endRR: lastGame.endRR ?? row.mmr } : row.mmr,
      isVal ? 56 : 48,
      row.mode,
      state.activeGame,
    );
  }
  const rankNameEl = el.querySelector('.dash-hero-rank-name');
  if (rankNameEl) rankNameEl.textContent = rankName;
  const rankSubEl = el.querySelector('.dash-hero-rank-sub');
  if (rankSubEl) rankSubEl.textContent = rankSub;
  const playlistEl = el.querySelector('.dash-hero-playlist');
  if (playlistEl) playlistEl.textContent = isVal ? getQueueLabel(row.mode, state.activeGame) : row.mode;

  const cards = el.querySelectorAll('.dash-hero-stats .dash-stat-card');
  if (cards[0]) {
    cards[0].querySelector('.dash-stat-value').textContent = row.mmr.toLocaleString();
    cards[0].querySelector('.dash-stat-hint').textContent =
      `${weeklyGain >= 0 ? '+' : ''}${weeklyGain} ${diffLabel} this week`;
  }
  if (cards[1]) {
    cards[1].querySelector('.dash-stat-value').innerHTML =
      `${wr}<span style="font-size:14px;color:var(--v0-muted-foreground)">%</span>`;
    cards[1].querySelector('.dash-stat-hint').textContent =
      `${data.stats.totalGames} ${isVal ? 'matches' : 'games'} logged`;
  }
  if (cards[2]) {
    cards[2].querySelector('.dash-stat-value').textContent = String(streak);
  }
  if (cards[3]) {
    cards[3].querySelector('.dash-stat-value').textContent = String(weekGames);
    cards[3].querySelector('.dash-stat-hint').textContent =
      `${weeklyGain >= 0 ? '+' : ''}${weeklyGain} ${diffLabel} net`;
  }

  if (!isVal) patchDashHeroQueueRow(el, displayRows, chartMode);
}

function renderDashHero(games, goals, rows, activeRow) {
  const el = document.getElementById('dash-hero');
  if (!el) return;

  const meta = getGameMeta(state.activeGame);
  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const gameLabel = meta.label;
  const displayRows = isVal ? rows.filter(r => r.mode === 'Competitive') : rows;

  if (el.dataset.heroGame !== state.activeGame) {
    el.dataset.wired = '';
    el.dataset.heroSig = '';
    el.dataset.heroGame = state.activeGame;
  }

  if (!displayRows.length) {
    el.dataset.wired = '';
    el.dataset.heroSig = 'empty';
    el.innerHTML = `
      <div class="dash-empty">Log a ${gameLabel} ${isVal ? 'match' : 'game'} to see your dashboard overview.</div>`;
    return;
  }

  const data = computeDashHeroData(games, rows, activeRow);
  const sig = dashHeroSig(data);
  if (el.dataset.wired === '1' && el.dataset.heroSig === sig) return;

  if (el.dataset.wired === '1') {
    if (!isVal && !patchDashHeroQueueRow(el, data.displayRows, data.chartMode)) {
      el.dataset.wired = '';
    } else {
      patchDashHero(el, data);
      el.dataset.heroSig = sig;
      return;
    }
  }

  const { chartMode, row, lastGame, rank, stats, wr, diffLabel, weeklyGain, streak, weekGames, rankName, rankSub } = data;

  const queueHTML = isVal
    ? `<span class="dash-queue-static">Competitive</span>`
    : displayRows.map(r => {
    const wkCls = r.weekGain >= 0 ? 'up' : 'down';
    const wk = `${r.weekGain >= 0 ? '+' : ''}${r.weekGain}`;
    return `
      <button type="button" class="dash-queue-btn${r.mode === chartMode ? ' active' : ''}" data-home-mode="${r.mode}">
        ${r.mode}
        <span class="dash-queue-week ${wkCls}">${wk} wk</span>
      </button>`;
  }).join('');

  el.innerHTML = `
    <div class="dash-hero-glow dash-hero-glow-a" aria-hidden="true"></div>
    <div class="dash-hero-glow dash-hero-glow-b" aria-hidden="true"></div>
    <div class="dash-hero-inner">
      <div>
        <div class="dash-hero-rank">
          <div class="dash-hero-emblem-wrap">
            <div class="dash-hero-emblem-glow" aria-hidden="true"></div>
            <div class="dash-hero-emblem">${rankBadgeHTML(
              isVal && lastGame ? { endRank: lastGame.endRank, endRR: lastGame.endRR ?? row.mmr } : row.mmr,
              isVal ? 56 : 48,
              row.mode,
              state.activeGame,
            )}</div>
          </div>
          <div>
            <div class="dash-hero-badges">
              <span class="dash-hero-game-pill">${gameLabel}</span>
              <span class="dash-hero-playlist">${isVal ? getQueueLabel(row.mode, state.activeGame) : row.mode}</span>
            </div>
            <h1 class="dash-hero-rank-name v0-heading">${rankName}</h1>
            <p class="dash-hero-rank-sub">${rankSub}</p>
          </div>
        </div>
        <div class="dash-queue-row">${queueHTML}</div>
      </div>
      <div class="dash-hero-stats">
        <div class="dash-stat-card">
          <div class="dash-stat-label">${meta.rankLabel}</div>
          <div class="dash-stat-value dash-stat-accent">${row.mmr.toLocaleString()}</div>
          <div class="dash-stat-hint">${weeklyGain >= 0 ? '+' : ''}${weeklyGain} ${diffLabel} this week</div>
        </div>
        <div class="dash-stat-card">
          <div class="dash-stat-label">Win Rate</div>
          <div class="dash-stat-value">${wr}<span style="font-size:14px;color:var(--v0-muted-foreground)">%</span></div>
          <div class="dash-stat-hint">${stats.totalGames} ${isVal ? 'matches' : 'games'} logged</div>
        </div>
        <div class="dash-stat-card">
          <div class="dash-stat-label">🔥 Win Streak</div>
          <div class="dash-stat-row">
            <span class="dash-stat-value dash-stat-warn">${streak}</span>
            <span class="dash-stat-muted">wins</span>
          </div>
        </div>
        <div class="dash-stat-card">
          <div class="dash-stat-label">This Week</div>
          <div class="dash-stat-row">
            <span class="dash-stat-value">${weekGames}</span>
            <span class="dash-stat-muted">${isVal ? 'matches' : 'games'}</span>
          </div>
          <div class="dash-stat-hint">${weeklyGain >= 0 ? '+' : ''}${weeklyGain} ${diffLabel} net</div>
        </div>
      </div>
    </div>`;

  el.dataset.wired = '1';
  el.dataset.heroSig = sig;
  wireQueuePicker(el, games);
}

function rankProgressSig(activeRow, goals, games) {
  if (!activeRow) return 'none';
  const progress = getRankProgressInfo(activeRow, state.activeGame, games);
  const target = goals?.mmrTarget || 0;
  return `${activeRow.mode}:${activeRow.mmr}:${progress.pct}:${progress.toNext}:${progress.currentRank}:${progress.nextRank}:${target}`;
}

function patchDashRankProgress(el, progress, goals) {
  const target = goals?.mmrTarget || 0;
  const fill = el.querySelector('.dash-rank-bar-fill');
  const marker = el.querySelector('.dash-rank-bar-marker');
  if (fill) fill.style.width = `${progress.pct}%`;
  if (marker) marker.style.left = `${progress.pct}%`;

  const nextEl = el.querySelector('.dash-rank-next');
  if (nextEl) {
    nextEl.innerHTML = progress.toNext > 0
      ? `<strong>+${progress.toNext}</strong> ${progress.label} to ${progress.nextRank}`
      : 'At peak tier';
  }

  const metaSpans = el.querySelectorAll('.dash-rank-meta span');
  if (metaSpans[0]) metaSpans[0].textContent = progress.currentRank;
  if (metaSpans[1]) metaSpans[1].textContent = progress.nextRank;

  let goalEl = el.querySelector('[data-rank-goal]');
  if (target > 0) {
    const diffLabel = getGameMeta(state.activeGame).diffLabel;
    const html = `Weekly goal: +${target} ${diffLabel}`;
    if (goalEl) goalEl.textContent = html;
    else {
      goalEl = document.createElement('p');
      goalEl.className = 'dash-stat-hint';
      goalEl.style.marginTop = '12px';
      goalEl.dataset.rankGoal = '1';
      goalEl.textContent = html;
      el.appendChild(goalEl);
    }
  } else if (goalEl) {
    goalEl.remove();
  }
}

function renderDashRankProgress(activeRow, goals, games) {
  const el = document.getElementById('dash-rank-progress');
  if (!el) return;

  if (!activeRow) {
    el.innerHTML = '';
    el.classList.add('hidden');
    el.dataset.wired = '';
    el.dataset.rankSig = '';
    return;
  }
  el.classList.remove('hidden');

  const progress = getRankProgressInfo(activeRow, state.activeGame, games);
  const sig = rankProgressSig(activeRow, goals, games);
  if (el.dataset.wired === '1' && el.dataset.rankSig === sig) return;

  if (el.dataset.wired === '1') {
    patchDashRankProgress(el, progress, goals);
    el.dataset.rankSig = sig;
    return;
  }

  const target = goals?.mmrTarget || 0;
  const goalNote = target > 0
    ? `<p class="dash-stat-hint" style="margin-top:12px" data-rank-goal="1">Weekly goal: +${target} ${getGameMeta(state.activeGame).diffLabel}</p>`
    : '';

  el.innerHTML = `
    <div class="dash-section-head dash-rank-head">
      <h2 class="dash-section-title"><span class="dash-section-icon">🎯</span> Rank Progress</h2>
      <div class="dash-rank-head-actions">
        <span class="dash-rank-next">
          ${progress.toNext > 0 ? `<strong>+${progress.toNext}</strong> ${progress.label} to ${progress.nextRank}` : 'At peak tier'}
        </span>
        <button type="button" class="section-link" data-goto="analytics">History →</button>
      </div>
    </div>
    <div class="dash-rank-bar-track">
      <div class="dash-rank-bar-fill" style="width:${progress.pct}%"></div>
      <div class="dash-rank-bar-marker" style="left:${progress.pct}%"></div>
    </div>
    <div class="dash-rank-meta">
      <span>${progress.currentRank}</span>
      <span>${progress.nextRank}</span>
    </div>
    ${goalNote}`;

  el.dataset.wired = '1';
  el.dataset.rankSig = sig;
  wireHomeLinks(el);
}

function renderDashQuickActions() {
  const el = document.getElementById('dash-quick-actions');
  if (!el) return;

  const hideManualSession = shouldHideManualSessionControls() && !state.session.active;
  const sessionLabel = state.session.active ? 'End Session' : 'Start Session';
  const sessionIcon = state.session.active ? '⏹' : '▶';
  const sessionDesc = hideManualSession
    ? ''
    : (state.session.active ? 'End early if needed' : 'Track your grind');
  const playLabel = state.activeGame === GAME_IDS.VALORANT ? 'Play Valorant' : 'Play Rocket League';

  const sessionBtn = el.querySelector('[data-dash-action="session"]');
  if (el.dataset.wired === '1' && sessionBtn && !hideManualSession) {
    sessionBtn.querySelector('.dash-action-icon').textContent = sessionIcon;
    sessionBtn.querySelector('.dash-action-label').textContent = sessionLabel;
    const desc = sessionBtn.querySelector('.dash-action-desc');
    if (desc) desc.textContent = sessionDesc;
    return;
  }

  el.dataset.wired = '1';
  el.innerHTML = `
    <button type="button" class="dash-action-btn primary" data-dash-action="play">
      <span class="dash-action-icon">🎮</span>
      <span><span class="dash-action-label">${playLabel}</span><span class="dash-action-desc">Launch &amp; track</span></span>
    </button>
    ${hideManualSession ? '' : `<button type="button" class="dash-action-btn" data-dash-action="session">
      <span class="dash-action-icon">${sessionIcon}</span>
      <span><span class="dash-action-label">${sessionLabel}</span><span class="dash-action-desc">${sessionDesc}</span></span>
    </button>`}
    <button type="button" class="dash-action-btn" data-dash-action="log">
      <span class="dash-action-icon">📋</span>
      <span><span class="dash-action-label">Log Match</span><span class="dash-action-desc">Add a result</span></span>
    </button>
    <button type="button" class="dash-action-btn" data-dash-action="review">
      <span class="dash-action-icon">🎯</span>
      <span><span class="dash-action-label">Focus</span><span class="dash-action-desc">Coaching tips</span></span>
    </button>`;

  wireQuickActions(el);
}

function perfStatsSig(games, isVal) {
  if (!games.length) return '0';
  const last = games[games.length - 1];
  return `${games.length}:${last?.match}:${isVal ? 'v' : 'r'}`;
}

function renderDashPerfStats(games) {
  const el = document.getElementById('dash-perf-stats');
  if (!el) return;

  if (!games.length) {
    el.innerHTML = '';
    el.dataset.perfSig = '';
    return;
  }

  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const sig = perfStatsSig(games, isVal);
  if (el.dataset.perfGame !== state.activeGame) {
    el.dataset.wired = '';
    el.dataset.perfGame = state.activeGame;
  }
  if (el.dataset.perfSig === sig) return;

  const kdaLabel = isVal ? 'K/D/A' : 'Avg Score';

  const avgG = avgField(games, 'goals');
  const avgA = avgField(games, 'assists');
  const avgS = avgField(games, 'saves');
  const avgD = avgField(games, 'deaths');
  const avgVA = avgField(games, 'valAssists', 'assists');

  const kdaVal = isVal
    ? (avgD > 0 ? (avgG / avgD).toFixed(2) : avgG.toFixed(1))
    : String(Math.round(games.reduce((s, g) => s + (Number(g.score) || 0), 0) / games.length || 0));

  const primary = isVal
    ? [
      { label: 'Kills', value: avgG.toFixed(1) },
      { label: 'Deaths', value: avgD.toFixed(1) },
      { label: 'Assists', value: avgVA.toFixed(1) },
    ]
    : [
      { label: 'Goals', value: avgG.toFixed(1) },
      { label: 'Assists', value: avgA.toFixed(1) },
      { label: 'Saves', value: avgS.toFixed(1) },
    ];

  if (el.dataset.wired === '1') {
    const featured = el.querySelector('.dash-perf-stat-featured');
    if (featured) {
      featured.querySelector('.dash-stat-label').textContent = kdaLabel;
      featured.querySelector('.dash-stat-value').textContent = kdaVal;
      featured.querySelector('.dash-stat-hint').textContent = `Per match avg · ${games.length} logged`;
    }
    el.querySelectorAll('.dash-perf-stat:not(.dash-perf-stat-featured)').forEach((node, i) => {
      if (!primary[i]) return;
      node.querySelector('.dash-stat-label').textContent = primary[i].label;
      node.querySelector('.dash-stat-value').textContent = primary[i].value;
    });
    el.dataset.perfSig = sig;
    return;
  }

  el.dataset.wired = '1';
  el.innerHTML = `
    <div class="dash-perf-stat dash-perf-stat-featured">
      <p class="dash-stat-label">${kdaLabel}</p>
      <p class="dash-stat-value">${kdaVal}</p>
      <p class="dash-stat-hint">Per match avg · ${games.length} logged</p>
    </div>
    ${primary.map(s => `
      <div class="dash-perf-stat">
        <p class="dash-stat-label">${s.label}</p>
        <p class="dash-stat-value" style="font-size:1.25rem">${s.value}</p>
      </div>`).join('')}`;
  el.dataset.perfSig = sig;
}

function sessionPanelSig(games, allRows) {
  if (state.session.active) {
    const sessionNum = getLoggingSessionNum();
    const sg = games.filter(g => parseInt(g.session, 10) === sessionNum);
    const wins = sg.filter(g => g.result === 'W').length;
    const losses = sg.filter(g => g.result === 'L').length;
    const net = getSessionNetMmr(games);
    return `live:${sessionNum}:${sg.length}:${wins}:${losses}:${net}`;
  }
  const weekRows = allRows.filter(r => r.weekGameCount > 0);
  if (weekRows.length) {
    return `week:${weekRows.map(r => `${r.mode}:${r.weekGain}`).join('|')}`;
  }
  if (!games.length) return 'empty';
  return `recent:${games[games.length - 1].date}`;
}

function patchLiveSessionPanel(el, games, diffLabel) {
  const sessionNum = getLoggingSessionNum();
  const sg = games.filter(g => parseInt(g.session, 10) === sessionNum);
  const wins = sg.filter(g => g.result === 'W').length;
  const losses = sg.filter(g => g.result === 'L').length;
  const net = getSessionNetMmr(games);

  const body = el.querySelector('.dash-session-body');
  if (body) {
    let strong = body.querySelector('strong');
    if (!strong) {
      body.textContent = '';
      strong = document.createElement('strong');
      body.appendChild(strong);
      body.appendChild(document.createTextNode(' · '));
      const wl = document.createElement('span');
      wl.dataset.sessionWl = '1';
      body.appendChild(wl);
      body.appendChild(document.createTextNode(' · '));
      const elapsed = document.createElement('span');
      elapsed.dataset.sessionElapsed = '';
      body.appendChild(elapsed);
    }
    strong.textContent = `Session ${sessionNum}`;
    const wlEl = body.querySelector('[data-session-wl]');
    if (wlEl) wlEl.textContent = `${wins}W ${losses}L`;
  }
  const elapsedEl = el.querySelector('[data-session-elapsed]');
  if (elapsedEl) {
    elapsedEl.textContent = formatDuration(Date.now() - (state.session.startTime || Date.now()));
  }

  const grid = el.querySelector('.dash-session-stat-grid');
  if (grid) {
    const stats = grid.querySelectorAll('.dash-session-stat');
    if (stats[0]) stats[0].querySelector('.dash-session-stat-val').textContent = String(sg.length);
    if (stats[1]) {
      const val = stats[1].querySelector('.dash-session-stat-val');
      if (val) {
        val.textContent = `${net >= 0 ? '+' : ''}${net}`;
        val.classList.toggle('dash-stat-success', net >= 0);
      }
      const label = stats[1].querySelector('.dash-stat-label');
      if (label) label.textContent = `Net ${diffLabel}`;
    }
  }
}

function renderDashSessionPanel(games, allRows) {
  const el = document.getElementById('dash-session-panel');
  if (!el) return;

  const meta = getGameMeta(state.activeGame);
  const diffLabel = meta.diffLabel;
  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const sig = sessionPanelSig(games, allRows);

  if (el.dataset.sessionSig === sig && el.dataset.sessionGame === state.activeGame) {
    if (state.session.active && el.dataset.sessionMode === 'live') return;
    if (!state.session.active) return;
  }

  if (state.session.active) {
    if (el.dataset.wired === '1' && el.dataset.sessionMode === 'live') {
      patchLiveSessionPanel(el, games, diffLabel);
      el.dataset.sessionSig = sig;
      el.dataset.sessionGame = state.activeGame;
      return;
    }
    el.dataset.wired = '1';
    el.dataset.sessionMode = 'live';
    el.dataset.sessionSig = sig;
    el.dataset.sessionGame = state.activeGame;
    el.innerHTML = `
      <div class="dash-section-head">
        <h2 class="dash-section-title"><span class="dash-section-icon">⏱</span> Session</h2>
        <span class="dash-session-live">Live</span>
      </div>
      <div class="dash-session-body">
        <strong>Session ${getLoggingSessionNum()}</strong> · 0W 0L · <span data-session-elapsed></span>
      </div>
      <div class="dash-session-stat-grid">
        <div class="dash-session-stat">
          <div class="dash-stat-label">Games</div>
          <div class="dash-session-stat-val">0</div>
        </div>
        <div class="dash-session-stat">
          <div class="dash-stat-label">Net ${diffLabel}</div>
          <div class="dash-session-stat-val">0</div>
        </div>
      </div>`;
    patchLiveSessionPanel(el, games, diffLabel);
    return;
  }

  el.dataset.sessionMode = '';
  const weekRows = allRows.filter(r => r.weekGameCount > 0);
  if (weekRows.length) {
    const parts = weekRows.map(r => {
      const cls = r.weekGain >= 0 ? 'up' : 'down';
      const modeLabel = isVal ? getQueueLabel(r.mode, state.activeGame) : r.mode;
      return `${modeLabel} <span class="${cls}">${r.weekGain >= 0 ? '+' : ''}${r.weekGain} ${diffLabel}</span>`;
    }).join(' · ');
    el.innerHTML = `
      <div class="dash-section-head">
        <h2 class="dash-section-title"><span class="dash-section-icon">📅</span> This Week</h2>
      </div>
      <div class="dash-session-body">${parts}</div>
      <p class="dash-stat-hint" style="margin-top:12px"><a href="#" class="home-link" data-goto="analytics">Open analytics →</a></p>`;
    el.dataset.wired = '1';
    el.dataset.sessionSig = sig;
    el.dataset.sessionGame = state.activeGame;
    wireHomeLinks(el);
    return;
  }

  if (!games.length) {
    el.innerHTML = `
      <div class="dash-section-head">
        <h2 class="dash-section-title"><span class="dash-section-icon">⏱</span> Session</h2>
      </div>
      <div class="dash-session-body">Start a session from the quick action above or the dock below.</div>`;
    el.dataset.wired = '1';
    el.dataset.sessionSig = sig;
    el.dataset.sessionGame = state.activeGame;
    return;
  }

  el.innerHTML = `
    <div class="dash-section-head">
      <h2 class="dash-section-title"><span class="dash-section-icon">📅</span> Recent</h2>
    </div>
    <div class="dash-session-body muted">
      No games this week · last played ${games[games.length - 1].date}
      · <a href="#" class="home-link" data-goto="log">Match history</a>
    </div>`;
  el.dataset.wired = '1';
  el.dataset.sessionSig = sig;
  el.dataset.sessionGame = state.activeGame;
  wireHomeLinks(el);
}

/** @deprecated legacy sinks — kept for compatibility */
export function renderHomeSummary(games, goals) {
  const legacy = document.getElementById('home-summary');
  const valDash = document.getElementById('val-dashboard');
  if (legacy) legacy.innerHTML = '';
  if (valDash) valDash.innerHTML = '';
}

export function renderHomeContext(games, allRows) {
  const el = document.getElementById('home-context');
  if (el) el.innerHTML = '';
  renderDashSessionPanel(games, allRows);
}

/** Lightweight session/quick-action refresh — avoids full dashboard rebuild. */
export function refreshDashSessionWidgets(games) {
  const allRows = getCachedPlaylistMMRRows(games, state.activeGame);
  renderDashQuickActions();
  renderDashSessionPanel(games, allRows);
}

function focusSig(games, gameId) {
  if (games.length < 2) return `${gameId}:empty:${games.length}`;
  const correlations = getTagLossCorrelations(games);
  const top = correlations.find(c => c.inLosses >= 1) ?? null;
  if (!top) return `${gameId}:notag:${games.length}`;
  const losses = games.filter(g => g.result === 'L').length;
  return `${gameId}:${top.tag}:${top.inLosses}:${losses}:${games.length}`;
}

function patchHomeFocus(el, { focusLabel, featuredClass, tagName, lossNote, tip }) {
  el.querySelector('.home-focus-label')?.replaceChildren(document.createTextNode(focusLabel));
  const tagEl = el.querySelector('.home-focus-tag-name');
  const statEl = el.querySelector('.home-focus-stat');
  const tipEl = el.querySelector('.home-focus-tip');
  const emptyEl = el.querySelector('.home-focus-empty-text');
  if (emptyEl) {
    emptyEl.textContent = tagName || lossNote;
    return;
  }
  if (tagEl) tagEl.textContent = tagName;
  if (statEl) statEl.textContent = lossNote;
  if (tipEl) tipEl.textContent = tip;
}

export function renderHomeFocus(games) {
  const el = document.getElementById('home-focus');
  if (!el) return;

  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const sig = focusSig(games, state.activeGame);
  if (el.dataset.focusSig === sig && el.dataset.focusGame === state.activeGame) return;

  const focusLabel = isVal ? "Today's Mission" : "Today's Focus";
  const featuredClass = ' home-focus-card-featured';
  const emptyHint = isVal
    ? 'Log matches and tag losses — your biggest leak shows up here.'
    : 'Log a few games and tag losses — your top mistake shows up here.';
  const tagEmpty = isVal
    ? 'Tag mistakes after losses to unlock your mission brief.'
    : 'Tag mistakes after losses to unlock your focus area.';

  if (games.length < 2) {
    if (el.dataset.wired === '1' && el.dataset.focusMode === 'empty') {
      patchHomeFocus(el, { focusLabel, featuredClass, tagName: '', lossNote: emptyHint, tip: '' });
    } else {
      el.innerHTML = `
        <div class="home-focus-card home-focus-card-empty dash-section v0-glass${featuredClass}">
          <span class="home-focus-label">${focusLabel}</span>
          <p class="home-focus-empty-text">${emptyHint}</p>
        </div>`;
      el.dataset.wired = '1';
      el.dataset.focusMode = 'empty';
    }
    el.dataset.focusSig = sig;
    el.dataset.focusGame = state.activeGame;
    return;
  }

  const correlations = getTagLossCorrelations(games);
  const top = correlations.find(c => c.inLosses >= 1) ?? null;
  if (!top) {
    if (el.dataset.wired === '1' && el.dataset.focusMode === 'empty') {
      patchHomeFocus(el, { focusLabel, featuredClass, tagName: '', lossNote: tagEmpty, tip: '' });
    } else {
      el.innerHTML = `
        <div class="home-focus-card home-focus-card-empty dash-section v0-glass${featuredClass}">
          <span class="home-focus-label">${focusLabel}</span>
          <p class="home-focus-empty-text">${tagEmpty}</p>
        </div>`;
      el.dataset.wired = '1';
      el.dataset.focusMode = 'empty';
    }
    el.dataset.focusSig = sig;
    el.dataset.focusGame = state.activeGame;
    return;
  }

  const losses = games.filter(g => g.result === 'L').length;
  const lossNote = losses
    ? `${top.inLosses}× in ${losses} loss${losses === 1 ? '' : 'es'}`
    : `${top.inLosses}× tagged`;
  const tip = getActionFocusTips(state.activeGame)[top.tag] ?? 'Slow down and review before you queue again.';

  if (el.dataset.wired === '1' && el.dataset.focusMode === 'filled') {
    patchHomeFocus(el, { focusLabel, featuredClass, tagName: top.tag, lossNote, tip });
  } else {
    el.innerHTML = `
      <div class="home-focus-card dash-section v0-glass${featuredClass}">
        <div class="home-focus-card-head">
          <span class="home-focus-label">${focusLabel}</span>
          <a href="#" class="home-focus-more" data-goto="focus">Details →</a>
        </div>
        <div class="home-focus-tag-name">${top.tag}</div>
        <p class="home-focus-stat">${lossNote}</p>
        <p class="home-focus-tip">${tip}</p>
      </div>`;
    el.dataset.wired = '1';
    el.dataset.focusMode = 'filled';
    wireHomeLinks(el);
  }
  el.dataset.focusSig = sig;
  el.dataset.focusGame = state.activeGame;
}

function activitySig(games, limit, gameId) {
  if (!games.length) return '0';
  const tail = games.slice(-limit);
  const last = tail[tail.length - 1];
  return `${gameId}:${games.length}:${last?.match}:${last?.result}`;
}

export function renderHomeActivity(games, limit = 10) {
  const el = document.getElementById('home-activity');
  const valFeed = document.getElementById('val-match-feed');
  if (!el) return;

  const sig = activitySig(games, limit, state.activeGame);
  const host = state.activeGame === GAME_IDS.VALORANT && valFeed ? valFeed : el;
  if (host.dataset.activitySig === sig) return;

  const recent = [...games].reverse().slice(0, limit);
  if (!recent.length) {
    const empty = `<div class="dash-empty">Your recent matches will show up here.</div>`;
    el.innerHTML = empty;
    if (valFeed) {
      valFeed.innerHTML = '';
      valFeed.dataset.activitySig = sig;
    }
    el.dataset.activitySig = sig;
    return;
  }

  if (state.activeGame === GAME_IDS.VALORANT && valFeed) {
    el.innerHTML = '';
    valFeed.innerHTML = `
      <ul class="val-match-feed-list">
        ${recent.map(g => {
          const diff = getRankDiff(g, GAME_IDS.VALORANT);
          const diffCls = diff >= 0 ? 'up' : 'down';
          const agent = g.agent || 'Unknown Agent';
          const map = g.map || 'Unknown Map';
          const k = g.kills ?? g.goals ?? 0;
          const d = g.deaths ?? 0;
          const a = g.valAssists ?? g.assists ?? 0;
          return `
          <li class="val-match-card dash-activity-item">
            <div class="val-match-result dash-activity-badge ${g.result}">${g.result}</div>
            <div class="dash-activity-main">
              <div class="val-match-queue dash-activity-mode">${getQueueLabel(g.mode, GAME_IDS.VALORANT)}</div>
              <div class="dash-activity-sub val-match-kda">${agent} · ${map} · ${k}/${d}/${a}</div>
            </div>
            <div class="dash-activity-side">
              <div class="val-match-rr dash-activity-mmr ${diffCls}">${formatRRDelta(diff)}</div>
              <div class="val-match-date dash-activity-date">${g.date}</div>
            </div>
          </li>`;
        }).join('')}
      </ul>`;
    valFeed.dataset.activitySig = sig;
    return;
  }

  if (valFeed) {
    valFeed.innerHTML = '';
    valFeed.dataset.activitySig = '';
  }

  const listHtml = recent.map(g => {
    const diff = getRankDiff(g, state.activeGame);
    const diffCls = diff >= 0 ? 'up' : 'down';
    const tags = (g.tags || []).slice(0, 2).map(t =>
      `<span class="home-activity-tag ${getTagCat(t, state.activeGame)}">${t}</span>`,
    ).join('');
    return `
        <li class="dash-activity-item">
          <span class="dash-activity-badge ${g.result}">${g.result}</span>
          <div class="dash-activity-main">
            <div class="dash-activity-mode">${g.mode} · S${g.session}</div>
            <div class="dash-activity-sub">${tags || '—'}</div>
          </div>
          <div class="dash-activity-side">
            <div class="dash-activity-mmr ${diffCls}">${diff >= 0 ? '+' : ''}${diff}</div>
            <div class="dash-activity-date">${g.date}</div>
          </div>
        </li>`;
  }).join('');

  const frag = document.createRange().createContextualFragment(
    `<ul class="dash-activity-list">${listHtml}</ul>`,
  );
  el.replaceChildren(frag);
  el.dataset.activitySig = sig;
}

export function getHomeChartGames(games) {
  const mode = ensureHomeChartMode(games) ?? getMostRecentMode(games);
  return getGamesForMode(games, mode);
}

function updateDashPerfModeLabel(mode) {
  const el = document.getElementById('dash-perf-mode-label');
  if (!el) return;
  el.textContent = mode ? `${mode} playlist` : 'Current playlist';
}

let homeDeferredIdleId = null;

function runHomeDeferred(games, goals, allRows, chartMode, chartGames) {
  homeDeferredIdleId = null;
  renderHomeFocus(games);
  updateDashPerfModeLabel(chartMode);
  renderDashPerfStats(chartGames);
  renderHomeActivity(games);
}

function scheduleHomeDeferred(games, goals, allRows, chartMode, chartGames) {
  const run = () => runHomeDeferred(games, goals, allRows, chartMode, chartGames);
  if (typeof requestIdleCallback === 'function') {
    if (homeDeferredIdleId !== null) cancelIdleCallback(homeDeferredIdleId);
    homeDeferredIdleId = requestIdleCallback(run, { timeout: 600 });
  } else {
    requestAnimationFrame(run);
  }
}

/** @param {{ criticalOnly?: boolean, skipDeferred?: boolean }} [opts] */
export function renderHome(games, goals, opts = {}) {
  const t0 = DASH_PERF ? performance.now() : 0;
  wireHomeLinksOnce();
  const allRows = getCachedPlaylistMMRRows(games, state.activeGame);
  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const rows = isVal ? allRows.filter(r => r.mode === 'Competitive') : allRows;
  const chartMode = ensureHomeChartMode(games);
  const activeRow = rows.find(r => r.mode === chartMode) ?? rows[0];
  const chartGames = getHomeChartGames(games);

  renderHomeSummary(games, goals);
  renderDashHero(games, goals, rows, activeRow);
  renderDashQuickActions();
  renderDashRankProgress(activeRow, goals, games);
  renderHomeContext(games, allRows);

  if (opts.criticalOnly || opts.skipDeferred) {
    if (DASH_PERF) {
      console.info(`[dash +${Math.round(performance.now() - t0)}ms] renderHome (critical)`);
    }
    return;
  }

  scheduleHomeDeferred(games, goals, allRows, chartMode, chartGames);

  if (DASH_PERF) {
    console.info(`[dash +${Math.round(performance.now() - t0)}ms] renderHome`);
  }
}

/** Flush deferred dashboard sections synchronously (e.g. before navigation away). */
export function flushHomeDeferred(games, goals) {
  if (homeDeferredIdleId !== null) {
    cancelIdleCallback(homeDeferredIdleId);
    homeDeferredIdleId = null;
  }
  const allRows = getCachedPlaylistMMRRows(games, state.activeGame);
  const chartMode = ensureHomeChartMode(games);
  runHomeDeferred(games, goals, allRows, chartMode, getHomeChartGames(games));
}

export function getHomeChartModeLabel(games) {
  return ensureHomeChartMode(games) ?? getMostRecentMode(games);
}
