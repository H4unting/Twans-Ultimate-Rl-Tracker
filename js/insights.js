/** Performance insight engine — coach-style analytics derived from match data */

import {
  calcStats, groupBySession, getMostCommonTag, getPlaylistStats,
  getRollingWinrate, getTrendDirection, countTags, getTagCategoryBreakdown,
} from './utils.js';
import {
  DEFAULT_GAME, getTagDefinitions, getActionFocusTips, getCategoryLabels, getGameMeta, GAME_IDS,
} from './games.js';

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
export function getTagLossCorrelations(games, gameId = DEFAULT_GAME) {
  const defs = getTagDefinitions(gameId);
  const allCounts = countTags(games);
  const lossCounts = countTags(games, { lossesOnly: true });
  const losses = games.filter(g => g.result === 'L').length;
  return Object.keys(allCounts).map(tag => ({
    tag,
    cat: defs[tag]?.cat ?? (gameId === GAME_IDS.VALORANT ? 'aim' : 'def'),
    total: allCounts[tag],
    inLosses: lossCounts[tag] ?? 0,
    lossRate: losses ? Math.round((lossCounts[tag] ?? 0) / losses * 100) : 0,
    correlation: allCounts[tag] ? Math.round((lossCounts[tag] ?? 0) / allCounts[tag] * 100) : 0,
  })).sort((a, b) => b.correlation - a.correlation || b.inLosses - a.inLosses);
}

/** Recurring mistakes — tags appearing in 2+ of last 5 games */
export function getRecurringMistakes(games, windowSize = 5, gameId = DEFAULT_GAME) {
  const defs = getTagDefinitions(gameId);
  const recent = games.slice(-windowSize);
  const counts = countTags(recent);
  return Object.entries(counts)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count, cat: defs[tag]?.cat }));
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
export function getPerformanceInsights(games, gameId = DEFAULT_GAME) {
  if (!games?.length) return { cards: [], report: [], actionItems: [], correlations: [] };

  const meta = getGameMeta(gameId);
  const diffLabel = meta.diffLabel;
  const base = calcInsights(games);
  const correlations = getTagLossCorrelations(games, gameId);
  const recurring = getRecurringMistakes(games, 5, gameId);
  const improvement = getImprovementTrend(games);
  const { breakdown, total: tagTotal } = getTagCategoryBreakdown(games, gameId);
  const rolling5 = getRollingWinrate(games, 5);
  const recentWR = rolling5.length ? rolling5[rolling5.length - 1].winRate : 0;
  const stats = calcStats(games);
  const tilt = detectTilt(games, 4, gameId);
  const grind = getGrindRecommendation(games, stats, tilt, gameId);
  const catLabels = getCategoryLabels(gameId);

  const cards = buildInsightCards(base, improvement, recurring, recentWR, tilt, grind, diffLabel, gameId);
  const report = buildCoachReport(base, correlations, recurring, improvement, breakdown, tagTotal, stats, tilt, grind, catLabels, gameId);
  const tips = getActionFocusTips(gameId);
  const actionItems = buildActionItems(correlations, recurring, improvement, tilt, grind, stats, tips, gameId);

  return { cards, report, actionItems, correlations, recurring, improvement, tilt, grind };
}

function buildInsightCards(base, improvement, recurring, recentWR, tilt, grind, diffLabel, gameId) {
  if (!base) return [];
  const trendIcon = base.trend === 'up' ? '📈' : base.trend === 'down' ? '📉' : '➡️';
  const trendColor = base.trend === 'up' ? 'ic-green' : base.trend === 'down' ? 'ic-red' : 'ic-teal';

  return [
    base.topTag && { icon: '🏷️', label: 'Top Mistake', val: base.topTag[0], sub: `${base.topTag[1]}× logged`, cls: 'ic-orange' },
    base.topLossTag && { icon: '💀', label: 'Top Loss Reason', val: base.topLossTag[0], sub: `${base.topLossTag[1]}× in losses`, cls: 'ic-red' },
    base.bestMode && {
      icon: '🏆',
      label: gameId === GAME_IDS.VALORANT ? 'Best Queue' : 'Strongest Playlist',
      val: base.bestMode.mode,
      sub: `${base.bestMode.winRate}% WR · ${base.bestMode.games}g`,
      cls: 'ic-green',
    },
    base.bestSession && {
      icon: '⚡', label: 'Best Session',
      val: `${base.bestSession.gain >= 0 ? '+' : ''}${base.bestSession.gain} ${diffLabel}`,
      sub: `${base.bestSession.wins}W ${base.bestSession.losses}L`, cls: 'ic-gold',
    },
    base.worstSession && {
      icon: '💥', label: 'Worst Session',
      val: `${base.worstSession.gain} ${diffLabel}`,
      sub: `${base.worstSession.wins}W ${base.worstSession.losses}L`, cls: 'ic-red',
    },
    { icon: '📊', label: `Avg ${diffLabel} / Session`, val: `${base.avgMMRSess >= 0 ? '+' : ''}${base.avgMMRSess}`, sub: `over ${base.sessionCount} sessions`, cls: 'ic-teal' },
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
    tilt.active && {
      icon: '😤', label: 'Tilt Detected', val: `${tilt.lossStreak}L streak`,
      sub: tilt.mentalTags.length ? tilt.mentalTags.join(', ') : 'Take a break', cls: 'ic-red',
    },
    grind && {
      icon: grind.icon, label: 'Grind Status', val: grind.title,
      sub: grind.sub, cls: grind.cls,
    },
  ].filter(Boolean);
}

function buildCoachReport(base, correlations, recurring, improvement, breakdown, tagTotal, stats, tilt, grind, catLabels, gameId) {
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
    lines.push({
      type: 'info',
      text: gameId === GAME_IDS.VALORANT
        ? `Strongest in ${base.bestMode.mode} (${base.bestMode.winRate}% WR). Queue there when grinding RR.`
        : `Strongest in ${base.bestMode.mode} (${base.bestMode.winRate}% WR). Consider focusing there.`,
    });
  }
  const topCat = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0];
  if (topCat && tagTotal && topCat[1] > 0) {
    lines.push({
      type: 'info',
      text: `Most mistakes are ${catLabels[topCat[0]] ?? topCat[0]} (${Math.round(topCat[1] / tagTotal * 100)}% of tags).`,
    });
  }
  if (stats.streak.type === 'L' && stats.streak.count >= 3) {
    lines.push({ type: 'warning', text: `${stats.streak.count}-game loss streak — consider ending session.` });
  }
  if (tilt.active) {
    lines.push({ type: 'warning', text: `Tilt signals detected: ${tilt.lossStreak}-loss streak${tilt.mentalTags.length ? ` with ${tilt.mentalTags.join(', ')}` : ''}. Stop and reset.` });
  }
  if (grind?.severity === 'stop') {
    lines.push({ type: 'warning', text: grind.sub });
  } else if (grind?.severity === 'good') {
    lines.push({ type: 'positive', text: grind.sub });
  }
  return lines;
}

/** Detect tilt: loss streak + mental tags in recent games */
export function detectTilt(games, windowSize = 4, gameId = DEFAULT_GAME) {
  const defs = getTagDefinitions(gameId);
  const recent = games.slice(-windowSize);
  let lossStreak = 0;
  for (let i = games.length - 1; i >= 0; i--) {
    if (games[i].result === 'L') lossStreak++;
    else break;
  }
  const mentalTags = [];
  recent.forEach(g => {
    (g.tags || []).forEach(t => {
      if (defs[t]?.cat === 'men' && !mentalTags.includes(t)) mentalTags.push(t);
    });
  });
  const active = lossStreak >= 3 || (lossStreak >= 2 && mentalTags.length >= 1);
  return { active, lossStreak, mentalTags };
}

/** Should the player keep grinding or stop? */
export function getGrindRecommendation(games, stats, tilt, gameId = DEFAULT_GAME) {
  const diffLabel = getGameMeta(gameId).diffLabel;
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

function buildActionItems(correlations, recurring, improvement, tilt, grind, stats, tips, gameId) {
  const items = [];
  const losses = stats.losses || 0;
  if (grind?.severity === 'stop') {
    items.push({ priority: 1, type: 'stop', text: grind.sub, title: grind.title ?? 'Stop Grinding' });
  }
  if (recurring.length) {
    const tag = recurring[0].tag;
    items.push({
      priority: 2, type: 'focus', tag,
      lossPct: null,
      focus: tips[tag] ?? `Drill ${tag} — it appeared ${recurring[0].count}× in your last 5 games.`,
      text: `Drill: ${tag} — appeared ${recurring[0].count}× in last 5 games.`,
    });
  }
  if (correlations[0]?.correlation >= 60) {
    const c = correlations[0];
    const lossPct = losses ? Math.round(c.inLosses / losses * 100) : c.correlation;
    items.push({
      priority: 3, type: 'fix', tag: c.tag,
      lossPct,
      focus: tips[c.tag] ?? 'Review what triggers this after each loss.',
      text: `Fix ${c.tag} — linked to ${c.correlation}% of tagged losses.`,
    });
  }
  if (improvement.direction === 'declining') {
    items.push({
      priority: 4, type: 'review',
      text: gameId === GAME_IDS.VALORANT
        ? `Win rate down ${Math.abs(improvement.delta)}% — review death replays or run a DM warmup.`
        : `Win rate down ${Math.abs(improvement.delta)}% overall — review recent VODs or training pack.`,
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
