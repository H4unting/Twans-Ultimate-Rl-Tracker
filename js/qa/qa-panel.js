/** Dev-only Developer Tools panel — generate / clear / export QA data */

import { state, setGames, setGoals } from '../state.js';
import { getAuthUser } from '../auth.js';
import { saveGames, saveSettings } from '../supabase.js';
import { GAME_IDS } from '../games/registry.js';
import { showToast } from '../ui.js';
import {
  isDevModeEnabled, loadQaAllowlist, isQaAllowedUser, assertQaWriteAllowed,
  isQaMatch, shouldShowQaPanelInitially, setQaPanelVisible,
} from './qa-gate.js';
import {
  generateRlMatches, generateValorantMatches, generateRlSessions,
  generateValorantSessions, generateSessionsForGame, generateFullQaDataset,
  mergeQaIntoGames, mergeFullQaDataset, stripQaFromGames, collectQaGames,
  buildQaGoalsState, countQaSessions,
} from './qa-generators.js';
import { downloadQaDataset } from './qa-export.js';

let ctx = { renderAll: () => {}, getSettingsPayload: () => ({}) };
let panelEl = null;
let bannerEl = null;

function setStatus(text) {
  panelEl?.querySelector('[data-qa-status]')?.replaceChildren(document.createTextNode(text));
}

async function refreshMeta() {
  const allowlist = await loadQaAllowlist();
  const user = getAuthUser();
  panelEl.querySelector('[data-qa-email]').textContent = user?.email ?? '(not signed in)';
  const allowEl = panelEl.querySelector('[data-qa-allow]');
  const ok = user && isQaAllowedUser(user, allowlist);
  allowEl.textContent = ok
    ? 'DB writes allowed (QA account)'
    : 'Generate = memory only · QA account needed to persist';
  allowEl.style.color = ok ? '#6ee7a0' : '#fbbf24';
  const n = collectQaGames(state.games).length;
  const sessions = countQaSessions(collectQaGames(state.games));
  panelEl.querySelector('[data-qa-count]').textContent =
    `${n} [QA] matches · ${sessions} sessions in memory`;
  return allowlist;
}

function showPreviewBanner(show) {
  if (!bannerEl) {
    bannerEl = document.createElement('div');
    bannerEl.id = 'qa-preview-banner';
    bannerEl.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
      'background:#7f1d1d', 'color:#fff', 'text-align:center', 'padding:8px 12px',
      'font:600 13px/1.4 system-ui,sans-serif', 'border-bottom:2px solid #ef4444',
    ].join(';');
    document.body.appendChild(bannerEl);
  }
  bannerEl.textContent = 'DEV QA DATA — synthetic [QA] rows in memory. Clear before real logging. Ctrl+Shift+D toggles panel.';
  bannerEl.style.display = show ? 'block' : 'none';
}

function applyToState(nextGames, goals = null) {
  setGames(nextGames);
  if (goals) setGoals(goals);
  showPreviewBanner(collectQaGames(nextGames).length > 0);
  ctx.renderAll('full');
}

async function generatePreview(gameId, games) {
  const merged = mergeQaIntoGames(state.games, gameId, games);
  const qaRl = merged.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) === GAME_IDS.ROCKET_LEAGUE && isQaMatch(g));
  const qaVal = merged.filter(g => g.game === GAME_IDS.VALORANT && isQaMatch(g));
  applyToState(merged, buildQaGoalsState(qaRl, qaVal));
  await refreshMeta();
  setStatus(`Generated ${games.length} ${gameId} matches (${countQaSessions(games)} sessions)`);
  showToast(`Generated ${games.length} QA matches (memory)`);
}

async function generateFullPreview() {
  const { rl, val, goals } = generateFullQaDataset();
  const merged = mergeFullQaDataset(state.games, { rl, val });
  applyToState(merged, goals);
  await refreshMeta();
  setStatus(`Full dataset: ${rl.length} RL + ${val.length} Val`);
  showToast('Full QA dataset loaded (memory)');
}

async function persistToDb({ label, applyFn }) {
  const allowlist = await loadQaAllowlist();
  const user = getAuthUser();
  try {
    assertQaWriteAllowed(user, allowlist);
  } catch (e) {
    showToast(e.message, 'error');
    return;
  }
  const typed = prompt(`Persist ${label} to Supabase?\nAccount: ${user.email}\n\nType: PERSIST`);
  if (typed !== 'PERSIST') {
    showToast('Persist cancelled');
    return;
  }

  const result = applyFn();
  await saveGames(result.rlSlice, GAME_IDS.ROCKET_LEAGUE);
  await saveGames(result.valSlice, GAME_IDS.VALORANT);
  setGames(result.merged);
  if (result.goals) {
    setGoals(result.goals);
    await saveSettings(ctx.getSettingsPayload({ goals: result.goals, __qaMeta: { at: new Date().toISOString() } }));
  }
  await refreshMeta();
  ctx.renderAll('full');
  showToast('QA data saved to Supabase');
}

async function clearTestData({ persist = false } = {}) {
  const qaCount = collectQaGames(state.games).length;
  if (!qaCount) {
    showToast('No [QA] test data to clear', 'error');
    return;
  }
  if (persist) {
    try {
      assertQaWriteAllowed(getAuthUser(), await loadQaAllowlist());
    } catch (e) {
      showToast(e.message, 'error');
      return;
    }
  }
  if (prompt(`Clear ${qaCount} [QA] matches?\n\nType: DELETE QA`) !== 'DELETE QA') return;

  const merged = stripQaFromGames(state.games);
  setGames(merged);
  if (persist && getAuthUser()) {
    await saveGames(merged.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) === GAME_IDS.ROCKET_LEAGUE), GAME_IDS.ROCKET_LEAGUE);
    await saveGames(merged.filter(g => g.game === GAME_IDS.VALORANT), GAME_IDS.VALORANT);
  }
  showPreviewBanner(false);
  await refreshMeta();
  ctx.renderAll('full');
  showToast(`Cleared ${qaCount} test matches`);
}

function btn(label, onClick, className = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  if (className) b.className = className;
  b.addEventListener('click', onClick);
  return b;
}

function buildPanel() {
  const el = document.createElement('aside');
  el.id = 'qa-dev-panel';
  el.innerHTML = `
    <style>
      #qa-dev-panel {
        position:fixed;bottom:12px;left:12px;z-index:99998;
        width:min(380px,calc(100vw - 24px));
        background:#0f172a;color:#e2e8f0;border:2px solid #ef4444;border-radius:10px;
        font:12px/1.4 system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.5);
      }
      #qa-dev-panel .qa-head{display:flex;justify-content:space-between;align-items:center;
        padding:10px 12px;background:#7f1d1d;border-radius:8px 8px 0 0;cursor:pointer}
      #qa-dev-panel .qa-body{padding:10px 12px 12px;display:none;max-height:70vh;overflow:auto}
      #qa-dev-panel.open .qa-body{display:block}
      #qa-dev-panel h4{margin:10px 0 6px;font-size:11px;text-transform:uppercase;color:#94a3b8;letter-spacing:.04em}
      #qa-dev-panel .qa-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px}
      #qa-dev-panel button{background:#1e293b;color:#f8fafc;border:1px solid #475569;
        border-radius:6px;padding:6px 8px;cursor:pointer;font-size:11px}
      #qa-dev-panel button:hover{background:#334155}
      #qa-dev-panel button.qa-danger{border-color:#ef4444;color:#fecaca}
      #qa-dev-panel button.qa-save{border-color:#f97316}
      #qa-dev-panel .qa-meta{font-size:11px;color:#cbd5e1;margin-bottom:8px}
      #qa-dev-panel .qa-meta div{margin:2px 0}
      #qa-dev-panel [data-qa-status]{margin-top:8px;color:#94a3b8;font-size:11px;min-height:1.2em}
      #qa-dev-panel .qa-hint{font-size:10px;color:#64748b;margin:4px 0 0}
    </style>
    <div class="qa-head" data-qa-toggle>
      <strong>Developer Tools</strong><span>▼</span>
    </div>
    <div class="qa-body">
      <div class="qa-meta">
        <div>Account: <span data-qa-email>—</span></div>
        <div data-qa-allow>—</div>
        <div data-qa-count>—</div>
        <div class="qa-hint">Ctrl+Shift+D · localhost only · [QA] tagged rows</div>
      </div>
      <h4>Rocket League</h4>
      <div class="qa-row" data-qa-rl></div>
      <h4>Valorant</h4>
      <div class="qa-row" data-qa-val></div>
      <h4>Sessions (active game)</h4>
      <div class="qa-row" data-qa-sessions></div>
      <h4>Data</h4>
      <div class="qa-row" data-qa-data></div>
      <div data-qa-status></div>
    </div>`;
  return el;
}

function wirePanel(panel) {
  const rl = panel.querySelector('[data-qa-rl]');
  [10, 50, 100].forEach(n => {
    rl.append(btn(`Generate ${n} RL Matches`, () =>
      generatePreview(GAME_IDS.ROCKET_LEAGUE, generateRlMatches(n))));
  });

  const val = panel.querySelector('[data-qa-val]');
  [10, 50, 100].forEach(n => {
    val.append(btn(`Generate ${n} Val Matches`, () =>
      generatePreview(GAME_IDS.VALORANT, generateValorantMatches(n))));
  });

  const sessions = panel.querySelector('[data-qa-sessions]');
  [5, 10, 25].forEach(n => {
    sessions.append(btn(`Generate ${n} Sessions`, () => {
      const games = generateSessionsForGame(state.activeGame, n);
      generatePreview(state.activeGame, games);
    }));
  });

  const data = panel.querySelector('[data-qa-data]');
  data.append(
    btn('Generate Full QA Dataset', () => generateFullPreview()),
    btn('Clear Test Data', () => clearTestData({ persist: false }), 'qa-danger'),
    btn('Clear + Supabase', () => clearTestData({ persist: true }), 'qa-danger'),
    btn('Export Test Data', () => {
      const n = downloadQaDataset(state.games);
      showToast(n ? `Exported ${n} rows` : 'Nothing to export', n ? 'success' : 'error');
    }),
    btn('Persist to Supabase', () => {
      const qa = collectQaGames(state.games);
      if (!qa.length) { showToast('Generate data first', 'error'); return; }
      persistToDb({
        label: `${qa.length} QA matches`,
        applyFn: () => ({
          merged: state.games,
          rlSlice: state.games.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) === GAME_IDS.ROCKET_LEAGUE),
          valSlice: state.games.filter(g => g.game === GAME_IDS.VALORANT),
          goals: state.goals,
        }),
      });
    }, 'qa-save'),
  );

  panel.querySelector('[data-qa-toggle]')?.addEventListener('click', () => {
    panel.classList.toggle('open');
  });
}

export async function mountQaPanel(options = {}) {
  ctx = { ...ctx, ...options };
  if (!isDevModeEnabled() || panelEl) return panelEl;

  panelEl = buildPanel();
  wirePanel(panelEl);
  document.body.appendChild(panelEl);
  panelEl.classList.add('open');
  panelEl.style.display = shouldShowQaPanelInitially() ? '' : 'none';

  await refreshMeta();
  showPreviewBanner(collectQaGames(state.games).length > 0);
  return panelEl;
}

export async function toggleQaPanel(options = {}) {
  if (!isDevModeEnabled()) return;
  if (!panelEl) await mountQaPanel(options);
  const visible = panelEl.style.display !== 'none';
  panelEl.style.display = visible ? 'none' : '';
  setQaPanelVisible(!visible);
  if (!visible) panelEl.classList.add('open');
}

export function initQaToolsIfEnabled(options) {
  if (!isDevModeEnabled()) return;
  ctx = { ...ctx, ...options };
  if (panelEl) return;
  mountQaPanel(options).catch(err => console.warn('[qa]', err));
}
