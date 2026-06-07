import { MODES, META } from './config.js';
import { getGamesInWeek, getGamesForMode, sumRankDiff } from '../../core/game-stats.js';

export function getPlaylistRankRows(games) {
  return MODES.map(mode => {
    const modeGames = getGamesForMode(games, mode);
    const weekGames = getGamesInWeek(modeGames, 0);
    return {
      mode,
      mmr: modeGames.length ? modeGames[modeGames.length - 1].endMMR : null,
      weekGain: sumRankDiff(weekGames, 'mmrDiff'),
      weekGameCount: weekGames.length,
      totalGames: modeGames.length,
      wins: modeGames.filter(g => g.result === 'W').length,
      losses: modeGames.filter(g => g.result === 'L').length,
    };
  }).filter(r => r.mmr != null);
}

export function getRankGain(games) {
  return sumRankDiff(games, 'mmrDiff');
}

export function getCurrentRankForMode(games, mode) {
  const modeGames = getGamesForMode(games, mode);
  return modeGames.length ? modeGames[modeGames.length - 1].endMMR : null;
}

export function getMostRecentMode(games) {
  if (!games.length) return META.defaultMode;
  return games[games.length - 1].mode;
}

export { MODES };
