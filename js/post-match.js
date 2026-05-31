/** Post-match card — confirm RR/MMR, tags, undo after auto/manual log */

import { GAME_IDS, getGameMeta, getTagGroups } from './games.js';
import { state } from './state.js';
import { showToast } from './ui.js';
import { isDockCollapsed, expandDock, collapseDock } from './quicklog.js';

const RL_HOT_TAGS = ['Tilt', 'Autopilot', 'Bad Positioning', 'Overcommitting', 'Giving Away Possession', 'Hesitation'];
const VAL_HOT_TAGS = ['Tilt', 'Autopilot', 'Bad Crosshair Placement', 'Overpeeking', 'Ego Peek', 'Bad Utility Timing'];

let dismissTimer = null;
let currentMatch = null;
let selectedTags = [];
let needsMmrConfirm = false;
let mmrConfirmed = false;
let callbacks = {};
let wired = false;
let restoreDockCollapsed = false;

function getHotTags() {
  return state.activeGame === GAME_IDS.VALORANT ? VAL_HOT_TAGS : RL_HOT_TAGS;
}

export function initPostMatch(cbs) {
  callbacks = cbs;
  if (!wired) {
    wirePostMatch();
    wired = true;
  }
}

export function showPostMatchCard(game, { estimated = false } = {}) {
  const el = document.getElementById('post-match-card');
  if (!el || !game) return;

  currentMatch = game.match;
  selectedTags = [...(game.tags || [])];
  needsMmrConfirm = estimated;
  mmrConfirmed = !estimated;

  renderCard(el, game, estimated);
  el.classList.remove('hidden');
  restoreDockCollapsed = isDockCollapsed();
  if (restoreDockCollapsed) expandDock();
  document.getElementById('quick-dock')?.classList.add('has-post-match');
  document.body.classList.add('post-match-open');
  wireCardEvents();
  clearTimeout(dismissTimer);
  if (!needsMmrConfirm) {
    dismissTimer = setTimeout(hidePostMatchCard, 60000);
  }
  setTimeout(() => document.getElementById('pm-mmr')?.focus(), 120);
  callbacks.onOpen?.(needsMmrConfirm);
}

export function hidePostMatchCard(force = false) {
  const meta = getGameMeta(state.activeGame);
  if (needsMmrConfirm && !mmrConfirmed && !force) {
    showToast(`Confirm ${meta.rankLabel} from ranked screen first`, 'error');
    document.getElementById('pm-mmr')?.focus();
    pulseMmrSection();
    return;
  }
  document.getElementById('post-match-card')?.classList.add('hidden');
  document.getElementById('quick-dock')?.classList.remove('has-post-match');
  document.body.classList.remove('post-match-open');
  if (restoreDockCollapsed) collapseDock();
  restoreDockCollapsed = false;
  clearTimeout(dismissTimer);
  currentMatch = null;
  selectedTags = [];
  needsMmrConfirm = false;
  mmrConfirmed = false;
  callbacks.onClose?.();
}

function renderCard(el, game, estimated) {
  const meta = getGameMeta(state.activeGame);
  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const win = game.result === 'W';
  const delta = game.mmrDiff ?? 0;
  const matchLabel = isVal ? 'Match' : 'Game';

  el.innerHTML = `
    <div class="post-match-inner ${win ? 'pm-win' : 'pm-loss'}${estimated ? ' pm-needs-mmr' : ''}">
      <div class="post-match-top">
        <div class="post-match-hero">
          <span class="post-match-badge ${win ? 'win' : 'loss'}">${win ? 'WIN' : 'LOSS'}</span>
          <span class="post-match-title">${matchLabel} ${game.match} · ${game.mode}${game.playlist ? ` · ${game.playlist}` : ''}${isVal && game.agent ? ` · ${game.agent}` : ''}</span>
        </div>
        <div class="post-match-delta ${delta >= 0 ? 'pos' : 'neg'}${estimated ? ' estimated' : ''}">
          ${estimated ? '~' : ''}${delta >= 0 ? '+' : ''}${delta}
          <span class="post-match-delta-unit">${meta.diffLabel}</span>
        </div>
        <button type="button" class="post-match-close" id="pm-dismiss" aria-label="Dismiss">✕</button>
      </div>

      <div class="post-match-stat-grid">
        ${isVal
          ? `<div class="pm-stat"><span class="pm-stat-val">${game.kills ?? game.goals ?? 0}</span><span class="pm-stat-lbl">Kills</span></div>
             <div class="pm-stat"><span class="pm-stat-val">${game.deaths ?? 0}</span><span class="pm-stat-lbl">Deaths</span></div>
             <div class="pm-stat"><span class="pm-stat-val">${game.assists ?? 0}</span><span class="pm-stat-lbl">Assists</span></div>`
          : `<div class="pm-stat"><span class="pm-stat-val">${game.goals}</span><span class="pm-stat-lbl">Goals</span></div>
             <div class="pm-stat"><span class="pm-stat-val">${game.assists ?? 0}</span><span class="pm-stat-lbl">Assists</span></div>
             <div class="pm-stat"><span class="pm-stat-val">${game.saves}</span><span class="pm-stat-lbl">Saves</span></div>`}
      </div>

      <div class="post-match-section post-match-mmr-section" id="pm-mmr-section">
        <div class="post-match-section-head">
          <span>${estimated ? `Required — confirm ${meta.rankLabel}` : `Confirm ${meta.rankLabel}`}</span>
          <span class="post-match-section-sub">from ranked screen</span>
        </div>
        <div class="post-match-mmr-input-row">
          <input type="number" id="pm-mmr" class="post-match-mmr-input"
            placeholder="e.g. ${isVal ? '45' : '807'}" value="${estimated ? '' : game.endMMR}" min="0" inputmode="numeric"
            aria-label="${meta.rankLabel} from ranked screen">
          <button type="button" class="btn btn-primary" id="pm-mmr-save">Save</button>
        </div>
        ${estimated ? `<p class="post-match-mmr-hint">Auto-log estimated ${meta.diffLabel} — type the real number before your next ${isVal ? 'match' : 'game'}.</p>` : ''}
      </div>

      <div class="post-match-section">
        <div class="post-match-section-head">What went wrong?</div>
        <div class="post-match-tag-row" id="pm-tags">${renderTagButtons()}</div>
      </div>

      <div class="post-match-foot">
        <button type="button" class="btn btn-cancel" id="pm-undo">Undo log</button>
        <button type="button" class="btn btn-primary" id="pm-next"${estimated && !mmrConfirmed ? ` disabled title="Save ${meta.rankLabel} first"` : ''}>Next ${isVal ? 'match' : 'game'} →</button>
      </div>
    </div>`;
}

function pulseMmrSection() {
  const sec = document.getElementById('pm-mmr-section');
  sec?.classList.add('pm-mmr-pulse');
  setTimeout(() => sec?.classList.remove('pm-mmr-pulse'), 600);
}

function renderTagButtons() {
  const groups = getTagGroups(state.activeGame);
  return getHotTags().map(tag => {
    const cat = groups.find(g => g.tags.includes(tag))?.cat ?? (state.activeGame === GAME_IDS.VALORANT ? 'aim' : 'def');
    const sel = selectedTags.includes(tag) ? ' selected' : '';
    return `<button type="button" class="tag-chip ${cat}${sel}" data-tag="${tag}">${tag}</button>`;
  }).join('');
}

function wirePostMatch() {
  document.addEventListener('keydown', e => {
    if (document.getElementById('post-match-card')?.classList.contains('hidden')) return;
    if (e.key === 'Escape') hidePostMatchCard();
  });
}

function wireCardEvents() {
  document.getElementById('pm-dismiss')?.addEventListener('click', () => hidePostMatchCard());
  document.getElementById('pm-next')?.addEventListener('click', () => hidePostMatchCard());

  document.getElementById('pm-undo')?.addEventListener('click', async () => {
    const ok = await callbacks.onUndo?.();
    if (ok) hidePostMatchCard(true);
  });

  document.getElementById('pm-mmr-save')?.addEventListener('click', () => saveMMR());
  document.getElementById('pm-mmr')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); saveMMR(); }
  });

  document.querySelectorAll('#pm-tags [data-tag]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tag = btn.dataset.tag;
      btn.classList.toggle('selected');
      if (btn.classList.contains('selected')) {
        if (!selectedTags.includes(tag)) selectedTags.push(tag);
      } else {
        selectedTags = selectedTags.filter(t => t !== tag);
      }
      await callbacks.onTags?.(selectedTags);
    });
  });
}

async function saveMMR() {
  const meta = getGameMeta(state.activeGame);
  const val = parseInt(document.getElementById('pm-mmr')?.value, 10);
  if (!val || Number.isNaN(val)) {
    showToast(`Enter your ${meta.rankLabel} from the ranked screen`, 'error');
    pulseMmrSection();
    return;
  }
  const ok = await callbacks.onConfirmMMR?.(val);
  if (ok) {
    mmrConfirmed = true;
    needsMmrConfirm = false;
    showToast(`${meta.rankLabel} saved — ${val}`);
    document.getElementById('pm-next')?.removeAttribute('disabled');
    hidePostMatchCard(true);
  }
}
