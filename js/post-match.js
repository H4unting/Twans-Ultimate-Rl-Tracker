/** Post-match card — confirm MMR, tags, undo after auto/manual log */

import { TAG_GROUPS } from './config.js';
import { showToast } from './ui.js';

const HOT_TAGS = ['Tilt', 'Autopilot', 'Bad Positioning', 'Overcommitting', 'Giving Away Possession', 'Hesitation'];
let dismissTimer = null;
let currentMatch = null;
let selectedTags = [];
let callbacks = {};
let wired = false;

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

  const win = game.result === 'W';
  el.innerHTML = `
    <div class="post-match-inner ${win ? 'pm-win' : 'pm-loss'}">
      <div class="post-match-head">
        <div class="post-match-result">
          <span class="post-match-badge ${win ? 'win' : 'loss'}">${win ? 'WIN' : 'LOSS'}</span>
          <span class="post-match-mode">${game.mode}</span>
        </div>
        <button type="button" class="post-match-close" id="pm-dismiss" aria-label="Dismiss">✕</button>
      </div>
      <div class="post-match-stats">
        <span>G <strong>${game.goals}</strong></span>
        <span>A <strong>${game.assists ?? 0}</strong></span>
        <span>S <strong>${game.saves}</strong></span>
        <span class="post-match-mmr-est ${estimated ? 'estimated' : ''}">
          ${estimated ? '~' : ''}${game.mmrDiff >= 0 ? '+' : ''}${game.mmrDiff} MMR
        </span>
      </div>
      <div class="post-match-mmr-row">
        <label for="pm-mmr">MMR from ranked screen</label>
        <div class="post-match-mmr-input-row">
          <input type="number" id="pm-mmr" class="post-match-mmr-input"
            placeholder="Type exact MMR" value="${estimated ? '' : game.endMMR}" min="0" inputmode="numeric">
          <button type="button" class="btn btn-primary btn-sm" id="pm-mmr-save">Save</button>
        </div>
        ${estimated ? '<p class="post-match-mmr-hint">Auto-log estimated MMR — check ranked screen and type the real number.</p>' : ''}
      </div>
      <div class="post-match-tags">
        <span class="post-match-tags-label">Quick tags</span>
        <div class="post-match-tag-row" id="pm-tags">${renderTagButtons()}</div>
      </div>
      <div class="post-match-actions">
        <button type="button" class="btn btn-cancel btn-sm" id="pm-undo">Undo log</button>
        <button type="button" class="btn btn-primary btn-sm" id="pm-next">Next game →</button>
      </div>
    </div>`;

  el.classList.remove('hidden');
  wireCardEvents();
  clearTimeout(dismissTimer);
  dismissTimer = setTimeout(hidePostMatchCard, 60000);
  setTimeout(() => document.getElementById('pm-mmr')?.focus(), 120);
}

export function hidePostMatchCard() {
  document.getElementById('post-match-card')?.classList.add('hidden');
  clearTimeout(dismissTimer);
  currentMatch = null;
  selectedTags = [];
}

function renderTagButtons() {
  return HOT_TAGS.map(tag => {
    const cat = TAG_GROUPS.find(g => g.tags.includes(tag))?.cat ?? 'def';
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
  document.getElementById('pm-dismiss')?.addEventListener('click', hidePostMatchCard);
  document.getElementById('pm-next')?.addEventListener('click', hidePostMatchCard);

  document.getElementById('pm-undo')?.addEventListener('click', async () => {
    const ok = await callbacks.onUndo?.();
    if (ok) hidePostMatchCard();
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
  const val = parseInt(document.getElementById('pm-mmr')?.value, 10);
  if (!val || Number.isNaN(val)) {
    showToast('Enter your MMR from the ranked screen', 'error');
    return;
  }
  const ok = await callbacks.onConfirmMMR?.(val);
  if (ok) {
    showToast(`MMR saved — ${val}`);
    hidePostMatchCard();
  }
}
