/** Rocket League game module — entry point */

export { GAME_ID, META, PLAYLISTS, MODES, TAG_DEFINITIONS, TAG_GROUPS, TAG_COLORS, CATEGORY_LABELS, CATEGORY_ORDER, ACTION_FOCUS_TIPS, filterByPlaylist, getRankValue, getRankDiff, getPriorEndRank, isRankEstimated } from './config.js';
export { normalizeGame } from './normalize.js';
export { buildGameFromForm, buildGameUpdate, patchLastGameRank } from './matches.js';
export { repairRankChain, repairPlaylistMMRChain, resolveGameStartRank, resolveGameStartMMR, estimateMMRDelta, estimateRankDelta, getPriorEndMMRForMode } from './rank-chain.js';
export { NAV, PAGE_COPY, ANALYTICS } from './meta.js';
export { getTagCat, getTagCategoryBreakdown, getTagTrendBuckets, getTagLossCorrelations, getRecurringMistakes, detectTilt } from './tags.js';
export { getPlaylistRankRows, getRankGain, getCurrentRankForMode, getMostRecentMode } from './stats.js';
export { getPerformanceInsights, calcInsights, getGrindRecommendation } from './insights.js';
export { buildWeeklyReport, getWeeklyReports } from './reports.js';
export * from './ranks.js';

export function onLoad() {
  /* RL-specific boot hooks (MMR chain repair runs from app.js) */
}

export function getAgents() {
  return [];
}

export function getMaps() {
  return [];
}
