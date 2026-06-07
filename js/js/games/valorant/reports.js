import {
  calcStreak, calculateWinrate, getMostCommonTag, groupBySession,
  getGamesInWeek, sumRankDiff, getWeekStart, getWeekEnd,
} from '../../core/game-stats.js';
import { formatWeekLabel } from '../../core/dates.js';
import { META } from './config.js';

export function buildWeeklyReport(games, weekOffset = 0) {
  const weekGames = getGamesInWeek(games, weekOffset);
  const weekStart = getWeekStart(new Date());
  weekStart.setDate(weekStart.getDate() - weekOffset * 7);
  const weekEnd = getWeekEnd(weekStart);

  if (!weekGames.length) {
    return emptyReport(weekOffset, weekStart, weekEnd);
  }

  const wins = weekGames.filter(g => g.result === 'W').length;
  const losses = weekGames.filter(g => g.result === 'L').length;
  const winRate = calculateWinrate(weekGames);
  const rankGain = sumRankDiff(weekGames, META.diffField);
  const topMistake = getMostCommonTag(weekGames);
  const sessions = groupBySession(weekGames, META.diffField);
  const bestSession = sessions.reduce((b, s) => (s.gain > b.gain ? s : b), sessions[0]);
  const prevReport = weekOffset < 52 ? buildWeeklyReportCore(games, weekOffset + 1) : null;

  return {
    weekOffset,
    label: formatWeekLabel(weekStart, weekEnd),
    weekStart,
    weekEnd,
    empty: false,
    games: weekGames.length,
    wins,
    losses,
    winRate,
    mmrGain: rankGain,
    rankGain,
    rankLabel: META.rankLabel,
    startMMR: weekGames[0].startRR,
    endMMR: weekGames[weekGames.length - 1].endRR,
    topMistake,
    bestSession,
    sessions: sessions.length,
    streak: calcStreak(weekGames),
    vsLastWeek: prevReport && !prevReport.empty ? {
      games: weekGames.length - prevReport.games,
      winRate: winRate - prevReport.winRate,
      mmrGain: rankGain - prevReport.mmrGain,
    } : null,
  };
}

function buildWeeklyReportCore(games, weekOffset) {
  const weekGames = getGamesInWeek(games, weekOffset);
  const weekStart = getWeekStart(new Date());
  weekStart.setDate(weekStart.getDate() - weekOffset * 7);
  const weekEnd = getWeekEnd(weekStart);
  if (!weekGames.length) {
    return { empty: true, games: 0, winRate: 0, mmrGain: 0, label: formatWeekLabel(weekStart, weekEnd) };
  }
  return {
    empty: false,
    games: weekGames.length,
    winRate: calculateWinrate(weekGames),
    mmrGain: sumRankDiff(weekGames, META.diffField),
    label: formatWeekLabel(weekStart, weekEnd),
  };
}

function emptyReport(weekOffset, weekStart, weekEnd) {
  return {
    weekOffset,
    label: formatWeekLabel(weekStart, weekEnd),
    weekStart,
    weekEnd,
    empty: true,
    games: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    mmrGain: 0,
    rankGain: 0,
    rankLabel: META.rankLabel,
    startMMR: null,
    endMMR: null,
    topMistake: null,
    bestSession: null,
    sessions: 0,
    vsLastWeek: null,
  };
}

export function getWeeklyReports(games, count = 8) {
  return Array.from({ length: count }, (_, i) => buildWeeklyReport(games, i));
}
