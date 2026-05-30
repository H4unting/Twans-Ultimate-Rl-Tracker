/** Home dashboard — hero, focus, session strip */

import { calcStats, getPrimaryMode } from './utils.js';
import { buildWeeklyReport } from './reports.js';
import { getRank, rankBadgeHTML } from './ranks.js';
import { getTagLossCorrelations, ACTION_FOCUS_TIPS } from './insights.js';
import { state } from './state.js';
import { formatDuration } from './utils.js';
import { getLoggingSessionNum } from './sessions.js';

export function renderHomeHero(games, goals, display) {
  const el = document.getElementById('home-hero');
  if (!el) return;

  const stats = calcStats(games);
  const mode = getPrimaryMode(games);
  const week = buildWeeklyReport(games, 0);
  const mmr = stats.currentMMR || 0;
  const rank = mmr ? getRank(mmr, mode) : null;
  const target = goals?.mmrTarget || 0;
  const weekGain = week.empty ? 0 : week.mmrGain;
  const remaining = target > mmr ? target - mmr : 0;
  const pct = target > 0 ? Math.min(100, Math.round(mmr / target * 100)) : 0;
  const recentWins = games.filter(g => g.result === 'W' && g.mmrDiff > 0).slice(-5);
  const avgWinDelta = recentWins.length
    ? Math.round(recentWins.reduce((s, g) => s + g.mmrDiff, 0) / recentWins.length)
    : 10;
  const estGames = remaining > 0 ? Math.ceil(remaining / Math.max(avgWinDelta, 1)) : 0;

  el.innerHTML = `
    <div class="home-hero-card">
      <div class="home-hero-rank">
        ${rank ? rankBadgeHTML(mmr, 48, mode) : ''}
        <div class="home-hero-rank-name">${rank?.name ?? 'Unranked'}</div>
      </div>
      <div class="home-hero-stats">
        <div class="home-hero-stat">
          <span class="home-hero-stat-val gold">${mmr || '—'}</span>
          <span class="home-hero-stat-lbl">Current MMR</span>
        </div>
        <div class="home-hero-stat">
          <span class="home-hero-stat-val ${weekGain >= 0 ? 'green' : 'red'}">${weekGain >= 0 ? '+' : ''}${weekGain}</span>
          <span class="home-hero-stat-lbl">This Week</span>
        </div>
      </div>
      ${target > 0 ? `
      <div class="home-hero-goal">
        <div class="home-hero-goal-head">
          <span>Goal: ${target} MMR</span>
          <span class="home-hero-goal-nums">${mmr} / ${target}</span>
        </div>
        <div class="goal-progress-track home-hero-track">
          <div class="goal-progress-fill${pct >= 100 ? ' met' : ''}" style="width:${pct}%"></div>
        </div>
        <p class="home-hero-goal-sub">${remaining > 0 ? `${remaining} MMR left · ~${estGames} games at current pace` : 'Goal reached 🎉'}</p>
      </div>` : `
      <p class="home-hero-goal-sub"><a href="#" class="home-link" data-goto="reports">Set an MMR goal in Reports →</a></p>`}
    </div>`;

  el.querySelector('[data-goto="reports"]')?.addEventListener('click', e => {
    e.preventDefault();
    window.__navigate?.('reports', 'review');
  });
}

export function renderTodayFocus(games) {
  const el = document.getElementById('home-today-focus');
  if (!el) return;

  if (games.length < 3) {
    el.innerHTML = `
      <div class="home-focus-card home-focus-empty">
        <span class="home-focus-kicker">Today's Focus</span>
        <p>Log a few games — your top mistake will show up here automatically.</p>
      </div>`;
    return;
  }

  const losses = games.filter(g => g.result === 'L');
  const correlations = getTagLossCorrelations(games);
  const top = correlations.find(c => c.inLosses >= 2) ?? correlations[0];
  if (!top) {
    el.innerHTML = `<div class="home-focus-card home-focus-empty"><span class="home-focus-kicker">Today's Focus</span><p>Tag mistakes after losses to unlock focus tips.</p></div>`;
    return;
  }

  const lossPct = losses.length ? Math.round(top.inLosses / losses.length * 100) : 0;
  const tip = ACTION_FOCUS_TIPS[top.tag] ?? 'Slow down and review what happened before queueing again.';

  el.innerHTML = `
    <div class="home-focus-card">
      <span class="home-focus-kicker">Today's Focus</span>
      <h3 class="home-focus-title">${top.tag}</h3>
      <p class="home-focus-meta">Tagged in ${top.inLosses} loss${top.inLosses === 1 ? '' : 'es'} · ${lossPct}% of recent losses</p>
      <div class="home-focus-action">
        <span class="home-focus-action-label">Recommended</span>
        <p>${tip}</p>
      </div>
    </div>`;
}

export function renderHomeSessionStrip(sessionSnapshot) {
  const el = document.getElementById('home-session-strip');
  if (!el) return;

  if (!sessionSnapshot?.active) {
    const next = getLoggingSessionNum();
    el.innerHTML = `
      <div class="home-session-strip idle">
        <div class="home-session-strip-main">
          <span class="home-session-num">Session ${next}</span>
          <span class="home-session-idle">Not started — tap ▶ Start below before you queue</span>
        </div>
      </div>`;
    return;
  }

  const s = sessionSnapshot;
  const streakEmoji = s.streak?.type === 'W' ? '🔥' : s.streak?.type === 'L' ? '💀' : '—';
  el.innerHTML = `
    <div class="home-session-strip live">
      <div class="home-session-strip-main">
        <span class="home-session-num">Session ${s.sessionNum}</span>
        <span class="home-session-pill time">${formatDuration(s.elapsed)}</span>
        <span class="home-session-pill">${s.wins}W · ${s.losses}L</span>
        <span class="home-session-pill ${s.mmrGain >= 0 ? 'pos' : 'neg'}">${s.mmrGain >= 0 ? '+' : ''}${s.mmrGain} MMR</span>
        <span class="home-session-pill streak">${streakEmoji} ${s.streak?.count || 0}</span>
      </div>
    </div>`;
}

export function getSessionSnapshotForHome() {
  if (!state.session.active) return { active: false };
  const sessionNum = getLoggingSessionNum();
  const sessionGames = state.games.filter(g => parseInt(g.session, 10) === sessionNum);
  const wins = sessionGames.filter(g => g.result === 'W').length;
  const losses = sessionGames.filter(g => g.result === 'L').length;
  const mmrGain = sessionGames.reduce((s, g) => s + (g.mmrDiff || 0), 0);
  let streakType = null, streakCount = 0;
  if (sessionGames.length) {
    streakType = sessionGames[sessionGames.length - 1].result;
    for (let i = sessionGames.length - 1; i >= 0; i--) {
      if (sessionGames[i].result === streakType) streakCount++;
      else break;
    }
  }
  return {
    active: true,
    sessionNum,
    elapsed: Date.now() - (state.session.startTime || Date.now()),
    wins,
    losses,
    mmrGain,
    streak: { type: streakType, count: streakCount },
  };
}
