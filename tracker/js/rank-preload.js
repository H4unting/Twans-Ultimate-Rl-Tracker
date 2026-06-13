/** Warm rank icon cache after first paint — avoids badge pop-in on dashboard hydrate */

import { RL_RANK_ICON_PRELOAD_URLS } from './games/rocketleague/ranks.js';

const VAL_WIKI = 'https://static.wikia.nocookie.net/valorant/images';

const WARM_ICON_URLS = [
  ...RL_RANK_ICON_PRELOAD_URLS,
  `${VAL_WIKI}/9/9e/Gold_1_Rank.png/revision/latest`,
  `${VAL_WIKI}/4/4a/Platinum_1_Rank.png/revision/latest`,
];

const warmed = new Set();

function warmUrl(url) {
  if (!url || warmed.has(url)) return;
  warmed.add(url);
  const img = new Image();
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.src = url;
}

export function preloadCommonRankIcons() {
  const run = () => WARM_ICON_URLS.forEach(warmUrl);
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 4000 });
  } else {
    setTimeout(run, 200);
  }
}
