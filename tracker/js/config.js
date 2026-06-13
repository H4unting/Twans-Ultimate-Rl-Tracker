/** App + Rocket League config shims */

export * from './core/app-config.js';

export {
  PLAYLISTS,
  TAG_DEFINITIONS,
  TAG_GROUPS,
  TAG_COLORS,
  CATEGORY_LABELS as RL_CATEGORY_LABELS,
  CATEGORY_ORDER as RL_CATEGORY_ORDER,
  ACTION_FOCUS_TIPS as RL_ACTION_FOCUS_TIPS,
} from './games/rocketleague/config.js';

import { TAG_DEFINITIONS } from './games/rocketleague/config.js';

export const TAG_CATS = Object.fromEntries(
  Object.entries(TAG_DEFINITIONS).map(([label, { cat }]) => [label, cat]),
);
