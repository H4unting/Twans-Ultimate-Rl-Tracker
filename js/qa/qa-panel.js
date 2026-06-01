/** Dev-only QA panel — localhost + ?qa=enable + allowlist for writes */

import { state, setGames, setGoals } from '../state.js';
import { getAuthUser } from '../auth.js';
import { saveGames, saveSettings } from '../supabase.js';
import { GAME_IDS } from '../games/registry.js';
import { showToast } from '../ui.js';
import {
  isQaToolsEnabled, loadQaAllowlist, isQaAllowedUser, assertQaWriteAllowed, isQaMatch,
} from './qa-gate.js';
import {
  generateRlMatches, generateValorantMatches, mergeQaIntoGames,
  stripQaFromGames, collectQaGames, buildGoalsPatch,
} from './qa-generators.js';
import { downloadQaDataset } from './qa-export.js';

let ctx = { renderAll: () => {}, getSettingsPayload: () => ({}) };
let panelEl = null;
let bannerEl = null;

function setStatus(text) {
  const el = panelEl?.querySelector('[data-qa-status]');
  if (el) el.textContent = text;
}

function updatePanelMeta(allowlist) {
  const user = getAuthUser();
  const emailEl = panelEl?.querySelector('[data-qa-email]');
  const allowEl = panelEl?.querySelector('[data-qa-allow]');
  const countEl = panelEl?.querySelector('[data-qa-count]');
  if (emailEl) emailEl.textContent = user?.email ?? '(not signed in)';
  if (allowEl) {
    const ok = user && isQaAllowedUser(user, allowlist);
    allowEl.textContent = ok ? 'Writes allowed (QA account)' : 'Preview only — QA account required to persist';
    allowEl.style.color = ok ? '#6ee7a0' : '#fbbf24';
  }
  if (countEl) {
    const n = collectQaGames(state.games).length;
    countEl.textContent = `${n} [QA] match${n === 1 ? '' : 'es'} in memory`;
  }
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
    bannerEl.textContent = 'QA PREVIEW — synthetic [QA] data in memory. Persist only on a throwaway QA account.';
    document.body.appendChild(bannerEl);
  }
  bannerEl.style.display = show ? 'block' : 'none';
}

async function applyPreview(gameId, count, factory) {
  const qaGames = factory(count);
  const merged = mergeQaIntoGames(state.games, gameId, qaGames);
  setGames(merged);
  showPreviewBanner(true);
  updatePanelMeta(await loadQaAllowlist());
  ctx.renderAll('full');
  setStatus(`Preview loaded ${count} ${gameId} matches`);
  showToast(`Preview: ${count} QA matches (not saved)`);
}

async function persistDataset(gameId, count, factory) {
  const allowlist = await loadQaAllowlist();
  const user = getAuthUser();
  try {
    assertQaWriteAllowed(user, allowlist);
  } catch (e) {
    showToast(e.message, 'error');
    return;
  }
  const typed = prompt(
    `Save ${count} QA ${gameId} matches to Supabase?\nAccount: ${user.email}\n\nType: PERSIST ${count}`,
  );
  if (typed !== `PERSIST ${count}`) {
    showToast('Persist cancelled');
    return;
  }

  const qaGames = factory(count);
  const merged = mergeQaIntoGames(state.games, gameId, qaGames);
  const slice = merged.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) === gameId);
  await saveGames(slice, gameId);
  setGames(merged);

  const goals = buildGoalsPatch(slice.filter(isQaMatch), gameId);
  setGoals(goals);
  await saveSettings(ctx.getSettingsPayload({ goals }));

  showPreviewBanner(collectQaGames(state.games).length > 0);
  updatePanelMeta(allowlist);
  ctx.renderAll('full');
  setStatus(`Persisted ${count} ${gameId} matches`);
  showToast(`Saved ${count} QA matches + goals`);
}

async function clearQaData({ persist } = { persist: false }) {
  const qaCount = collectQaGames(state.games).length;
  if (!qaCount) {
    showToast('No [QA] matches to clear', 'error');
    return;
  }
  const allowlist = await loadQaAllowlist();
  if (persist) {
    try {
      assertQaWriteAllowed(getAuthUser(), allowlist);
    } catch (e) {
      showToast(e.message, 'error');
      return;
    }
  }
  if (prompt(`Remove ${qaCount} [QA] matches${persist ? ' from Supabase' : ' from memory'}?\n\nType: DELETE QA`) !== 'DELETE QA') {
    showToast('Clear cancelled');
    return;
  }

  const merged = stripQaFromGames(state.games);
  setGames(merged);
  if (persist && getAuthUser()) {
    await saveGames(merged.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) === GAME_IDS.ROCKET_LEAGUE), GAME_IDS.ROCKET_LEAGUE);
    await saveGames(merged.filter(g => g.game === GAME_IDS.VALORANT), GAME_IDS.VALORANT);
  }
  showPreviewBanner(false);
  updatePanelMeta(allowlist);
  ctx.renderAll('full');
  setStatus(`Cleared ${qaCount} QA matches`);
  showToast(`Removed ${qaCount} [QA] matches`);
}

function buildPanel() {
  const el = document.createElement('aside');
  el.id = 'qa-dev-panel';
  el.innerHTML = `
    <style>
      #qa-dev-panel {
        position: fixed; bottom: 12px; left: 12px; z-index: 99998;
        width: min(360px, calc(100vw - 24px));
        background: #111; color: #eee; border: 2px solid #ef4444;
        border-radius: 10px; font: 12px/1.4 system-ui, sans-serif;
        box-shadow: 0 8px 32px rgba(0,0,0,.45);
      }
      #qa-dev-panel .qa-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 12px; background: #7f1d1d; border-radius: 8px 8px 0 0;
        cursor: pointer; user-select: none;
      }
      #qa-dev-panel .qa-head strong { font-size: 13px; }
      #qa-dev-panel .qa-body { padding: 10px 12px 12px; display: none; }
      #qa-dev-panel.open .qa-body { display: block; }
      #qa-dev-panel .qa-meta { margin: 0 0 10px; color: #cbd5e1; font-size: 11px; }
      #qa-dev-panel .qa-meta div { margin: 2px 0; }
      #qa-dev-panel .qa-section { margin-top: 10px; }
      #qa-dev-panel .qa-section h4 {
        margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8;
      }
      #qa-dev-panel .qa-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
      #qa-dev-panel button {
        background: #1f2937; color: #f8fafc; border: 1px solid #475569;
        border-radius: 6px; padding: 6px 8px; cursor: pointer; font-size: 11px;
      }
      #qa-dev-panel button:hover { background: #334155; }
      #qa-dev-panel button.qa-primary { border-color: #f97316; }
      #qa-dev-panel button.qa-danger { border-color: #ef4444; color: #fecaca; }
      #qa-dev-panel [data-qa-status] { margin-top: 8px; color: #94a3b8; font-size: 11px; min-height: 1.2em; }
    </style>
    <div class="qa-head" data-qa-toggle>
      <strong>QA Tools (dev)</strong>
      <span aria-hidden="true">▼</span>
    </div>
    <div class="qa-body">
      <div class="qa-meta">
        <div>Account: <span data-qa-email>—</span></div>
        <div data-qa-allow>—</div>
        <div data-qa-count>—</div>
      </div>
      <div class="qa-section">
        <h4>Rocket League — preview / persist</h4>
        <div class="qa-row" data-qa-game="rocket_league"></div>
      </div>
      <div class="qa-section">
        <h4>Valorant — preview / persist</h4>
        <div class="qa-row" data-qa-game="valorant"></div>
      </div>
      <div class="qa-section">
        <h4>Maintenance</h4>
        <div class="qa-row">
          <button type="button" class="qa-danger" data-qa-clear>Clear [QA] (memory)</button>
          <button type="button" class="qa-danger" data-qa-clear-db>Clear [QA] + Supabase</button>
          <button type="button" data-qa-export>Export [QA] JSON</button>
        </div>
      </div>
      <div data-qa-status></div>
    </div>`;
  return el;
}

function wireGameButtons(panel, gameId, factory) {
  const row = panel.querySelector(`[data-qa-game="${gameId}"]`);
  [10, 50, 100].forEach(count => {
    const preview = document.createElement('button');
    preview.type = 'button';
    preview.textContent = `Preview ${count}`;
    preview.addEventListener('click', () => applyPreview(gameId, count, factory));

    const persist = document.createElement('button');
    persist.type = 'button';
    persist.className = 'qa-primary';
    persist.textContent = `Save ${count}`;
    persist.addEventListener('click', () => persistDataset(gameId, count, factory));

    row.append(preview, persist);
  });
}

export async function mountQaPanel(options = {}) {
  ctx = { ...ctx, ...options };
  if (!isQaToolsEnabled() || panelEl) return;

  panelEl = buildPanel();
  document.body.appendChild(panelEl);

  panelEl.querySelector('[data-qa-toggle]')?.addEventListener('click', () => {
    panelEl.classList.toggle('open');
  });
  panelEl.classList.add('open');

  wireGameButtons(panelEl, GAME_IDS.ROCKET_LEAGUE, generateRlMatches);
  wireGameButtons(panelEl, GAME_IDS.VALORANT, generateValorantMatches);

  panelEl.querySelector('[data-qa-clear]')?.addEventListener('click', () => clearQaData({ persist: false }));
  panelEl.querySelector('[data-qa-clear-db]')?.addEventListener('click', () => clearQaData({ persist: true }));
  panelEl.querySelector('[data-qa-export]')?.addEventListener('click', () => {
    const n = downloadQaDataset(state.games);
    showToast(n ? `Exported ${n} QA matches` : 'No QA matches to export', n ? 'success' : 'error');
  });

  const allowlist = await loadQaAllowlist();
  updatePanelMeta(allowlist);
  showPreviewBanner(collectQaGames(state.games).length > 0);
}

export function initQaToolsIfEnabled(options) {
  if (!isQaToolsEnabled()) return;
  mountQaPanel(options).catch(err => console.warn('[qa]', err));
}
