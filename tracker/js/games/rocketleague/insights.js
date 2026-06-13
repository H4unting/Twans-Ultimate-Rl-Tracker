/** Rocket League coaching insights — no Valorant references */

import {
  calcStreak, groupBySession, getMostCommonTag, sumRankDiff,
} from '../../core/game-stats.js';
import { getRollingWinrate, getTrendDirection, getPlaylistStats, getImprovementTrend } from '../../core/trends.js';
import { META, ACTION_FOCUS_TIPS, CATEGORY_LABELS } from './config.js';
import { ANALYTICS } from './meta.js';
import {
  getTagLossCorrelations, getRecurringMistakes, detectTilt, getTagCategoryBreakdown,
} from './tags.js';

export function calcInsights(games) {
  if (!games?.length) return null;
  const sessions = groupBySession(games, META.diffField);
  const bestSession = sessions.reduce((b, s) => (s.gain > b.gain ? s : b), sessions[0]);
  const worstSession = sessions.reduce((b, s) => (s.gain < b.gain ? s : b), sessions[0]);
  const playlistStats = getPlaylistStats(games, META.diffField);
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

export function getGrindRecommendation(games, stats, tilt) {
  const diffLabel = META.diffLabel;
  const last5 = games.slice(-5);
  const last5mmr = last5.reduce((s, g) => s + (g.mmrDiff || 0), 0);
  const last5wr = last5.length ? last5.filter(g => g.result === 'W').length / last5.length : 0;

  if (tilt?.active) {
    return { severity: 'stop', icon: '🛑', title: 'Stop Grinding', sub: 'Tilt detected — take 15 min off before queueing again.', cls: 'ic-red' };
  }
  if (stats.streak.type === 'L' && stats.streak.count >= 4) {
    return { severity: 'stop', icon: '🛑', title: 'Stop Grinding', sub: `${stats.streak.count} losses in a row — session quality is dropping.`, cls: 'ic-red' };
  }
  if (last5.length >= 4 && last5mmr <= -20) {
    return { severity: 'stop', icon: '⚠️', title: 'Slow Down', sub: `Last 5 games: ${last5mmr} ${diffLabel}. Review tags before continuing.`, cls: 'ic-red' };
  }
  if (last5.length >= 3 && last5wr >= 0.6 && last5mmr > 0) {
    return { severity: 'good', icon: '🔥', title: 'Keep Going', sub: `Hot streak — ${Math.round(last5wr * 100)}% WR and +${last5mmr} ${diffLabel} in last ${last5.length}.`, cls: 'ic-green' };
  }
  return { severity: 'neutral', icon: '➡️', title: 'Steady', sub: 'Performance is normal — stay focused on your mission tag.', cls: 'ic-teal' };
}

function buildSessionStats(games) {
  const wins = games.filter(g => g.result === 'W').length;
  const losses = games.filter(g => g.result === 'L').length;
  return { wins, losses, streak: calcStreak(games) };
}

export function getPerformanceInsights(games) {
  if (!games?.length) return { cards: [], report: [], actionItems: [], correlations: [] };

  const diffLabel = META.diffLabel;
  const base = calcInsights(games);
  const correlations = getTagLossCorrelations(games);
  const recurring = getRecurringMistakes(games);
  const improvement = getImprovementTrend(games);
  const { breakdown, total: tagTotal } = getTagCategoryBreakdown(games);
  const rolling5 = getRollingWinrate(games);
  const recentWR = rolling5.length ? rolling5[rolling5.length - 1].winRate : 0;
  const stats = buildSessionStats(games);
  const tilt = detectTilt(games);
  const grind = getGrindRecommendation(games, stats, tilt);

  return {
    cards: buildInsightCards(base, improvement, recurring, tilt, grind, diffLabel),
    report: buildCoachReport(base, correlations, recurring, improvement, breakdown, tagTotal, stats, tilt, grind),
    actionItems: buildActionItems(correlations, recurring, improvement, tilt, grind, stats),
    correlations, recurring, improvement, tilt, grind,
  };
}

function buildInsightCards(base, improvement, recurring, tilt, grind, diffLabel) {
  if (!base) return [];
  const trendIcon = base.trend === 'up' ? '📈' : base.trend === 'down' ? '📉' : '➡️';
  const trendColor = base.trend === 'up' ? 'ic-green' : base.trend === 'down' ? 'ic-red' : 'ic-teal';

  return [
    base.topTag && { icon: '🏷️', label: 'Top Mistake', val: base.topTag[0], sub: `${base.topTag[1]}× logged`, cls: 'ic-orange' },
    base.topLossTag && { icon: '💀', label: 'Top Loss Reason', val: base.topLossTag[0], sub: `${base.topLossTag[1]}× in losses`, cls: 'ic-red' },
    base.bestMode && {
      icon: '🏆', label: ANALYTICS.bestModeLabel, val: base.bestMode.mode,
      sub: `${base.bestMode.winRate}% WR · ${base.bestMode.games}g`, cls: 'ic-green',
    },
    base.bestSession && {
      icon: '⚡', label: 'Best Session',
      val: `${base.bestSession.gain >= 0 ? '+' : ''}${base.bestSession.gain} ${diffLabel}`,
      sub: `${base.bestSession.wins}W ${base.bestSession.losses}L`, cls: 'ic-gold',
    },
    base.worstSession && {
      icon: '💥', label: 'Worst Session', val: `${base.worstSession.gain} ${diffLabel}`,
      sub: `${base.worstSession.wins}W ${base.worstSession.losses}L`, cls: 'ic-red',
    },
    { icon: '📊', label: `Avg ${diffLabel} / Session`, val: `${base.avgMMRSess >= 0 ? '+' : ''}${base.avgMMRSess}`, sub: `over ${base.sessionCount} sessions`, cls: 'ic-teal' },
    { icon: trendIcon, label: 'Recent Trend', val: base.trend === 'up' ? 'Improving' : base.trend === 'down' ? 'Declining' : 'Stable', sub: `Last 5: ${Math.round(base.last5wr * 100)}% WR`, cls: trendColor },
    improvement.direction !== 'insufficient' && {
      icon: improvement.direction === 'improving' ? '🚀' : improvement.direction === 'declining' ? '⚠️' : '📐',
      label: 'Long-term Trend', val: `${improvement.delta >= 0 ? '+' : ''}${improvement.delta}% WR`,
      sub: `${improvement.firstHalfWR}% → ${improvement.secondHalfWR}%`,
      cls: improvement.direction === 'improving' ? 'ic-green' : improvement.direction === 'declining' ? 'ic-red' : 'ic-teal',
    },
    recurring.length > 0 && { icon: '🔁', label: 'Recurring Issue', val: recurring[0].tag, sub: `${recurring[0].count}× in last 5 games`, cls: 'ic-purple' },
    tilt.active && { icon: '😤', label: 'Tilt Detected', val: `${tilt.lossStreak}L streak`, sub: tilt.mentalTags.length ? tilt.mentalTags.join(', ') : 'Take a break', cls: 'ic-red' },
    grind && { icon: grind.icon, label: 'Grind Status', val: grind.title, sub: grind.sub, cls: grind.cls },
  ].filter(Boolean);
}

function buildCoachReport(base, correlations, recurring, improvement, breakdown, tagTotal, stats, tilt, grind) {
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
  if (topCat && tagTotal && topCat[1] > 0) {
    lines.push({ type: 'info', text: `Most mistakes are ${CATEGORY_LABELS[topCat[0]] ?? topCat[0]} (${Math.round(topCat[1] / tagTotal * 100)}% of tags).` });
  }
  if (stats.streak.type === 'L' && stats.streak.count >= 3) {
    lines.push({ type: 'warning', text: `${stats.streak.count}-game loss streak — consider ending session.` });
  }
  if (tilt.active) {
    lines.push({ type: 'warning', text: `Tilt signals detected: ${tilt.lossStreak}-loss streak${tilt.mentalTags.length ? ` with ${tilt.mentalTags.join(', ')}` : ''}. Stop and reset.` });
  }
  if (grind?.severity === 'stop') lines.push({ type: 'warning', text: grind.sub });
  else if (grind?.severity === 'good') lines.push({ type: 'positive', text: grind.sub });
  return lines;
}

function buildActionItems(correlations, recurring, improvement, tilt, grind, stats) {
  const items = [];
  const tips = ACTION_FOCUS_TIPS;
  const losses = stats.losses || 0;
  if (grind?.severity === 'stop') {
    items.push({ priority: 1, type: 'stop', text: grind.sub, title: grind.title ?? 'Stop Grinding' });
  }
  if (recurring.length) {
    const tag = recurring[0].tag;
    items.push({
      priority: 2, type: 'focus', tag, lossPct: null,
      focus: tips[tag] ?? `Drill ${tag} — it appeared ${recurring[0].count}× in your last 5 games.`,
      text: `Drill: ${tag} — appeared ${recurring[0].count}× in last 5 games.`,
    });
  }
  if (correlations[0]?.correlation >= 60) {
    const c = correlations[0];
    items.push({
      priority: 3, type: 'fix', tag: c.tag,
      lossPct: losses ? Math.round(c.inLosses / losses * 100) : c.correlation,
      focus: tips[c.tag] ?? 'Review what triggers this after each loss.',
      text: `Fix ${c.tag} — linked to ${c.correlation}% of tagged losses.`,
    });
  }
  if (improvement.direction === 'declining') {
    items.push({
      priority: 4, type: 'review',
      text: ANALYTICS.reviewDeclineTip.replace('{delta}', String(Math.abs(improvement.delta))),
    });
  }
  if (stats.streak.type === 'W' && stats.streak.count >= 3) {
    items.push({ priority: 5, type: 'positive', text: `${stats.streak.count}-game win streak — maintain discipline, don't overcommit.` });
  }
  if (!items.length) {
    items.push({ priority: 99, type: 'info', text: 'Keep logging games and tagging mistakes for sharper coaching insights.' });
  }
  return items.sort((a, b) => a.priority - b.priority);
}

export { getTagLossCorrelations, getRecurringMistakes, detectTilt };
