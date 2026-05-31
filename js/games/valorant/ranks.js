/** Valorant rank display — RR-based tiers (no RL MMR tables) */

const TIERS = [
  { name: 'Iron', minRR: 0, color: '#4a4a4a' },
  { name: 'Bronze', minRR: 100, color: '#cd7f32' },
  { name: 'Silver', minRR: 200, color: '#c0c0c0' },
  { name: 'Gold', minRR: 300, color: '#ffd700' },
  { name: 'Platinum', minRR: 400, color: '#5dade2' },
  { name: 'Diamond', minRR: 500, color: '#76d7ea' },
  { name: 'Ascendant', minRR: 600, color: '#1a8a5c' },
  { name: 'Immortal', minRR: 700, color: '#ff4655' },
  { name: 'Radiant', minRR: 800, color: '#fff4cc' },
];

export function getRank(rr) {
  if (rr == null || rr === '') return TIERS[0];
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (rr >= TIERS[i].minRR) return TIERS[i];
  }
  return TIERS[0];
}

export function rankBadgeHTML(rr, size = 18) {
  const r = getRank(rr);
  return `<span class="rank-badge val-rank-badge" style="border-color:${r.color}44;color:${r.color};background:${r.color}11"><span class="rank-badge-name">${r.name}</span></span>`;
}

export function rankIconHTML() {
  return '';
}

export function getRankForPlaylist(rr) {
  return getRank(rr);
}

export function getRankIconKey() {
  return 'valorant';
}

export function getRankIconSrc() {
  return '';
}

export function rankSVG() {
  return '';
}
