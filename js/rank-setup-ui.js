/** First-sign-in modal — set current MMR/RR per playlist */

import { GAME_IDS, GAMES, getGameMeta } from './games.js';
import { showToast } from './ui.js';
import { bindModalA11y } from './core/modal-a11y.js';
import {
  getRankSetupModes,
  setRankBaselines,
  rankBaselinesForSettings,
  getRankBaselinesForUI,
  needsRankSetup,
} from './rank-baselines.js';

let onCompleteCallback = null;
let modalWired = false;

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function renderModeFields(gameId) {
  const meta = getGameMeta(gameId);
  const game = GAMES[gameId];
  const modes = getRankSetupModes(gameId);
  const stored = getRankBaselinesForUI()?.[gameId] ?? {};

  return `
    <section class="rank-setup-game" data-rank-game="${gameId}">
      <div class="rank-setup-game-head">
        <span class="rank-setup-game-emoji">${game.emoji}</span>
        <div>
          <h3>${game.label}</h3>
          <p class="rank-setup-game-desc">Current ${meta.rankLabel} for each playlist you play.</p>
        </div>
      </div>
      <div class="rank-setup-grid">
        ${modes.map(mode => `
          <div class="rank-setup-field">
            <label for="rank-baseline-${gameId}-${mode.replace(/[^a-z0-9]/gi, '')}">${mode}</label>
            <input
              type="number"
              id="rank-baseline-${gameId}-${mode.replace(/[^a-z0-9]/gi, '')}"
              class="setup-input rank-setup-input"
              data-game="${gameId}"
              data-mode="${escapeAttr(mode)}"
              min="0"
              inputmode="numeric"
              placeholder="${meta.rankLabel}"
              value="${stored[mode] != null && stored[mode] !== '' ? escapeAttr(stored[mode]) : ''}"
            >
          </div>
        `).join('')}
      </div>
    </section>`;
}

function renderRankSetupBody() {
  return `
    <p class="rank-setup-intro">
      Set your <strong>current rank</strong> for each playlist. The tracker uses this as your starting
      ${getGameMeta(GAME_IDS.ROCKET_LEAGUE).rankLabel}/${getGameMeta(GAME_IDS.VALORANT).rankLabel}
      until you log games — so your first match starts from the right number.
    </p>
    ${renderModeFields(GAME_IDS.ROCKET_LEAGUE)}
    ${renderModeFields(GAME_IDS.VALORANT)}
    <p class="setup-hint rank-setup-hint">Leave a playlist blank if you do not play it. You can change these later from Auto-Log Setup.</p>`;
}

function readBaselinesFromForm() {
  const out = {
    [GAME_IDS.ROCKET_LEAGUE]: {},
    [GAME_IDS.VALORANT]: {},
  };

  document.querySelectorAll('.rank-setup-input').forEach(input => {
    const gameId = input.dataset.game;
    const mode = input.dataset.mode;
    const raw = input.value.trim();
    if (!raw) return;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0) out[gameId][mode] = n;
  });

  return out;
}

function countFilledBaselines(baselines) {
  return Object.values(baselines).reduce(
    (sum, modes) => sum + Object.keys(modes).length,
    0,
  );
}

async function handleRankSetupSave({ skip = false } = {}) {
  const baselines = skip ? getRankBaselinesForUI() : readBaselinesFromForm();
  if (!skip && countFilledBaselines(baselines) === 0) {
    showToast('Enter at least one MMR or RR — or click Skip for now', 'error');
    return;
  }

  setRankBaselines(baselines, true);

  const saveBtn = document.getElementById('rank-setup-save');
  const skipBtn = document.getElementById('rank-setup-skip');
  if (saveBtn) saveBtn.disabled = true;
  if (skipBtn) skipBtn.disabled = true;

  try {
    if (window.__saveRankBaselines) {
      await window.__saveRankBaselines();
    }
    closeRankSetupModal();
    showToast(skip ? 'You can set ranks anytime in Auto-Log Setup' : 'Starting ranks saved!');
    onCompleteCallback?.();
  } catch (e) {
    showToast(e?.message || 'Could not save ranks', 'error');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
    if (skipBtn) skipBtn.disabled = false;
  }
}

function wireRankSetupModal() {
  if (modalWired) return;
  modalWired = true;

  document.getElementById('rank-setup-save')?.addEventListener('click', () => {
    void handleRankSetupSave({ skip: false });
  });
  document.getElementById('rank-setup-skip')?.addEventListener('click', () => {
    void handleRankSetupSave({ skip: true });
  });

  bindModalA11y('rank-setup-modal', {
    onClose: () => { void handleRankSetupSave({ skip: true }); },
    initialFocusId: 'rank-baseline-rocket_league-1s',
  });
}

export function openRankSetupModal({ onComplete } = {}) {
  const overlay = document.getElementById('rank-setup-modal');
  const body = document.getElementById('rank-setup-body');
  if (!overlay || !body) return;

  onCompleteCallback = onComplete ?? null;
  body.innerHTML = renderRankSetupBody();
  wireRankSetupModal();
  overlay.classList.add('open');
}

export function closeRankSetupModal() {
  document.getElementById('rank-setup-modal')?.classList.remove('open');
  onCompleteCallback = null;
}

export function showRankSetupIfNeeded({ onComplete, games = [] } = {}) {
  if (!needsRankSetup(games)) return false;
  openRankSetupModal({ onComplete });
  return true;
}

export { rankBaselinesForSettings };
