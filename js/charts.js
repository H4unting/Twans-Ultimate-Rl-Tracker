/** Chart.js wrappers — centralized chart lifecycle management */

const charts = {};

function chartDataSig(games, rankField) {
  if (!games?.length) return '0';
  const last = games[games.length - 1];
  return `${games.length}:${last?.match}:${last?.[rankField] ?? last?.endMMR ?? last?.endRR}`;
}

function statsSig(stats) {
  return `${stats?.wins ?? 0}:${stats?.losses ?? 0}`;
}

export function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

export function destroyAllCharts() {
  Object.keys(charts).forEach(destroyChart);
}

const baseScales = {
  x: { ticks: { color: '#555', font: { size: 10 }, maxTicksLimit: 12 }, grid: { color: '#1a1a2e' } },
  y: { ticks: { color: '#555', font: { size: 10 } }, grid: { color: '#1a1a2e' } },
};

function updateLineChart(chart, labels, data, color) {
  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  chart.data.datasets[0].borderColor = color;
  chart.data.datasets[0].backgroundColor = color + '18';
  chart.data.datasets[0].pointBackgroundColor = color;
  chart.update('none');
}

export function mmrChart(id, games, color, label = 'MMR', rankField = 'endMMR') {
  const el = document.getElementById(id);
  if (!el || !games.length) {
    destroyChart(id);
    return;
  }

  const sig = `${id}:${chartDataSig(games, rankField)}:${color}:${label}`;
  const labels = games.map(g => `#${g.match}`);
  const data = games.map(g => g[rankField] ?? g.endMMR ?? g.endRR ?? 0);

  if (charts[id]?.$sig === sig) return;

  if (charts[id]) {
    charts[id].$sig = sig;
    updateLineChart(charts[id], labels, data, color);
    return;
  }

  charts[id] = new Chart(el.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label, data, borderColor: color, backgroundColor: color + '18',
        borderWidth: 2, pointRadius: 3, pointBackgroundColor: color, fill: true, tension: 0.3,
      }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: baseScales },
  });
  charts[id].$sig = sig;
}

export function wlChart(id, stats) {
  const el = document.getElementById(id);
  if (!el) {
    destroyChart(id);
    return;
  }

  const sig = `${id}:${statsSig(stats)}`;
  const wins = stats.wins || 0;
  const losses = stats.losses || 0;

  if (charts[id]?.$sig === sig) return;

  if (charts[id]) {
    charts[id].$sig = sig;
    charts[id].data.datasets[0].data = [wins, losses];
    charts[id].update('none');
    return;
  }

  charts[id] = new Chart(el.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Wins', 'Losses'],
      datasets: [{ data: [wins, losses], backgroundColor: ['#00c851', '#ff4444'], borderWidth: 0 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: { legend: { display: true, position: 'bottom', labels: { color: '#888', font: { size: 11 }, padding: 12 } } },
    },
  });
  charts[id].$sig = sig;
}

export function rollingChart(id, games, primaryColor = '#e65c00') {
  const el = document.getElementById(id);
  if (!el || games.length < 3) {
    destroyChart(id);
    return;
  }

  const sig = `${id}:${chartDataSig(games, 'result')}:${primaryColor}`;
  const w5 = [];
  const w10 = [];
  const labels = [];
  for (let i = 0; i < games.length; i += 1) {
    const slice5 = games.slice(Math.max(0, i - 4), i + 1);
    const slice10 = games.slice(Math.max(0, i - 9), i + 1);
    w5.push(Math.round(slice5.filter(g => g.result === 'W').length / slice5.length * 100));
    w10.push(Math.round(slice10.filter(g => g.result === 'W').length / slice10.length * 100));
    labels.push(`#${i + 1}`);
  }

  if (charts[id]?.$sig === sig) return;

  if (charts[id]) {
    charts[id].$sig = sig;
    charts[id].data.labels = labels;
    charts[id].data.datasets[0].data = w5;
    charts[id].data.datasets[1].data = w10;
    charts[id].update('none');
    return;
  }

  charts[id] = new Chart(el.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: '5-Game WR%', data: w5, borderColor: primaryColor, backgroundColor: `${primaryColor}15`, borderWidth: 2, pointRadius: 2, pointBackgroundColor: primaryColor, fill: true, tension: 0.4 },
        { label: '10-Game WR%', data: w10, borderColor: '#00e5ff', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, fill: false, tension: 0.4, borderDash: [4, 3] },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { color: '#888', font: { size: 11 }, usePointStyle: true, padding: 14 } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%` } },
      },
      scales: {
        ...baseScales,
        y: { ...baseScales.y, min: 0, max: 100, ticks: { ...baseScales.y.ticks, callback: v => `${v}%` } },
      },
    },
  });
  charts[id].$sig = sig;
}

export function trendChart(id, buckets, gameId = 'rocket_league') {
  const el = document.getElementById(id);
  if (!el || !buckets.length) {
    destroyChart(id);
    return;
  }

  const sig = `${id}:${gameId}:${buckets.length}:${buckets[buckets.length - 1]?.label}`;
  const isVal = gameId === 'valorant';
  const datasets = isVal ? [
    { label: 'Aim', key: 'aim', bg: '#ff465555', border: '#ff4655' },
    { label: 'Utility', key: 'util', bg: '#00e5ff55', border: '#00e5ff' },
    { label: 'Teamplay', key: 'team', bg: '#7c3aed55', border: '#7c3aed' },
    { label: 'Mental', key: 'men', bg: '#a855f755', border: '#a855f7' },
  ] : [
    { label: 'Defensive', key: 'def', bg: '#00e5ff55', border: '#00e5ff' },
    { label: 'Offensive', key: 'off', bg: '#e65c0055', border: '#e65c00' },
    { label: 'Mental', key: 'men', bg: '#a855f755', border: '#a855f7' },
  ];

  if (charts[id]?.$sig === sig) return;

  if (charts[id]) {
    charts[id].$sig = sig;
    charts[id].data.labels = buckets.map(b => b.label);
    datasets.forEach((d, i) => {
      charts[id].data.datasets[i].data = buckets.map(b => b[d.key] ?? 0);
    });
    charts[id].update('none');
    return;
  }

  charts[id] = new Chart(el.getContext('2d'), {
    type: 'bar',
    data: {
      labels: buckets.map(b => b.label),
      datasets: datasets.map(d => ({
        label: d.label,
        data: buckets.map(b => b[d.key] ?? 0),
        backgroundColor: d.bg,
        borderColor: d.border,
        borderWidth: 1,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top', labels: { color: '#888', font: { size: 11 }, padding: 12 } } },
      scales: { x: { ...baseScales.x, stacked: true }, y: { ...baseScales.y, stacked: true } },
    },
  });
  charts[id].$sig = sig;
}
