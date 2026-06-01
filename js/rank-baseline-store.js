/** Rank baseline storage — standalone (no state/registry imports) */

const RL = 'rocket_league';
const VAL = 'valorant';

const baselines = {
  [RL]: {},
  [VAL]: {},
};

let complete = false;

function normalizeGameKey(gameId) {
  if (gameId === VAL || gameId === 'valorant') return VAL;
  return RL;
}

export function getStoredRankBaseline(gameId, mode) {
  const raw = baselines[normalizeGameKey(gameId)]?.[mode];
  if (raw == null || raw === '') return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function getRankBaselinesSnapshot() {
  return {
    [RL]: { ...baselines[RL] },
    [VAL]: { ...baselines[VAL] },
  };
}

export function isRankBaselinesComplete() {
  return complete;
}

export function applyRankBaselinesFromSettings({ rankBaselines, rankBaselinesComplete } = {}) {
  baselines[RL] = { ...(rankBaselines?.[RL] ?? rankBaselines?.rocket_league ?? {}) };
  baselines[VAL] = { ...(rankBaselines?.[VAL] ?? rankBaselines?.valorant ?? {}) };
  complete = Boolean(rankBaselinesComplete);
}

export function setRankBaselines(next, markComplete = true) {
  baselines[RL] = { ...(next?.[RL] ?? next?.rocket_league ?? {}) };
  baselines[VAL] = { ...(next?.[VAL] ?? next?.valorant ?? {}) };
  complete = markComplete;
}

export function rankBaselinesForSettings() {
  return {
    rankBaselines: getRankBaselinesSnapshot(),
    rankBaselinesComplete: complete,
  };
}
