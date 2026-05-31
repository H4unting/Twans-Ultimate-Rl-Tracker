import { TAG_DEFINITIONS, CATEGORY_ORDER } from './config.js';
import { countTags } from '../../core/game-stats.js';

export function getTagCat(tag) {
  return TAG_DEFINITIONS[tag]?.cat ?? 'aim';
}

export function getTagCategoryBreakdown(games) {
  const counts = countTags(games);
  const breakdown = Object.fromEntries(CATEGORY_ORDER.map(k => [k, 0]));
  Object.entries(counts).forEach(([tag, count]) => {
    const cat = TAG_DEFINITIONS[tag]?.cat;
    if (cat && breakdown[cat] != null) breakdown[cat] += count;
  });
  return { counts, breakdown, total: Object.values(counts).reduce((a, b) => a + b, 0) };
}

export function getTagTrendBuckets(games, bucketSize = 5) {
  const buckets = [];
  for (let i = 0; i < games.length; i += bucketSize) {
    const chunk = games.slice(i, i + bucketSize);
    const row = { label: `#${i + 1}-${Math.min(i + bucketSize, games.length)}` };
    CATEGORY_ORDER.forEach(cat => {
      row[cat] = chunk.reduce((s, g) => s + (g.tags || []).filter(t => TAG_DEFINITIONS[t]?.cat === cat).length, 0);
    });
    buckets.push(row);
  }
  return buckets;
}

export function getTagLossCorrelations(games) {
  const allCounts = countTags(games);
  const lossCounts = countTags(games, { lossesOnly: true });
  const losses = games.filter(g => g.result === 'L').length;
  return Object.keys(allCounts).map(tag => ({
    tag,
    cat: TAG_DEFINITIONS[tag]?.cat ?? 'aim',
    total: allCounts[tag],
    inLosses: lossCounts[tag] ?? 0,
    lossRate: losses ? Math.round((lossCounts[tag] ?? 0) / losses * 100) : 0,
    correlation: allCounts[tag] ? Math.round((lossCounts[tag] ?? 0) / allCounts[tag] * 100) : 0,
  })).sort((a, b) => b.correlation - a.correlation || b.inLosses - a.inLosses);
}

export function getRecurringMistakes(games, windowSize = 5) {
  const recent = games.slice(-windowSize);
  const counts = countTags(recent);
  return Object.entries(counts)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count, cat: TAG_DEFINITIONS[tag]?.cat }));
}

export function detectTilt(games, windowSize = 4) {
  const recent = games.slice(-windowSize);
  let lossStreak = 0;
  for (let i = games.length - 1; i >= 0; i--) {
    if (games[i].result === 'L') lossStreak++;
    else break;
  }
  const mentalTags = [];
  recent.forEach(g => {
    (g.tags || []).forEach(t => {
      if (TAG_DEFINITIONS[t]?.cat === 'men' && !mentalTags.includes(t)) mentalTags.push(t);
    });
  });
  return { active: lossStreak >= 3 || (lossStreak >= 2 && mentalTags.length >= 1), lossStreak, mentalTags };
}
