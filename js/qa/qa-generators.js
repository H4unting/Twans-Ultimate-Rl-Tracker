/** Synthetic match data for QA — all rows tagged with [QA] in notes */

import { formatDisplayDate } from '../core/dates.js';
import { GAME_IDS } from '../games/registry.js';
import { TAG_DEFINITIONS as RL_TAGS, MODES as RL_MODES } from '../games/rocketleague/config.js';
import {
  TAG_DEFINITIONS as VAL_TAGS, AGENTS, MAPS, DEFAULT_RR_SWING,
} from '../games/valorant/config.js';
import { normalizeGame as normalizeRl } from '../games/rocketleague/normalize.js';
import { normalizeGame as normalizeVal } from '../games/valorant/normalize.js';
import { mergeActiveGoals } from '../goals.js';
import { QA_NOTE_PREFIX } from './qa-constants.js';

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function weightedResult(winRate = 0.55) {
  return Math.random() < winRate ? 'W' : 'L';
}

function tagsByCategory(definitions) {
  const map = {};
  Object.entries(definitions).forEach(([label, meta]) => {
    const cat = meta.cat;
    if (!map[cat]) map[cat] = [];
    map[cat].push(label);
  });
  return map;
}

function pickTags(definitions, result, max = 2) {
  const byCat = tagsByCategory(definitions);
  const cats = Object.keys(byCat);
  const count = result === 'L' ? randInt(1, max) : (Math.random() < 0.35 ? 1 : 0);
  const tags = [];
  for (let i = 0; i < count; i++) {
    const cat = pick(cats);
    const tag = pick(byCat[cat]);
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

function buildSessionPlan(totalGames) {
  const plan = [];
  let remaining = totalGames;
  let sessionNum = 1;
  while (remaining > 0) {
    const size = Math.min(remaining, randInt(3, 7));
    plan.push({ sessionNum, size });
    remaining -= size;
    sessionNum += 1;
  }
  return plan;
}

function spreadDates(sessionCount, daysBack = 75) {
  const dates = [];
  const now = new Date();
  for (let s = 0; s < sessionCount; s++) {
    const d = new Date(now);
    d.setDate(d.getDate() - randInt(1, daysBack));
    d.setHours(12, 0, 0, 0);
    dates.push(d);
  }
  dates.sort((a, b) => a - b);
  return dates;
}

function qaNote(extra = '') {
  return [QA_NOTE_PREFIX, 'seed', extra].filter(Boolean).join(' · ');
}

export function generateRlMatches(count, { winRate = 0.55, startMmr = 850 } = {}) {
  const plan = buildSessionPlan(count);
  const sessionDates = spreadDates(plan.length);
  const games = [];
  const mmrByMode = Object.fromEntries(RL_MODES.map(m => [m, startMmr + randInt(-80, 80)]));
  let matchNum = 0;

  plan.forEach(({ sessionNum, size }, idx) => {
    const date = formatDisplayDate(sessionDates[idx]);
    for (let i = 0; i < size; i++) {
      matchNum += 1;
      const mode = pick(RL_MODES);
      const result = weightedResult(winRate);
      const startMMR = mmrByMode[mode];
      const delta = result === 'W' ? randInt(6, 14) : -randInt(6, 14);
      const endMMR = Math.max(0, startMMR + delta);
      mmrByMode[mode] = endMMR;
      const tags = pickTags(RL_TAGS, result);

      games.push(normalizeRl({
        date,
        session: sessionNum,
        match: matchNum,
        mode,
        result,
        goals: result === 'W' ? randInt(0, 3) : randInt(0, 1),
        assists: randInt(0, 2),
        saves: randInt(0, 4),
        startMMR,
        endMMR,
        mmrDiff: endMMR - startMMR,
        tags,
        notes: qaNote(`session ${sessionNum}`),
      }));
    }
  });

  return games;
}

export function generateValorantMatches(count, { winRate = 0.52, startRr = 45 } = {}) {
  const plan = buildSessionPlan(count);
  const sessionDates = spreadDates(plan.length);
  const games = [];
  let rr = startRr;
  let matchNum = 0;

  plan.forEach(({ sessionNum, size }, idx) => {
    const date = formatDisplayDate(sessionDates[idx]);
    for (let i = 0; i < size; i++) {
      matchNum += 1;
      const mode = Math.random() < 0.85 ? 'Competitive' : 'Unrated';
      const result = weightedResult(winRate);
      const startRR = mode === 'Competitive' ? rr : randInt(0, 100);
      const swing = mode === 'Competitive'
        ? (result === 'W' ? randInt(10, 22) : -randInt(10, 22))
        : 0;
      const endRR = mode === 'Competitive'
        ? Math.max(0, Math.min(100, startRR + swing))
        : startRR;
      if (mode === 'Competitive') rr = endRR;

      const kills = randInt(8, 28);
      const deaths = randInt(6, 22);
      const valAssists = randInt(1, 12);
      const acs = randInt(140, 290);
      const tags = pickTags(VAL_TAGS, result);

      games.push(normalizeVal({
        date,
        session: sessionNum,
        match: matchNum,
        mode,
        result,
        kills,
        deaths,
        valAssists,
        acs,
        agent: pick(AGENTS),
        map: pick(MAPS),
        startRR,
        endRR,
        rrDiff: endRR - startRR,
        tags,
        notes: qaNote(`session ${sessionNum}`),
      }));
    }
  });

  return games;
}

export function buildGoalsPatch(games, gameId) {
  const losses = games.filter(g => g.result === 'L');
  const tagCounts = {};
  losses.forEach(g => {
    (g.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] ?? 0) + 1; });
  });
  const focusTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  const wins = games.filter(g => g.result === 'W').length;
  const winRateTarget = games.length ? Math.round(wins / games.length * 100) : 50;
  const mod = gameId === GAME_IDS.VALORANT ? 'endRR' : 'endMMR';
  const lastRank = games.length ? games[games.length - 1][mod] : 0;

  return mergeActiveGoals({
    gamesPerWeek: Math.min(30, Math.max(10, Math.ceil(games.length / 4))),
    winRateTarget,
    focusTag,
    mmrTarget: lastRank + (gameId === GAME_IDS.VALORANT ? 15 : 100),
  }, gameId);
}

export function mergeQaIntoGames(allGames, gameId, qaGames) {
  const other = allGames.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) !== gameId);
  const real = allGames.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) === gameId && !String(g.notes ?? '').startsWith(QA_NOTE_PREFIX));
  const merged = [...real, ...qaGames].map((g, i) => ({ ...g, game: gameId, match: i + 1 }));
  return [...other, ...merged];
}

export function stripQaFromGames(allGames, gameId = null) {
  const strip = g => !String(g.notes ?? '').startsWith(QA_NOTE_PREFIX);
  if (gameId) {
    const other = allGames.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) !== gameId);
    const kept = allGames.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) === gameId && strip(g));
    const renumbered = kept.map((g, i) => ({ ...g, match: i + 1 }));
    return [...other, ...renumbered];
  }
  const byGame = {};
  allGames.filter(strip).forEach(g => {
    const gid = g.game ?? GAME_IDS.ROCKET_LEAGUE;
    if (!byGame[gid]) byGame[gid] = [];
    byGame[gid].push(g);
  });
  return Object.entries(byGame).flatMap(([gid, list]) =>
    list.map((g, i) => ({ ...g, game: gid, match: i + 1 })),
  );
}

export function collectQaGames(allGames) {
  return allGames.filter(g => String(g.notes ?? '').startsWith(QA_NOTE_PREFIX));
}
