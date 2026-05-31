/** Rank thresholds and badge rendering — Rocket League playlist MMR tables */

export const RANK_DATA = {
  '2s': [
    { name: 'Bronze I', mmr: 0, color: '#cd7f32', tier: 'bronze' },
    { name: 'Bronze II', mmr: 172, color: '#cd7f32', tier: 'bronze' },
    { name: 'Bronze III', mmr: 233, color: '#cd7f32', tier: 'bronze' },
    { name: 'Silver I', mmr: 295, color: '#c0c0c0', tier: 'silver' },
    { name: 'Silver II', mmr: 355, color: '#c0c0c0', tier: 'silver' },
    { name: 'Silver III', mmr: 415, color: '#c0c0c0', tier: 'silver' },
    { name: 'Gold I', mmr: 475, color: '#ffd700', tier: 'gold' },
    { name: 'Gold II', mmr: 535, color: '#ffd700', tier: 'gold' },
    { name: 'Gold III', mmr: 595, color: '#ffd700', tier: 'gold' },
    { name: 'Platinum I', mmr: 655, color: '#5dade2', tier: 'plat' },
    { name: 'Platinum II', mmr: 714, color: '#5dade2', tier: 'plat' },
    { name: 'Platinum III', mmr: 772, color: '#5dade2', tier: 'plat' },
    { name: 'Diamond I', mmr: 835, color: '#76d7ea', tier: 'diamond' },
    { name: 'Diamond II', mmr: 915, color: '#76d7ea', tier: 'diamond' },
    { name: 'Diamond III', mmr: 995, color: '#76d7ea', tier: 'diamond' },
    { name: 'Champion I', mmr: 1075, color: '#9b59b6', tier: 'champ' },
    { name: 'Champion II', mmr: 1195, color: '#9b59b6', tier: 'champ' },
    { name: 'Champion III', mmr: 1315, color: '#9b59b6', tier: 'champ' },
    { name: 'Grand Champion I', mmr: 1435, color: '#e74c3c', tier: 'gc' },
    { name: 'Grand Champion II', mmr: 1575, color: '#e74c3c', tier: 'gc' },
    { name: 'Grand Champion III', mmr: 1709, color: '#e74c3c', tier: 'gc' },
    { name: 'Supersonic Legend', mmr: 1861, color: '#f39c12', tier: 'ssl' },
  ],
  '3s': [
    { name: 'Bronze I', mmr: 0, color: '#cd7f32', tier: 'bronze' },
    { name: 'Bronze II', mmr: 196, color: '#cd7f32', tier: 'bronze' },
    { name: 'Bronze III', mmr: 258, color: '#cd7f32', tier: 'bronze' },
    { name: 'Silver I', mmr: 320, color: '#c0c0c0', tier: 'silver' },
    { name: 'Silver II', mmr: 380, color: '#c0c0c0', tier: 'silver' },
    { name: 'Silver III', mmr: 440, color: '#c0c0c0', tier: 'silver' },
    { name: 'Gold I', mmr: 500, color: '#ffd700', tier: 'gold' },
    { name: 'Gold II', mmr: 560, color: '#ffd700', tier: 'gold' },
    { name: 'Gold III', mmr: 620, color: '#ffd700', tier: 'gold' },
    { name: 'Platinum I', mmr: 680, color: '#5dade2', tier: 'plat' },
    { name: 'Platinum II', mmr: 740, color: '#5dade2', tier: 'plat' },
    { name: 'Platinum III', mmr: 800, color: '#5dade2', tier: 'plat' },
    { name: 'Diamond I', mmr: 860, color: '#76d7ea', tier: 'diamond' },
    { name: 'Diamond II', mmr: 940, color: '#76d7ea', tier: 'diamond' },
    { name: 'Diamond III', mmr: 1020, color: '#76d7ea', tier: 'diamond' },
    { name: 'Champion I', mmr: 1100, color: '#9b59b6', tier: 'champ' },
    { name: 'Champion II', mmr: 1220, color: '#9b59b6', tier: 'champ' },
    { name: 'Champion III', mmr: 1340, color: '#9b59b6', tier: 'champ' },
    { name: 'Grand Champion I', mmr: 1460, color: '#e74c3c', tier: 'gc' },
    { name: 'Grand Champion II', mmr: 1600, color: '#e74c3c', tier: 'gc' },
    { name: 'Grand Champion III', mmr: 1735, color: '#e74c3c', tier: 'gc' },
    { name: 'Supersonic Legend', mmr: 1886, color: '#f39c12', tier: 'ssl' },
  ],
  '1s': [
    { name: 'Bronze I', mmr: 0, color: '#cd7f32', tier: 'bronze' },
    { name: 'Bronze II', mmr: 116, color: '#cd7f32', tier: 'bronze' },
    { name: 'Bronze III', mmr: 168, color: '#cd7f32', tier: 'bronze' },
    { name: 'Silver I', mmr: 220, color: '#c0c0c0', tier: 'silver' },
    { name: 'Silver II', mmr: 275, color: '#c0c0c0', tier: 'silver' },
    { name: 'Silver III', mmr: 335, color: '#c0c0c0', tier: 'silver' },
    { name: 'Gold I', mmr: 390, color: '#ffd700', tier: 'gold' },
    { name: 'Gold II', mmr: 450, color: '#ffd700', tier: 'gold' },
    { name: 'Gold III', mmr: 510, color: '#ffd700', tier: 'gold' },
    { name: 'Platinum I', mmr: 570, color: '#5dade2', tier: 'plat' },
    { name: 'Platinum II', mmr: 628, color: '#5dade2', tier: 'plat' },
    { name: 'Platinum III', mmr: 686, color: '#5dade2', tier: 'plat' },
    { name: 'Diamond I', mmr: 748, color: '#76d7ea', tier: 'diamond' },
    { name: 'Diamond II', mmr: 828, color: '#76d7ea', tier: 'diamond' },
    { name: 'Diamond III', mmr: 908, color: '#76d7ea', tier: 'diamond' },
    { name: 'Champion I', mmr: 990, color: '#9b59b6', tier: 'champ' },
    { name: 'Champion II', mmr: 1110, color: '#9b59b6', tier: 'champ' },
    { name: 'Champion III', mmr: 1230, color: '#9b59b6', tier: 'champ' },
    { name: 'Grand Champion I', mmr: 1350, color: '#e74c3c', tier: 'gc' },
    { name: 'Grand Champion II', mmr: 1490, color: '#e74c3c', tier: 'gc' },
    { name: 'Grand Champion III', mmr: 1624, color: '#e74c3c', tier: 'gc' },
    { name: 'Supersonic Legend', mmr: 1776, color: '#f39c12', tier: 'ssl' },
  ],
};

RANK_DATA.all = RANK_DATA['2s'];

function modeToKey(mode) {
  if (mode === "1's") return '1s';
  if (mode === "3's") return '3s';
  return '2s';
}

export function getRank(mmr, mode = "2's") {
  const table = RANK_DATA[modeToKey(mode)] ?? RANK_DATA['2s'];
  if (!mmr) return table[0];
  for (let i = table.length - 1; i >= 0; i--) {
    if (mmr >= table[i].mmr) return table[i];
  }
  return table[0];
}

export function getRankForPlaylist(mmr, playlist) {
  const table = RANK_DATA[playlist] ?? RANK_DATA['2s'];
  if (!mmr) return table[0];
  for (let i = table.length - 1; i >= 0; i--) {
    if (mmr >= table[i].mmr) return table[i];
  }
  return table[0];
}

const DIVISION_NUM = { I: 1, II: 2, III: 3 };

/** Official RL rank icons (256px) — Rocket League Wiki / Fandom */
const WIKI_IMG = 'https://static.wikia.nocookie.net/rocketleague/images';

const RANK_ICON_SRC = {
  'bronze-1': `${WIKI_IMG}/6/6c/Bronze1_rank_icon.png/revision/latest`,
  'bronze-2': `${WIKI_IMG}/5/5d/Bronze2_rank_icon.png/revision/latest`,
  'bronze-3': `${WIKI_IMG}/7/7a/Bronze3_rank_icon.png/revision/latest`,
  'silver-1': `${WIKI_IMG}/d/d5/Silver1_rank_icon.png/revision/latest`,
  'silver-2': `${WIKI_IMG}/f/f8/Silver2_rank_icon.png/revision/latest`,
  'silver-3': `${WIKI_IMG}/7/7c/Silver3_rank_icon.png/revision/latest`,
  'gold-1': `${WIKI_IMG}/8/8e/Gold1_rank_icon.png/revision/latest`,
  'gold-2': `${WIKI_IMG}/b/be/Gold2_rank_icon.png/revision/latest`,
  'gold-3': `${WIKI_IMG}/b/b1/Gold3_rank_icon.png/revision/latest`,
  'platinum-1': `${WIKI_IMG}/7/77/Platinum1_rank_icon.png/revision/latest`,
  'platinum-2': `${WIKI_IMG}/e/e4/Platinum2_rank_icon.png/revision/latest`,
  'platinum-3': `${WIKI_IMG}/7/78/Platinum3_rank_icon.png/revision/latest`,
  'diamond-1': `${WIKI_IMG}/1/1d/Diamond1_rank_icon.png/revision/latest`,
  'diamond-2': `${WIKI_IMG}/b/b6/Diamond2_rank_icon.png/revision/latest`,
  'diamond-3': `${WIKI_IMG}/7/7a/Diamond3_rank_icon.png/revision/latest`,
  'champion-1': `${WIKI_IMG}/a/a7/Champion1_rank_icon.png/revision/latest`,
  'champion-2': `${WIKI_IMG}/0/07/Champion2_rank_icon.png/revision/latest`,
  'champion-3': `${WIKI_IMG}/d/d9/Champion3_rank_icon.png/revision/latest`,
  'grand-champion-1': `${WIKI_IMG}/d/d4/Grand_champion1_rank_icon.png/revision/latest`,
  'grand-champion-2': `${WIKI_IMG}/6/6a/Grand_champion2_rank_icon.png/revision/latest`,
  'grand-champion-3': `${WIKI_IMG}/0/0c/Grand_champion3_rank_icon.png/revision/latest`,
  'supersonic-legend': `${WIKI_IMG}/2/2d/Supersonic_Legend_rank_icon.png/revision/latest`,
};

export function getRankIconKey(rankName) {
  if (rankName === 'Supersonic Legend') return 'supersonic-legend';
  if (rankName.startsWith('Grand Champion')) {
    const div = rankName.replace('Grand Champion ', '');
    return `grand-champion-${DIVISION_NUM[div] || 1}`;
  }
  const [tier, div] = rankName.split(' ');
  return `${tier.toLowerCase()}-${DIVISION_NUM[div] || 1}`;
}

export function getRankIconSrc(rankName) {
  const key = getRankIconKey(rankName);
  return RANK_ICON_SRC[key] ?? RANK_ICON_SRC['bronze-1'];
}

export function rankIconHTML(rankOrName, size = 20) {
  const name = typeof rankOrName === 'string' ? rankOrName : rankOrName.name;
  const src = getRankIconSrc(name);
  const fallback = RANK_ICON_SRC['bronze-1'];
  return `<img class="rank-icon" src="${src}" alt="${name}" width="${size}" height="${size}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${fallback}'">`;
}

export function rankSVG(tier, size = 20) {
  const fallback = { bronze: 'Bronze I', silver: 'Silver I', gold: 'Gold I', plat: 'Platinum I', diamond: 'Diamond I', champ: 'Champion I', gc: 'Grand Champion I', ssl: 'Supersonic Legend' };
  return rankIconHTML(fallback[tier] ?? 'Bronze I', size);
}

export function rankBadgeHTML(mmr, size = 18, mode = "2's") {
  const r = getRank(mmr, mode);
  const iconSize = Math.round(size * 1.2);
  return `<span class="rank-badge" style="border-color:${r.color}44;color:${r.color};background:${r.color}11">${rankIconHTML(r, iconSize)}<span class="rank-badge-name">${r.name}</span></span>`;
}
