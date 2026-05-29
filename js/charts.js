/** Chart.js wrappers — centralized chart lifecycle management */

const charts = {};

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

export function mmrChart(id, games, color) {
  destroyChart(id);
  const el = document.getElementById(id);
  if (!el || !games.length) return;
  charts[id] = new Chart(el.getContext('2d'), {
    type: 'line',
    data: {
      labels: games.map(g => `#${g.match}`),
      datasets: [{
        label: 'MMR', data: games.map(g => g.endMMR),
        borderColor: color, backgroundColor: color + '18',
        borderWidth: 2, pointRadius: 3, pointBackgroundColor: color, fill: true, tension: 0.3,
      }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: baseScales },
  });
}

export function wlChart(id, stats) {
  destroyChart(id);
  const el = document.getElementById(id);
  if (!el) return;
  charts[id] = new Chart(el.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Wins', 'Losses'],
      datasets: [{ data: [stats.wins || 0, stats.losses || 0], backgroundColor: ['#00c851', '#ff4444'], borderWidth: 0 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: { legend: { display: true, position: 'bottom', labels: { color: '#888', font: { size: 11 }, padding: 12 } } },
    },
  });
}

export function sessionChart(id, games, color) {
  destroyChart(id);
  const el = document.getElementById(id);
  if (!el) return;
  const sm = {};
  games.forEach(g => {
    const k = `S${g.session} ${g.date}`;
    if (!sm[k]) sm[k] = { label: k, gain: 0 };
    sm[k].gain += g.mmrDiff || 0;
  });
  const sessions = Object.values(sm);
  if (!sessions.length) return;
  charts[id] = new Chart(el.getContext('2d'), {
    type: 'bar',
    data: {
      labels: sessions.map(s => s.label),
      datasets: [{
        label: 'MMR Gain', data: sessions.map(s => s.gain),
        backgroundColor: sessions.map(s => (s.gain >= 0 ? color + '99' : '#ff444499')),
        borderColor: sessions.map(s => (s.gain >= 0 ? color : '#ff4444')),
        borderWidth: 1,
      }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: baseScales },
  });
}

export function teamChart(aGames, tGames) {
  destroyChart('teamChart');
  const el = document.getElementById('teamChart');
  if (!el) return;
  const len = Math.max(aGames.length, tGames.length);
  charts.teamChart = new Chart(el.getContext('2d'), {
    type: 'line',
    data: {
      labels: Array.from({ length: len }, (_, i) => `Match ${i + 1}`),
      datasets: [
        { label: 'Anthony', data: aGames.map(g => g.endMMR), borderColor: '#e65c00', backgroundColor: '#e65c0015', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#e65c00', fill: true, tension: 0.3 },
        { label: 'Trystan', data: tGames.map(g => g.endMMR), borderColor: '#00e5ff', backgroundColor: '#00e5ff15', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#00e5ff', fill: true, tension: 0.3, borderDash: [5, 3] },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top', labels: { color: '#888', font: { size: 11 }, usePointStyle: true, padding: 16 } } },
      scales: baseScales,
    },
  });
}

export function rollingChart(id, games) {
  destroyChart(id);
  const el = document.getElementById(id);
  if (!el || games.length < 3) return;
  const w5 = [], w10 = [], labels = [];
  for (let i = 0; i < games.length; i++) {
    const slice5 = games.slice(Math.max(0, i - 4), i + 1);
    const slice10 = games.slice(Math.max(0, i - 9), i + 1);
    w5.push(Math.round(slice5.filter(g => g.result === 'W').length / slice5.length * 100));
    w10.push(Math.round(slice10.filter(g => g.result === 'W').length / slice10.length * 100));
    labels.push(`#${i + 1}`);
  }
  charts[id] = new Chart(el.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: '5-Game WR%', data: w5, borderColor: '#e65c00', backgroundColor: '#e65c0015', borderWidth: 2, pointRadius: 2, pointBackgroundColor: '#e65c00', fill: true, tension: 0.4 },
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
        y: { ...baseScales.y, min: 0, max: 100, ticks: { ...baseScales.y.ticks, callback: v => v + '%' } },
      },
    },
  });
}

export function trendChart(id, buckets) {
  destroyChart(id);
  const el = document.getElementById(id);
  if (!el || !buckets.length) return;
  charts[id] = new Chart(el.getContext('2d'), {
    type: 'bar',
    data: {
      labels: buckets.map(b => b.label),
      datasets: [
        { label: 'Defensive', data: buckets.map(b => b.def), backgroundColor: '#00e5ff55', borderColor: '#00e5ff', borderWidth: 1 },
        { label: 'Offensive', data: buckets.map(b => b.off), backgroundColor: '#e65c0055', borderColor: '#e65c00', borderWidth: 1 },
        { label: 'Mental', data: buckets.map(b => b.men), backgroundColor: '#a855f755', borderColor: '#a855f7', borderWidth: 1 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top', labels: { color: '#888', font: { size: 11 }, padding: 12 } } },
      scales: { x: { ...baseScales.x, stacked: true }, y: { ...baseScales.y, stacked: true } },
    },
  });
}
