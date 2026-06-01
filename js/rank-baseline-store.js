/** Read/write rank baselines on app state — no game module imports (avoids circular deps) */

import { state } from './state.js';

const RL = 'rocket_league';
const VAL = 'valorant';

export function getStoredRankBaseline(gameId, mode) {
  const raw = state.rankBaselines?.[gameId]?.[mode];
  if (raw == null || raw === '') return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function applyRankBaselinesFromSettings({ rankBaselines, rankBaselinesComplete } = {}) {
  state.rankBaselines = {
    [RL]: { ...(rankBaselines?.[RL] ?? rankBaselines?.rocket_league ?? {}) },
    [VAL]: { ...(rankBaselines?.[VAL] ?? rankBaselines?.valorant ?? {}) },
  };
  state.rankBaselinesComplete = Boolean(rankBaselinesComplete);
}

export function setRankBaselines(baselines, complete = true) {
  state.rankBaselines = {
    [RL]: { ...(baselines?.[RL] ?? baselines?.rocket_league ?? {}) },
    [VAL]: { ...(baselines?.[VAL] ?? baselines?.valorant ?? {}) },
  };
  state.rankBaselinesComplete = complete;
}

export function rankBaselinesForSettings() {
  return {
    rankBaselines: state.rankBaselines ?? { [RL]: {}, [VAL]: {} },
    rankBaselinesComplete: Boolean(state.rankBaselinesComplete),
  };
}
