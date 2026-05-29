/** Analytics page rendering */

import { TAG_CATS, TAG_COLORS } from './config.js';
import { countTags, getTagCategoryBreakdown, getTagTrendBuckets } from './utils.js';
import { getPerformanceInsights } from './insights.js';
import { rollingChart, trendChart } from './charts.js';
import { renderInsightCards, renderCoachReport, renderActionItems, barRows } from './ui.js';

export function renderAnalytics(games) {
  const { cards, report, correlations, actionItems } = getPerformanceInsights(games);
  renderInsightCards(cards);
  renderCoachReport(report);
  renderActionItems(actionItems);

  const tagCount = countTags(games);
  const lossTagCount = countTags(games, { lossesOnly: true });
  const sorted = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
  const lossSorted = Object.entries(lossTagCount).sort((a, b) => b[1] - a[1]);
  const maxC = sorted[0]?.[1] || 1;
  const maxL = lossSorted[0]?.[1] || 1;
  const losses = games.filter(g => g.result === 'L');
  const taggedLossPct = losses.length
    ? Math.round(losses.filter(g => g.tags?.length).length / losses.length * 100) : 0;

  const { breakdown, total } = getTagCategoryBreakdown(games);
  const cmap = TAG_COLORS;

  const corrHTML = correlations.slice(0, 5).map(c => `
    <div class="bar-row">
      <div class="bar-label">${c.tag}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${c.correlation}%;background:${cmap[c.cat]}"></div></div>
      <div class="bar-count">${c.correlation}%</div>
    </div>`).join('') || '<div class="empty" style="padding:12px">Tag more losses for correlations</div>';

  document.getElementById('analytics-content').innerHTML = `
    <div class="analytics-card"><h3>Most Common Mistakes</h3>${barRows(sorted, maxC, cmap)}</div>
    <div class="analytics-card"><h3>Most Common Loss Reasons</h3>${barRows(lossSorted, maxL, cmap)}<div class="filter-hint">${taggedLossPct}% of losses tagged</div></div>
    <div class="analytics-card"><h3>Loss Correlations</h3>${corrHTML}<div class="filter-hint">% of tagged instances that were losses</div></div>
    <div class="analytics-card"><h3>Category Breakdown</h3>
      ${['def', 'off', 'men'].map(cat => {
        const catTotal = sorted.filter(([t]) => TAG_CATS[t] === cat).reduce((s, [, c]) => s + c, 0);
        const labels = { def: 'Defensive', off: 'Offensive', men: 'Mental' };
        return `<div class="bar-row">
          <div class="bar-label" style="color:${cmap[cat]}">${labels[cat]}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${total ? Math.round(catTotal / total * 100) : 0}%;background:${cmap[cat]}"></div></div>
          <div class="bar-count">${catTotal}</div>
        </div>`;
      }).join('')}
      <div class="filter-hint">Total: ${total} tags</div>
    </div>`;

  rollingChart('rollingChart', games);
  trendChart('trendChart', getTagTrendBuckets(games));
}
