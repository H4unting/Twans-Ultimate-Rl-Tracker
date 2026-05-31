/** Analytics page rendering */

import { countTags } from './utils.js';
import { getPerformanceInsights } from './insights.js';
import { rollingChart, trendChart } from './charts.js';
import { renderInsightCards, renderCoachReport, renderActionItems, barRows } from './ui.js';
import { state } from './state.js';
import { getCategoryLabels, getCategoryOrder, getTagColors, getTagCat } from './games.js';
import { getActiveGameModule } from './games/router.js';

const MIN_GAMES_FOR_CHARTS = 10;

export function renderAnalytics(games) {
  const mod = getActiveGameModule();
  const gameId = state.activeGame;
  const { cards, report, correlations, actionItems } = getPerformanceInsights(games, gameId);
  const catLabels = getCategoryLabels(gameId);
  const catOrder = getCategoryOrder(gameId);
  const cmap = getTagColors(gameId);
  const categoryTitle = mod.ANALYTICS.categoryTitle;

  renderActionItems(actionItems);
  renderInsightCards(cards);
  renderCoachReport(report);

  const lockEl = document.getElementById('analytics-lock');
  const chartsWrap = document.getElementById('analytics-charts-wrap');
  const remaining = MIN_GAMES_FOR_CHARTS - games.length;

  if (games.length < MIN_GAMES_FOR_CHARTS) {
    if (lockEl) {
      lockEl.classList.remove('hidden');
      lockEl.innerHTML = `<div class="analytics-lock-card"><span class="analytics-lock-icon">📈</span><p>Play <strong>${remaining}</strong> more match${remaining === 1 ? '' : 'es'} to unlock trend charts.</p><p class="analytics-lock-sub">Intel above still works with your current data.</p></div>`;
    }
    chartsWrap?.classList.add('hidden');
  } else {
    lockEl?.classList.add('hidden');
    chartsWrap?.classList.remove('hidden');
  }

  const tagCount = countTags(games);
  const lossTagCount = countTags(games, { lossesOnly: true });
  const sorted = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
  const lossSorted = Object.entries(lossTagCount).sort((a, b) => b[1] - a[1]);
  const maxC = sorted[0]?.[1] || 1;
  const maxL = lossSorted[0]?.[1] || 1;
  const losses = games.filter(g => g.result === 'L');
  const taggedLossPct = losses.length
    ? Math.round(losses.filter(g => g.tags?.length).length / losses.length * 100) : 0;

  const corrHTML = correlations.slice(0, 5).map(c => `
    <div class="bar-row">
      <div class="bar-label">${c.tag}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${c.correlation}%;background:${cmap[c.cat]}"></div></div>
      <div class="bar-count">${c.correlation}%</div>
    </div>`).join('') || '<div class="empty" style="padding:12px">Tag more losses for correlations</div>';

  const total = sorted.reduce((s, [, c]) => s + c, 0);

  document.getElementById('analytics-content').innerHTML = `
    <div class="analytics-card analytics-card-compact"><h3>Most Common Mistakes</h3>${barRows(sorted, maxC, cmap, gameId)}</div>
    <div class="analytics-card analytics-card-compact"><h3>Most Common Loss Reasons</h3>${barRows(lossSorted, maxL, cmap, gameId)}<div class="filter-hint">${taggedLossPct}% of losses tagged</div></div>
    <div class="analytics-card analytics-card-compact"><h3>Loss Correlations</h3>${corrHTML}<div class="filter-hint">% of tagged instances that were losses</div></div>
    <div class="analytics-card analytics-card-compact"><h3>${categoryTitle}</h3>
      ${catOrder.map(cat => {
        const catTotal = sorted.filter(([t]) => getTagCat(t, gameId) === cat).reduce((s, [, c]) => s + c, 0);
        return `<div class="bar-row">
          <div class="bar-label" style="color:${cmap[cat]}">${catLabels[cat]}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${total ? Math.round(catTotal / total * 100) : 0}%;background:${cmap[cat]}"></div></div>
          <div class="bar-count">${catTotal}</div>
        </div>`;
      }).join('')}
      <div class="filter-hint">Total: ${total} tags</div>
    </div>`;

  if (games.length >= MIN_GAMES_FOR_CHARTS) {
    const chartColor = state.activeGame === 'valorant'
      ? '#ff4655'
      : (state.profile?.primary_color || '#e65c00');
    rollingChart('rollingChart', games, chartColor);
    trendChart('trendChart', mod.getTagTrendBuckets(games), gameId);
  }
}
