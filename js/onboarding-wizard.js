/** First-run onboarding — games → RL MMR → Val rank → Val RR */

import { GAME_IDS, GAMES, getQueueLabel } from './games.js';
import { loadPrefs, savePrefs } from './quicklog.js';
import { setActiveGame } from './state.js';
import { routeActiveGame } from './games/router.js';
import { bindModalA11y } from './core/modal-a11y.js';
import {
  getRankSetupModes,
  setRankBaselines,
  getRankBaselinesForUI,
} from './rank-baselines.js';
import {
  rankLadderSelectHTML,
  parseValorantBaseline,
  serializeValorantBaseline,
} from './games/valorant/rank-ladder.js';
import { getGameMeta } from './games.js';
import { showToast } from './ui.js';

const ONBOARDING_KEY = 'rl-grind-onboarding';

function loadOnboarding() {
  try {
    return { complete: false, games: [], step: 'games', ...JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? '{}') };
  } catch {
    return { complete: false, games: [], step: 'games' };
  }
}

function saveOnboarding(partial) {
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ ...loadOnboarding(), ...partial }));
}

export function isOnboardingComplete() {
  return loadOnboarding().complete;
}

export function markOnboardingComplete() {
  saveOnboarding({ complete: true, step: 'done' });
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function buildStepPlan(picks) {
  const steps = ['games'];
  if (picks.includes(GAME_IDS.ROCKET_LEAGUE)) steps.push('rl-mmr');
  if (picks.includes(GAME_IDS.VALORANT)) {
    steps.push('val-rank');
    steps.push('val-rr');
  }
  return steps;
}

function renderGamesStep(selected) {
  return `
    <p class="onboarding-intro">Pick the games you grind. We'll set your starting rank next so your first match logs correctly.</p>
    <div class="onboarding-game-grid">
      ${Object.values(GAMES).map(g => `
        <label class="onboarding-game-card${selected.has(g.id) ? ' selected' : ''}">
          <input type="checkbox" class="onboarding-game-check" value="${g.id}"${selected.has(g.id) ? ' checked' : ''}>
          <span class="onboarding-game-emoji">${g.emoji}</span>
          <span class="onboarding-game-label">${g.label}</span>
        </label>`).join('')}
    </div>
    <p class="setup-hint">You can switch games anytime from the header.</p>`;
}

function renderRlMmrStep() {
  const meta = getGameMeta(GAME_IDS.ROCKET_LEAGUE);
  const stored = getRankBaselinesForUI()?.[GAME_IDS.ROCKET_LEAGUE] ?? {};
  const modes = getRankSetupModes(GAME_IDS.ROCKET_LEAGUE);
  return `
    <p class="onboarding-intro">Set your current <strong>${meta.rankLabel}</strong> for each Rocket League playlist you play.</p>
    <div class="rank-setup-grid">
      ${modes.map(mode => {
        const slug = mode.replace(/[^a-z0-9]/gi, '');
        const raw = stored[mode];
        return `
          <div class="rank-setup-field">
            <label for="onboard-rl-${slug}">${mode}</label>
            <input type="number" id="onboard-rl-${slug}" class="setup-input onboarding-baseline-input"
              data-game="${GAME_IDS.ROCKET_LEAGUE}" data-mode="${escapeAttr(mode)}"
              min="0" inputmode="numeric" placeholder="${meta.rankLabel}"
              value="${raw != null && raw !== '' ? escapeAttr(raw) : ''}">
          </div>`;
      }).join('')}
    </div>
    <p class="setup-hint">Leave a playlist blank if you don't play it.</p>`;
}

function renderValRankStep() {
  const modes = getRankSetupModes(GAME_IDS.VALORANT);
  const stored = getRankBaselinesForUI()?.[GAME_IDS.VALORANT] ?? {};
  const rankOpts = rankLadderSelectHTML();
  return `
    <p class="onboarding-intro">Choose your current <strong>Valorant rank</strong> for each queue you play.</p>
    <div class="rank-setup-grid">
      ${modes.map(mode => {
        const slug = mode.replace(/[^a-z0-9]/gi, '');
        const parsed = parseValorantBaseline(stored[mode]);
        return `
          <div class="rank-setup-field rank-setup-field-val">
            <span class="rank-setup-field-label">${getQueueLabel(mode, GAME_IDS.VALORANT)}</span>
            <select id="onboard-val-rank-${slug}" class="setup-input onboarding-val-rank"
              data-mode="${escapeAttr(mode)}" aria-label="${getQueueLabel(mode, GAME_IDS.VALORANT)} rank">
              ${rankOpts}
            </select>
          </div>`;
      }).join('')}
    </div>`;
}

function renderValRrStep(valRanks) {
  const modes = getRankSetupModes(GAME_IDS.VALORANT);
  const stored = getRankBaselinesForUI()?.[GAME_IDS.VALORANT] ?? {};
  return `
    <p class="onboarding-intro">Enter your <strong>RR within that rank</strong> (0–100) so your first match starts from the right number.</p>
    <div class="rank-setup-grid">
      ${modes.map(mode => {
        const slug = mode.replace(/[^a-z0-9]/gi, '');
        const parsed = parseValorantBaseline(stored[mode]);
        const rank = valRanks[mode] || parsed?.rank || 'Iron 1';
        return `
          <div class="rank-setup-field rank-setup-field-val">
            <span class="rank-setup-field-label">${getQueueLabel(mode, GAME_IDS.VALORANT)} · ${rank}</span>
            <input type="number" id="onboard-val-rr-${slug}" class="setup-input onboarding-val-rr"
              data-mode="${escapeAttr(mode)}" data-rank="${escapeAttr(rank)}"
              min="0" max="100" inputmode="numeric" placeholder="RR"
              value="${parsed?.rr != null ? escapeAttr(parsed.rr) : ''}">
          </div>`;
      }).join('')}
    </div>`;
}

function readRlBaselinesFromForm() {
  const out = {};
  document.querySelectorAll('.onboarding-baseline-input').forEach(input => {
    const mode = input.dataset.mode;
    const raw = input.value.trim();
    if (!raw) return;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0) out[mode] = n;
  });
  return out;
}

function readValRanksFromForm() {
  const out = {};
  document.querySelectorAll('.onboarding-val-rank').forEach(sel => {
    out[sel.dataset.mode] = sel.value;
  });
  return out;
}

function readValRrBaselines(valRanks) {
  const out = {};
  document.querySelectorAll('.onboarding-val-rr').forEach(input => {
    const mode = input.dataset.mode;
    const rank = valRanks[mode] || input.dataset.rank;
    const rrRaw = input.value.trim();
    if (!rank || !rrRaw) return;
    const rr = parseInt(rrRaw, 10);
    if (Number.isFinite(rr) && rr >= 0) {
      out[mode] = serializeValorantBaseline({ rank, rr });
    }
  });
  return out;
}

function mergeBaselines(partial) {
  const current = getRankBaselinesForUI() ?? {};
  return {
    [GAME_IDS.ROCKET_LEAGUE]: { ...current[GAME_IDS.ROCKET_LEAGUE], ...partial[GAME_IDS.ROCKET_LEAGUE] },
    [GAME_IDS.VALORANT]: { ...current[GAME_IDS.VALORANT], ...partial[GAME_IDS.VALORANT] },
  };
}

async function finishOnboarding(onComplete) {
  setRankBaselines(getRankBaselinesForUI(), true);
  try {
    if (window.__saveRankBaselines) await window.__saveRankBaselines();
  } catch (e) {
    showToast(e?.message || 'Saved locally — will sync when online', 'error');
  }
  markOnboardingComplete();
  document.getElementById('onboarding-modal')?.classList.remove('open');
  onComplete?.();
}

function renderStep(step, { picks, valRanks }) {
  const title = document.getElementById('onboarding-title');
  const sub = document.querySelector('#onboarding-modal .modal-sub');
  const continueBtn = document.getElementById('onboarding-continue');

  const labels = {
    games: ['Welcome — pick your games', 'Choose what you track. Rank setup is next.'],
    'rl-mmr': ['Rocket League starting MMR', 'Your current MMR before the first logged match.'],
    'val-rank': ['Valorant starting rank', 'Pick your current tier for each queue.'],
    'val-rr': ['Valorant RR within rank', 'How much RR you have in that rank right now (0–100).'],
  };
  const [head, hint] = labels[step] || labels.games;
  if (title) title.textContent = head;
  if (sub) sub.textContent = hint;
  if (continueBtn) continueBtn.textContent = step === 'val-rr' || (step === 'rl-mmr' && !picks.includes(GAME_IDS.VALORANT))
    ? 'Finish setup'
    : 'Continue →';

  const body = document.getElementById('onboarding-body');
  if (!body) return;

  if (step === 'games') {
    const prefs = loadPrefs();
    const selected = new Set(picks.length ? picks : [prefs.activeGame || GAME_IDS.ROCKET_LEAGUE]);
    body.innerHTML = renderGamesStep(selected);
    body.querySelectorAll('.onboarding-game-check').forEach(input => {
      input.addEventListener('change', () => {
        body.querySelectorAll('.onboarding-game-card').forEach(card => {
          const cb = card.querySelector('.onboarding-game-check');
          card.classList.toggle('selected', cb?.checked);
        });
      });
    });
    return;
  }
  if (step === 'rl-mmr') {
    body.innerHTML = renderRlMmrStep();
    return;
  }
  if (step === 'val-rank') {
    body.innerHTML = renderValRankStep();
    getRankSetupModes(GAME_IDS.VALORANT).forEach(mode => {
      const slug = mode.replace(/[^a-z0-9]/gi, '');
      const parsed = parseValorantBaseline(getRankBaselinesForUI()?.[GAME_IDS.VALORANT]?.[mode]);
      const sel = document.getElementById(`onboard-val-rank-${slug}`);
      if (sel && parsed?.rank) sel.value = parsed.rank;
    });
    return;
  }
  if (step === 'val-rr') {
    body.innerHTML = renderValRrStep(valRanks);
  }
}

export function showOnboardingIfNeeded({ onComplete, games = [] } = {}) {
  if (isOnboardingComplete()) return false;
  if (games.length > 0) {
    markOnboardingComplete();
    return false;
  }

  const overlay = document.getElementById('onboarding-modal');
  if (!overlay) return false;

  const stored = loadOnboarding();
  let picks = stored.games?.length ? [...stored.games] : [];
  let valRanks = {};
  let step = stored.step && stored.step !== 'done' ? stored.step : 'games';
  const plan = () => buildStepPlan(picks);

  if (!overlay.dataset.a11y) {
    overlay.dataset.a11y = '1';
    bindModalA11y('onboarding-modal', { initialFocusId: 'onboarding-continue' });
  }

  const advance = async () => {
    const steps = plan();
    const idx = steps.indexOf(step);

    if (step === 'games') {
      const body = document.getElementById('onboarding-body');
      picks = [...body.querySelectorAll('.onboarding-game-check:checked')].map(el => el.value);
      if (!picks.length) return;
      saveOnboarding({ games: picks });
      const prefs = loadPrefs();
      const primary = picks.includes(prefs.activeGame) ? prefs.activeGame : picks[0];
      setActiveGame(primary);
      routeActiveGame(primary);
      savePrefs({ activeGame: primary });
    } else if (step === 'rl-mmr') {
      const rl = readRlBaselinesFromForm();
      setRankBaselines(mergeBaselines({ [GAME_IDS.ROCKET_LEAGUE]: rl }), false);
    } else if (step === 'val-rank') {
      valRanks = readValRanksFromForm();
      saveOnboarding({ valRanks });
    } else if (step === 'val-rr') {
      const val = readValRrBaselines(valRanks);
      setRankBaselines(mergeBaselines({ [GAME_IDS.VALORANT]: val }), false);
      await finishOnboarding(onComplete);
      return;
    }

    const next = steps[idx + 1];
    if (!next) {
      await finishOnboarding(onComplete);
      return;
    }
    step = next;
    saveOnboarding({ step });
    renderStep(step, { picks, valRanks: stored.valRanks ?? valRanks });
  };

  const continueBtn = document.getElementById('onboarding-continue');
  if (continueBtn && !continueBtn.dataset.wired) {
    continueBtn.dataset.wired = '1';
    continueBtn.addEventListener('click', () => { void advance(); });
  }

  if (!picks.length) {
    const prefs = loadPrefs();
    picks = [prefs.activeGame || GAME_IDS.ROCKET_LEAGUE];
  }
  if (!plan().includes(step)) step = plan()[0] || 'games';
  renderStep(step, { picks, valRanks: stored.valRanks ?? {} });
  overlay.classList.add('open');
  return true;
}
