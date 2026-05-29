/** Weekly report generation */

import {
  calcStats, calculateMMRGain, getMostCommonTag, groupBySession,
  formatWeekLabel, getGamesInWeek, getWeekStart, getWeekEnd,
} from './utils.js';

export function buildWeeklyReport(games, weekOffset = 0) {
  const weekGames = getGamesInWeek(games, weekOffset);
  const weekStart = getWeekStart(new Date());
  weekStart.setDate(weekStart.getDate() - weekOffset * 7);
  const weekEnd = getWeekEnd(weekStart);

  if (!weekGames.length) {
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
      startMMR: null,
      endMMR: null,
      topMistake: null,
      bestSession: null,
      sessions: 0,
      vsLastWeek: null,
    };
  }

  const stats = calcStats(weekGames);
  const topMistake = getMostCommonTag(weekGames);
  const sessions = groupBySession(weekGames);
  const bestSession = sessions.reduce((b, s) => (s.gain > b.gain ? s : b), sessions[0]);
  const prevReport = weekOffset < 52 ? buildWeeklyReportCore(games, weekOffset + 1) : null;

  return {
    weekOffset,
    label: formatWeekLabel(weekStart, weekEnd),
    weekStart,
    weekEnd,
    empty: false,
    games: weekGames.length,
    wins: stats.wins,
    losses: stats.losses,
    winRate: stats.winRate,
    mmrGain: calculateMMRGain(weekGames),
    startMMR: weekGames[0].startMMR,
    endMMR: weekGames[weekGames.length - 1].endMMR,
    topMistake,
    bestSession,
    sessions: sessions.length,
    streak: stats.streak,
    vsLastWeek: prevReport && !prevReport.empty ? {
      games: weekGames.length - prevReport.games,
      winRate: stats.winRate - prevReport.winRate,
      mmrGain: calculateMMRGain(weekGames) - prevReport.mmrGain,
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
  const stats = calcStats(weekGames);
  return {
    empty: false,
    games: weekGames.length,
    winRate: stats.winRate,
    mmrGain: calculateMMRGain(weekGames),
    label: formatWeekLabel(weekStart, weekEnd),
  };
}

export function buildTeamWeeklyReports(data, weekOffset = 0) {
  return Object.fromEntries(
    Object.entries(data).map(([playerId, games]) => [playerId, buildWeeklyReport(games ?? [], weekOffset)])
  );
}
