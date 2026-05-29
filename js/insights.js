/** Performance insight engine — coach-style analytics derived from match data */

import {
  calcStats, groupBySession, getMostCommonTag, getPlaylistStats,
  getRollingWinrate, getTrendDirection, countTags, getTagCategoryBreakdown,
} from './utils.js';
import { TAG_DEFINITIONS } from './config.js';

export function calcInsights(games) {
  if (!games?.length) return null;

  const sessions = groupBySession(games);
  const bestSession = sessions.reduce((b, s) => (s.gain > b.gain ? s : b), sessions[0]);
  const worstSession = sessions.reduce((b, s) => (s.gain < b.gain ? s : b), sessions[0]);
  const playlistStats = getPlaylistStats(games);
  const bestMode = playlistStats[0] ?? null;
  const topTag = getMostCommonTag(games);
  const topLossTag = getMostCommonTag(games, { lossesOnly: true });
  const trend = getTrendDirection(games);
  const last5 = games.slice(-5);
  const prev5 = games.slice(-10, -5);
  const last5wr = last5.length ? last5.filter(g => g.result === 'W').length / last5.length : 0;
  const prev5wr = prev5.length ? prev5.filter(g => g.result === 'W').length / prev5.length : null;
  const avgMMRSess = sessions.length
    ? Math.round(sessions.reduce((s, x) => s + x.gain, 0) / sessions.length)
    : 0;

  return {
    bestSession, worstSession, bestMode, topTag, topLossTag,
    trend, last5wr, prev5wr, avgMMRSess, sessionCount: sessions.length,
  };
}

/** Tag correlation with losses — which mistakes appear most in L games */
export function getTagLossCorrelations(games) {
  const allCounts = countTags(games);
  const lossCounts = countTags(games, { lossesOnly: true });
  const losses = games.filter(g => g.result === 'L').length;
  return Object.keys(allCounts).map(tag => ({
    tag,
    cat: TAG_DEFINITIONS[tag]?.cat ?? 'def',
    total: allCounts[tag],
    inLosses: lossCounts[tag] ?? 0,
    lossRate: losses ? Math.round((lossCounts[tag] ?? 0) / losses * 100) : 0,
    correlation: allCounts[tag] ? Math.round((lossCounts[tag] ?? 0) / allCounts[tag] * 100) : 0,
  })).sort((a, b) => b.correlation - a.correlation || b.inLosses - a.inLosses);
}

/** Recurring mistakes — tags appearing in 2+ of last 5 games */
export function getRecurringMistakes(games, windowSize = 5) {
  const recent = games.slice(-windowSize);
  const counts = countTags(recent);
  return Object.entries(counts)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count, cat: TAG_DEFINITIONS[tag]?.cat }));
}

/** Best session times — sessions ranked by MMR gain */
export function getBestSessions(games, limit = 3) {
  return groupBySession(games)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, limit);
}

/** Improvement trend over time — compare first half vs second half WR */
export function getImprovementTrend(games) {
  if (games.length < 6) return { direction: 'insufficient', delta: 0 };
  const mid = Math.floor(games.length / 2);
  const firstHalf = games.slice(0, mid);
  const secondHalf = games.slice(mid);
  const wr1 = firstHalf.filter(g => g.result === 'W').length / firstHalf.length;
  const wr2 = secondHalf.filter(g => g.result === 'W').length / secondHalf.length;
  const delta = Math.round((wr2 - wr1) * 100);
  return {
    direction: delta > 5 ? 'improving' : delta < -5 ? 'declining' : 'stable',
    delta,
    firstHalfWR: Math.round(wr1 * 100),
    secondHalfWR: Math.round(wr2 * 100),
  };
}

/** Build full performance insight report for UI */
export function getPerformanceInsights(games) {
  if (!games?.length) return { cards: [], report: [] };

  const base = calcInsights(games);
  const correlations = getTagLossCorrelations(games);
  const recurring = getRecurringMistakes(games);
  const improvement = getImprovementTrend(games);
  const { breakdown, total: tagTotal } = getTagCategoryBreakdown(games);
  const rolling5 = getRollingWinrate(games, 5);
  const recentWR = rolling5.length ? rolling5[rolling5.length - 1].winRate : 0;
  const stats = calcStats(games);

  const cards = buildInsightCards(base, improvement, recurring, recentWR);
  const report = buildCoachReport(base, correlations, recurring, improvement, breakdown, tagTotal, stats);

  return { cards, report, correlations, recurring, improvement };
}

function buildInsightCards(base, improvement, recurring, recentWR) {
  if (!base) return [];
  const trendIcon = base.trend === 'up' ? '📈' : base.trend === 'down' ? '📉' : '➡️';
  const trendColor = base.trend === 'up' ? 'ic-green' : base.trend === 'down' ? 'ic-red' : 'ic-teal';

  return [
    base.topTag && { icon: '🏷️', label: 'Top Mistake', val: base.topTag[0], sub: `${base.topTag[1]}× logged`, cls: 'ic-orange' },
    base.topLossTag && { icon: '💀', label: 'Top Loss Reason', val: base.topLossTag[0], sub: `${base.topLossTag[1]}× in losses`, cls: 'ic-red' },
    base.bestMode && { icon: '🏆', label: 'Strongest Playlist', val: base.bestMode.mode, sub: `${base.bestMode.winRate}% WR · ${base.bestMode.games}g`, cls: 'ic-green' },
    base.bestSession && { icon: '⚡', label: 'Best Session', val: `${base.bestSession.gain >= 0 ? '+' : ''}${base.bestSession.gain} MMR`, sub: `${base.bestSession.wins}W ${base.bestSession.losses}L`, cls: 'ic-gold' },
    base.worstSession && { icon: '💥', label: 'Worst Session', val: `${base.worstSession.gain} MMR`, sub: `${base.worstSession.wins}W ${base.worstSession.losses}L`, cls: 'ic-red' },
    { icon: '📊', label: 'Avg MMR / Session', val: `${base.avgMMRSess >= 0 ? '+' : ''}${base.avgMMRSess}`, sub: `over ${base.sessionCount} sessions`, cls: 'ic-teal' },
    { icon: trendIcon, label: 'Recent Trend', val: base.trend === 'up' ? 'Improving' : base.trend === 'down' ? 'Declining' : 'Stable', sub: `Last 5: ${Math.round(base.last5wr * 100)}% WR`, cls: trendColor },
    improvement.direction !== 'insufficient' && {
      icon: improvement.direction === 'improving' ? '🚀' : improvement.direction === 'declining' ? '⚠️' : '📐',
      label: 'Long-term Trend',
      val: `${improvement.delta >= 0 ? '+' : ''}${improvement.delta}% WR`,
      sub: `${improvement.firstHalfWR}% → ${improvement.secondHalfWR}%`,
      cls: improvement.direction === 'improving' ? 'ic-green' : improvement.direction === 'declining' ? 'ic-red' : 'ic-teal',
    },
    recurring.length > 0 && {
      icon: '🔁', label: 'Recurring Issue', val: recurring[0].tag,
      sub: `${recurring[0].count}× in last 5 games`, cls: 'ic-purple',
    },
  ].filter(Boolean);
}

function buildCoachReport(base, correlations, recurring, improvement, breakdown, tagTotal, stats) {
  const lines = [];
  if (base.topLossTag) {
    lines.push({ type: 'warning', text: `"${base.topLossTag[0]}" appears in ${base.topLossTag[1]} losses — prioritize fixing this.` });
  }
  if (correlations[0]?.correlation >= 70) {
    lines.push({ type: 'warning', text: `"${correlations[0].tag}" correlates with ${correlations[0].correlation}% of tagged losses.` });
  }
  if (recurring.length) {
    lines.push({ type: 'focus', text: `Recurring: ${recurring.map(r => r.tag).join(', ')} — showing up repeatedly.` });
  }
  if (improvement.direction === 'improving') {
    lines.push({ type: 'positive', text: `Win rate up ${improvement.delta}% compared to earlier games. Keep grinding.` });
  } else if (improvement.direction === 'declining') {
    lines.push({ type: 'warning', text: `Win rate down ${Math.abs(improvement.delta)}% — review recent tags and take a break if tilting.` });
  }
  if (base.bestMode) {
    lines.push({ type: 'info', text: `Strongest in ${base.bestMode.mode} (${base.bestMode.winRate}% WR). Consider focusing there.` });
  }
  const topCat = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0];
  if (topCat && tagTotal) {
    const labels = { def: 'Defensive', off: 'Offensive', men: 'Mental' };
    lines.push({ type: 'info', text: `Most mistakes are ${labels[topCat[0]]} (${Math.round(topCat[1] / tagTotal * 100)}% of tags).` });
  }
  if (stats.streak.type === 'L' && stats.streak.count >= 3) {
    lines.push({ type: 'warning', text: `${stats.streak.count}-game loss streak — consider ending session.` });
  }
  return lines;
}
