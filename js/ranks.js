/** Rank thresholds and badge rendering — playlist-specific MMR tables */

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

export function rankSVG(tier, size = 20) {
  const shapes = {
    bronze: '<polygon points="10,2 18,7 18,13 10,18 2,13 2,7" fill="#cd7f32" stroke="#a0622a" stroke-width="1.5"/>',
    silver: '<polygon points="10,2 18,7 18,13 10,18 2,13 2,7" fill="#c0c0c0" stroke="#888" stroke-width="1.5"/>',
    gold: '<polygon points="10,1 19,7 19,13 10,19 1,13 1,7" fill="#ffd700" stroke="#c8a000" stroke-width="1.5"/><circle cx="10" cy="10" r="3" fill="#c8a000"/>',
    plat: '<polygon points="10,1 19,6 19,14 10,19 1,14 1,6" fill="#5dade2" stroke="#2980b9" stroke-width="1.5"/><polygon points="10,5 14,8 14,12 10,15 6,12 6,8" fill="#2980b9"/>',
    diamond: '<polygon points="10,1 19,10 10,19 1,10" fill="#76d7ea" stroke="#1abc9c" stroke-width="1.5"/><polygon points="10,5 15,10 10,15 5,10" fill="#1abc9c"/>',
    champ: '<polygon points="10,1 19,6 19,14 10,19 1,14 1,6" fill="#9b59b6" stroke="#6c3483" stroke-width="1.5"/><circle cx="10" cy="10" r="3" fill="#d7bde2"/>',
    gc: '<polygon points="10,1 18,5 20,14 14,19 6,19 0,14 2,5" fill="#e74c3c" stroke="#c0392b" stroke-width="1.5"/><circle cx="10" cy="10" r="3" fill="#fadbd8"/>',
    ssl: '<circle cx="10" cy="10" r="9" fill="#f39c12" stroke="#d68910" stroke-width="1.5"/><polygon points="10,3 12,8 17,8 13,11 15,16 10,13 5,16 7,11 3,8 8,8" fill="#d68910"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">${shapes[tier] ?? shapes.bronze}</svg>`;
}

export function rankBadgeHTML(mmr, size = 18, mode = "2's") {
  const r = getRank(mmr, mode);
  return `<span class="rank-badge" style="border-color:${r.color}44;color:${r.color};background:${r.color}11">${rankSVG(r.tier, size)}&nbsp;${r.name}</span>`;
}
