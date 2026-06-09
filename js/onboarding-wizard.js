/** First-run onboarding — game selection then rank baselines */

import { GAME_IDS, GAMES } from './games.js';
import { loadPrefs, savePrefs } from './quicklog.js';
import { setActiveGame } from './state.js';
import { routeActiveGame } from './games/router.js';
import { openRankSetupModal } from './rank-setup-ui.js';
import { bindModalA11y } from './core/modal-a11y.js';

const ONBOARDING_KEY = 'rl-grind-onboarding';

function loadOnboarding() {
  try {
    return { complete: false, games: [], ...JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? '{}') };
  } catch {
    return { complete: false, games: [] };
  }
}

function saveOnboarding(partial) {
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ ...loadOnboarding(), ...partial }));
}

export function isOnboardingComplete() {
  return loadOnboarding().complete;
}

export function markOnboardingComplete() {
  saveOnboarding({ complete: true });
}

export function showOnboardingIfNeeded({ onComplete, games = [] } = {}) {
  if (isOnboardingComplete()) return false;
  if (games.length > 0) {
    markOnboardingComplete();
    return false;
  }

  const overlay = document.getElementById('onboarding-modal');
  const body = document.getElementById('onboarding-body');
  if (!overlay || !body) return false;

  const prefs = loadPrefs();
  const selected = new Set(loadOnboarding().games.length
    ? loadOnboarding().games
    : [prefs.activeGame || GAME_IDS.ROCKET_LEAGUE]);

  body.innerHTML = `
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

  const syncCards = () => {
    body.querySelectorAll('.onboarding-game-card').forEach(card => {
      const input = card.querySelector('.onboarding-game-check');
      card.classList.toggle('selected', input?.checked);
    });
  };

  body.querySelectorAll('.onboarding-game-check').forEach(input => {
    input.addEventListener('change', syncCards);
  });

  const continueBtn = document.getElementById('onboarding-continue');
  if (continueBtn && !continueBtn.dataset.wired) {
    continueBtn.dataset.wired = '1';
    continueBtn.addEventListener('click', () => {
      const picks = [...body.querySelectorAll('.onboarding-game-check:checked')].map(el => el.value);
      if (!picks.length) return;
      saveOnboarding({ games: picks });
      const primary = picks.includes(prefs.activeGame) ? prefs.activeGame : picks[0];
      setActiveGame(primary);
      routeActiveGame(primary);
      savePrefs({ activeGame: primary });
      overlay.classList.remove('open');
      openRankSetupModal({
        onComplete: () => {
          markOnboardingComplete();
          onComplete?.();
        },
      });
    });
  }

  if (!overlay.dataset.a11y) {
    overlay.dataset.a11y = '1';
    bindModalA11y('onboarding-modal', { initialFocusId: 'onboarding-continue' });
  }

  overlay.classList.add('open');
  return true;
}
