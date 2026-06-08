/** Valorant game module — entry point */

import { AGENTS, MAPS } from './config.js';

export { GAME_ID, META, PLAYLISTS, AGENTS, MAPS, TAG_DEFINITIONS, TAG_GROUPS, TAG_COLORS, CATEGORY_LABELS, CATEGORY_ORDER, ACTION_FOCUS_TIPS, DEFAULT_RR_SWING, filterByPlaylist, getRankValue, getRankDiff, getPriorEndRank, getPriorEndRankState, isRankEstimated } from './config.js';
export { normalizeGame } from './normalize.js';
export { buildGameFromForm, buildGameUpdate, patchLastGameRank } from './matches.js';
export { repairRankChain, resolveGameStartRank, resolveGameStartRankState, applyPromotion, estimateRankDelta } from './rank-chain.js';
export * from './rank-ladder.js';
export { NAV, PAGE_COPY, ANALYTICS } from './meta.js';
export { getTagCat, getTagCategoryBreakdown, getTagTrendBuckets, getTagLossCorrelations, getRecurringMistakes, detectTilt } from './tags.js';
export { getPlaylistRankRows, getRankGain, getCurrentRankForMode, getMostRecentMode } from './stats.js';
export { getPerformanceInsights, calcInsights, getGrindRecommendation } from './insights.js';
export { buildWeeklyReport, getWeeklyReports } from './reports.js';
export * from './ranks.js';

export function getAgents() {
  return AGENTS;
}

export function getMaps() {
  return MAPS;
}
