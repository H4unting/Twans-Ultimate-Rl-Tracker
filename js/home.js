/** Home — brief glance: per-mode MMR, context, recent activity */

import {
  calcStats, getGamesInWeek, formatDuration, getPlaylistMMRRows,
  getMostRecentMode, getGamesForMode, calculateWinrate,
} from './utils.js';
import { getRank, rankBadgeHTML } from './ranks.js';
import { getTagLossCorrelations } from './insights.js';
import { getActionFocusTips, getGameMeta, GAME_IDS, getTagCat } from './games.js';
import { state } from './state.js';
import { getLoggingSessionNum } from './sessions.js';

function ensureHomeChartMode(games) {
  const rows = getPlaylistMMRRows(games, state.activeGame);
  if (!rows.length) {
    state.homeChartMode = null;
    return null;
  }
  if (!state.homeChartMode || !rows.some(r => r.mode === state.homeChartMode)) {
    state.homeChartMode = getMostRecentMode(games);
  }
  return state.homeChartMode;
}

export function renderHomeSummary(games, goals) {
  if (state.activeGame === GAME_IDS.VALORANT) {
    renderValorantHomeSummary(games, goals);
    return;
  }

  const el = document.getElementById('home-summary');
  if (!el) return;

  const meta = getGameMeta(state.activeGame);
  const rows = getPlaylistMMRRows(games, state.activeGame);
  if (!rows.length) {
    el.innerHTML = `<p class="home-summary-empty">Log a ${meta.label} game to see your ${meta.rankLabel} by queue.</p>`;
    return;
  }

  const chartMode = ensureHomeChartMode(games);
  const target = goals?.mmrTarget || 0;
  const activeRow = rows.find(r => r.mode === chartMode) ?? rows[0];

  const goalHTML = target > 0 && activeRow ? (() => {
    const mmr = activeRow.mmr;
    const remaining = target > mmr ? target - mmr : 0;
    const pct = Math.min(100, Math.round(mmr / target * 100));
    return `
      <div class="home-summary-goal">
        <div class="home-summary-goal-row">
          <span>${activeRow.mode} goal ${target}</span>
          <span>${mmr} / ${target}${remaining > 0 ? ` · ${remaining} left` : ''}</span>
        </div>
        <div class="goal-progress-track home-summary-track">
          <div class="goal-progress-fill${pct >= 100 ? ' met' : ''}" style="width:${pct}%"></div>
        </div>
      </div>`;
  })() : '';

  el.innerHTML = `
    <div class="home-mmr-grid">
      ${rows.map(r => {
        const rank = getRank(r.mmr, r.mode);
        const wkCls = r.weekGain >= 0 ? 'up' : 'down';
        const wk = `${r.weekGain >= 0 ? '+' : ''}${r.weekGain}`;
        return `
        <button type="button" class="home-mmr-row${r.mode === chartMode ? ' active' : ''}" data-home-mode="${r.mode}">
          ${rankBadgeHTML(r.mmr, 22, r.mode)}
          <span class="home-mmr-mode">${r.mode}</span>
          <span class="home-mmr-rank">${rank.name}</span>
          <span class="home-mmr-val">${r.mmr} ${meta.rankLabel}</span>
          <span class="home-mmr-week ${wkCls}">${wk} wk</span>
        </button>`;
      }).join('')}
    </div>
    ${goalHTML}`;

  el.querySelectorAll('[data-home-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.homeChartMode = btn.dataset.homeMode;
      window.__refreshHome?.();
    });
  });
}

function renderValorantHomeSummary(games, goals) {
  const dash = document.getElementById('val-dashboard');
  const legacy = document.getElementById('home-summary');
  if (legacy) legacy.innerHTML = '';
  if (!dash) return;

  const meta = getGameMeta(state.activeGame);
  const rows = getPlaylistMMRRows(games, state.activeGame);
  const stats = calcStats(games);

  if (!rows.length) {
    dash.innerHTML = `<p class="home-summary-empty">Log a ${meta.label} match to see your ${meta.rankLabel} by queue.</p>`;
    return;
  }

  const chartMode = ensureHomeChartMode(games);
  const activeRow = rows.find(r => r.mode === chartMode) ?? rows[0];
  const wr = calculateWinrate(games);

  dash.innerHTML = `
    <div class="val-hero">
      <div>
        <div class="val-hero-label">Combat Report</div>
        <div class="val-hero-title">${activeRow.mode}</div>
        <div class="val-hero-sub">${stats.totalGames} matches logged · ${stats.wins}W ${stats.losses}L</div>
      </div>
      <div class="val-hero-stats">
        <div class="val-hero-stat">
          <div class="val-hero-stat-val">${activeRow.mmr}<span style="font-size:11px;color:var(--muted)"> RR</span></div>
          <div class="val-hero-stat-label">Current RR</div>
        </div>
        <div class="val-hero-stat">
          <div class="val-hero-stat-val">${wr}<span style="font-size:11px;color:var(--muted)">%</span></div>
          <div class="val-hero-stat-label">Win Rate</div>
        </div>
      </div>
    </div>
    <div class="val-queue-grid">
      ${rows.map(r => {
        const wkCls = r.weekGain >= 0 ? 'up' : 'down';
        const wk = `${r.weekGain >= 0 ? '+' : ''}${r.weekGain}`;
        const wl = `${r.wins ?? 0}W ${r.losses ?? 0}L`;
        return `
        <button type="button" class="val-queue-card${r.mode === chartMode ? ' active' : ''}" data-home-mode="${r.mode}">
          <div class="val-queue-name">${r.mode}</div>
          <div class="val-queue-rr">${r.mmr}<span>RR</span></div>
          <div class="val-queue-meta">
            <span class="val-queue-wl">${wl}</span>
            <span class="val-queue-week ${wkCls}">${wk} wk</span>
          </div>
        </button>`;
      }).join('')}
    </div>`;

  dash.querySelectorAll('[data-home-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.homeChartMode = btn.dataset.homeMode;
      window.__refreshHome?.();
    });
  });
}

export function renderHomeContext(games) {
  const el = document.getElementById('home-context');
  if (!el) return;

  if (!games.length) {
    el.innerHTML = `<p class="home-context-line muted">No games yet — start a session and log from the dock below.</p>`;
    return;
  }

  if (state.session.active) {
    const sessionNum = getLoggingSessionNum();
    const sg = games.filter(g => parseInt(g.session, 10) === sessionNum);
    const wins = sg.filter(g => g.result === 'W').length;
    const losses = sg.filter(g => g.result === 'L').length;
    const byMode = {};
    sg.forEach(g => {
      if (!byMode[g.mode]) byMode[g.mode] = 0;
      byMode[g.mode] += g.mmrDiff || 0;
    });
    const diffLabel = getGameMeta(state.activeGame).diffLabel;
    const modeParts = Object.entries(byMode).map(([mode, gain]) => {
      const cls = gain >= 0 ? 'up' : 'down';
      return `${mode} <span class="${cls}">${gain >= 0 ? '+' : ''}${gain} ${diffLabel}</span>`;
    }).join(' · ');
    const elapsed = formatDuration(Date.now() - (state.session.startTime || Date.now()));
    el.innerHTML = `
      <p class="home-context-line">
        <span class="home-context-live">Live</span>
        Session ${sessionNum} · ${wins}W ${losses}L · ${elapsed}
        ${modeParts ? ` · ${modeParts}` : ''}
      </p>`;
    return;
  }

  const weekRows = getPlaylistMMRRows(games, state.activeGame).filter(r => r.weekGameCount > 0);
  if (weekRows.length) {
    const diffLabel = getGameMeta(state.activeGame).diffLabel;
    const parts = weekRows.map(r => {
      const cls = r.weekGain >= 0 ? 'up' : 'down';
      return `${r.mode} <span class="${cls}">${r.weekGain >= 0 ? '+' : ''}${r.weekGain} ${diffLabel}</span> (${r.weekGameCount}g)`;
    }).join(' · ');
    el.innerHTML = `
      <p class="home-context-line">
        This week · ${parts}
        · <a href="#" class="home-link" data-goto="analytics">Analytics</a>
      </p>`;
    wireHomeLinks(el);
    return;
  }

  el.innerHTML = `
    <p class="home-context-line muted">
      No games this week · last played ${games[games.length - 1].date}
      · <a href="#" class="home-link" data-goto="log">Match history</a>
    </p>`;
  wireHomeLinks(el);
}

function wireHomeLinks(el) {
  el.querySelectorAll('[data-goto]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const page = link.dataset.goto;
      const section = ['analytics', 'reports', 'sessions'].includes(page) ? 'review' : 'home';
      window.__navigate?.(page, section);
    });
  });
}

export function renderHomeFocus(games) {
  const el = document.getElementById('home-focus');
  if (!el) return;

  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const focusLabel = isVal ? 'Mission Brief' : "Today's Focus";
  const emptyHint = isVal
    ? 'Log matches and tag losses — your biggest leak shows up here.'
    : 'Log a few games and tag losses — your top mistake shows up here.';
  const tagEmpty = isVal
    ? 'Tag mistakes after losses to unlock your mission brief.'
    : 'Tag mistakes after losses to unlock your focus area.';

  if (games.length < 2) {
    el.innerHTML = `
      <div class="home-focus-card home-focus-card-empty">
        <span class="home-focus-label">${focusLabel}</span>
        <p class="home-focus-empty-text">${emptyHint}</p>
      </div>`;
    return;
  }

  const correlations = getTagLossCorrelations(games);
  const top = correlations.find(c => c.inLosses >= 1) ?? null;
  if (!top) {
    el.innerHTML = `
      <div class="home-focus-card home-focus-card-empty">
        <span class="home-focus-label">${focusLabel}</span>
        <p class="home-focus-empty-text">${tagEmpty}</p>
      </div>`;
    return;
  }

  const losses = games.filter(g => g.result === 'L').length;
  const lossNote = losses
    ? `${top.inLosses}× in ${losses} loss${losses === 1 ? '' : 'es'}`
    : `${top.inLosses}× tagged`;
  const tip = getActionFocusTips(state.activeGame)[top.tag] ?? 'Slow down and review before you queue again.';

  el.innerHTML = `
    <div class="home-focus-card">
      <div class="home-focus-card-head">
        <span class="home-focus-label">${focusLabel}</span>
        <a href="#" class="home-focus-more" data-goto="focus">Details →</a>
      </div>
      <div class="home-focus-tag-name">${top.tag}</div>
      <p class="home-focus-stat">${lossNote}</p>
      <p class="home-focus-tip">${tip}</p>
    </div>`;
  wireHomeLinks(el);
}

export function renderHomeActivity(games, limit = 10) {
  const el = document.getElementById('home-activity');
  const valFeed = document.getElementById('val-match-feed');
  if (!el) return;

  const recent = [...games].reverse().slice(0, limit);
  if (!recent.length) {
    const empty = `<div class="empty-state">Your recent matches will show up here.</div>`;
    el.innerHTML = empty;
    if (valFeed) valFeed.innerHTML = '';
    return;
  }

  if (state.activeGame === GAME_IDS.VALORANT && valFeed) {
    el.innerHTML = '';
    valFeed.innerHTML = `
      <ul class="val-match-feed-list">
        ${recent.map(g => {
          const diff = g.mmrDiff || 0;
          const diffCls = diff >= 0 ? 'up' : 'down';
          const agent = g.agent || 'Unknown Agent';
          const map = g.map || 'Unknown Map';
          const k = g.kills ?? g.goals ?? 0;
          const d = g.deaths ?? 0;
          const a = g.assists ?? 0;
          const tags = (g.tags || []).slice(0, 2).map(t =>
            `<span class="val-match-tag">${t}</span>`,
          ).join('');
          return `
          <li class="val-match-card">
            <div class="val-match-result ${g.result}">${g.result}</div>
            <div class="val-match-main">
              <div class="val-match-queue">${g.mode}</div>
              <div class="val-match-agent">${agent}</div>
              <div class="val-match-map">${map} · S${g.session}</div>
              <div class="val-match-kda">${k} / ${d} / ${a}</div>
              ${tags ? `<div class="val-match-tags">${tags}</div>` : ''}
            </div>
            <div class="val-match-side">
              <div class="val-match-rr ${diffCls}">${diff >= 0 ? '+' : ''}${diff} RR</div>
              <div class="val-match-date">${g.date}</div>
            </div>
          </li>`;
        }).join('')}
      </ul>`;
    return;
  }

  if (valFeed) valFeed.innerHTML = '';

  el.innerHTML = `
    <ul class="home-activity-list">
      ${recent.map(g => {
        const diff = g.mmrDiff || 0;
        const diffCls = diff >= 0 ? 'up' : 'down';
        const tags = (g.tags || []).slice(0, 2).map(t =>
          `<span class="home-activity-tag ${getTagCat(t, state.activeGame)}">${t}</span>`,
        ).join('');
        return `
        <li class="home-activity-row">
          <span class="home-activity-result ${g.result}">${g.result}</span>
          <span class="home-activity-mmr ${diffCls}">${diff >= 0 ? '+' : ''}${diff}</span>
          <span class="home-activity-meta">${g.mode} · S${g.session}</span>
          <span class="home-activity-tags">${tags || '<span class="home-activity-none">—</span>'}</span>
          <span class="home-activity-date">${g.date}</span>
        </li>`;
      }).join('')}
    </ul>`;
}

export function getHomeChartGames(games) {
  const mode = ensureHomeChartMode(games) ?? getMostRecentMode(games);
  return getGamesForMode(games, mode);
}

export function renderHome(games, goals) {
  const dash = document.getElementById('val-dashboard');
  if (dash && state.activeGame !== GAME_IDS.VALORANT) dash.innerHTML = '';

  renderHomeSummary(games, goals);
  renderHomeContext(games);
  renderHomeFocus(games);
  renderHomeActivity(games);
}

export function getHomeChartModeLabel(games) {
  return ensureHomeChartMode(games) ?? getMostRecentMode(games);
}
