/** Synthetic match data for QA — all rows tagged with [QA] in notes */

import { formatDisplayDate } from '../core/dates.js';
import { getGamesInWeek } from '../core/game-stats.js';
import { GAME_IDS } from '../games/registry.js';
import { TAG_DEFINITIONS as RL_TAGS, MODES as RL_MODES } from '../games/rocketleague/config.js';
import { TAG_DEFINITIONS as VAL_TAGS, AGENTS, MAPS } from '../games/valorant/config.js';
import { normalizeGame as normalizeRl } from '../games/rocketleague/normalize.js';
import { normalizeGame as normalizeVal } from '../games/valorant/normalize.js';
import { normalizeGoalsStorage } from '../goals.js';
import {
  QA_NOTE_PREFIX, RL_MMR_SWINGS, VAL_RR_WINS, VAL_RR_LOSSES,
} from './qa-constants.js';

const SESSION_MOODS = ['good', 'bad', 'normal', 'streak_win', 'streak_loss'];
const LONG_NOTE = '[QA] edge case: long note — '.padEnd(120, 'x');

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function tagsByCategory(definitions) {
  const map = {};
  Object.entries(definitions).forEach(([label, meta]) => {
    if (!map[meta.cat]) map[meta.cat] = [];
    map[meta.cat].push(label);
  });
  return map;
}

function pickTags(definitions, result, { min = 0, max = 2 } = {}) {
  const byCat = tagsByCategory(definitions);
  const cats = Object.keys(byCat);
  let count = result === 'L' ? randInt(Math.max(1, min), max) : randInt(min, Math.min(1, max));
  const tags = [];
  for (let i = 0; i < count; i++) {
    const tag = pick(byCat[pick(cats)]);
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

function pickManyTags(definitions, count) {
  const all = Object.keys(definitions);
  const tags = [];
  while (tags.length < count && tags.length < all.length) {
    const t = pick(all);
    if (!tags.includes(t)) tags.push(t);
  }
  return tags;
}

function qaNote(parts = []) {
  return [QA_NOTE_PREFIX, 'seed', ...parts].filter(Boolean).join(' · ');
}

function buildNotes(edgeCase, sessionNum) {
  if (edgeCase === 'empty') return QA_NOTE_PREFIX;
  if (edgeCase === 'long') return LONG_NOTE;
  return qaNote([`session ${sessionNum}`, edgeCase ? `edge:${edgeCase}` : ''].filter(Boolean));
}

function pickEdgeCase(index, total) {
  if (index % 11 === 0) return 'empty';
  if (index % 13 === 0) return 'long';
  if (index % 17 === 0) return 'notag';
  if (index % 19 === 0) return 'manytags';
  if (index === total - 1 && total > 8) return 'streak';
  return '';
}

function resultsForSession(size, mood) {
  const results = [];
  if (mood === 'streak_win') {
    const streak = Math.min(size, randInt(4, 7));
    for (let i = 0; i < streak; i++) results.push('W');
    while (results.length < size) results.push(Math.random() < 0.45 ? 'W' : 'L');
    return results;
  }
  if (mood === 'streak_loss') {
    const streak = Math.min(size, randInt(4, 6));
    for (let i = 0; i < streak; i++) results.push('L');
    while (results.length < size) results.push(Math.random() < 0.4 ? 'W' : 'L');
    return results;
  }
  const winRate = mood === 'good' ? 0.72 : mood === 'bad' ? 0.28 : 0.52;
  for (let i = 0; i < size; i++) {
    results.push(Math.random() < winRate ? 'W' : 'L');
  }
  return results;
}

function buildSessionSizes(sessionCount) {
  const presets = [4, 6, 11, 5, 8, 3, 9, 7, 12, 6, 4, 10, 5, 8, 11, 6, 4, 9, 7, 5, 6, 11, 4, 8, 10];
  return Array.from({ length: sessionCount }, (_, i) => presets[i % presets.length] + (i % 3 === 0 ? randInt(0, 2) : 0));
}

function buildSessionPlan(totalGames) {
  const plan = [];
  let remaining = totalGames;
  let sessionNum = 1;
  while (remaining > 0) {
    const size = Math.min(remaining, randInt(4, 11));
    plan.push({ sessionNum, size, mood: pick(SESSION_MOODS) });
    remaining -= size;
    sessionNum += 1;
  }
  return plan;
}

function buildSessionPlanFromCount(sessionCount) {
  return buildSessionSizes(sessionCount).map((size, i) => ({
    sessionNum: i + 1,
    size,
    mood: SESSION_MOODS[i % SESSION_MOODS.length],
  }));
}

/** Recent sessions weighted toward current week for goals/reports */
function spreadSessionDates(sessionCount, daysBack = 90) {
  const dates = [];
  const now = new Date();
  for (let i = 0; i < sessionCount; i++) {
    const d = new Date(now);
    const daysAgo = i >= sessionCount - 3 ? randInt(0, 6) : randInt(7, daysBack);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(randInt(17, 23), randInt(0, 59), 0, 0);
    dates.push(d);
  }
  dates.sort((a, b) => a - b);
  return dates;
}

function rlDelta(result) {
  const swing = pick(RL_MMR_SWINGS);
  return result === 'W' ? swing : -swing;
}

function valDelta(result) {
  return result === 'W' ? pick(VAL_RR_WINS) : -pick(VAL_RR_LOSSES);
}

function generateFromPlan(plan, factory) {
  const dates = spreadSessionDates(plan.length);
  let matchNum = 0;
  const games = [];
  plan.forEach(({ sessionNum, size, mood }, idx) => {
    const date = formatDisplayDate(dates[idx]);
    const results = resultsForSession(size, mood);
    for (let i = 0; i < size; i++) {
      matchNum += 1;
      games.push(factory({
        sessionNum,
        date,
        matchNum,
        result: results[i],
        edgeCase: pickEdgeCase(matchNum, plan.reduce((s, p) => s + p.size, 0)),
        mood,
      }));
    }
  });
  return games;
}

function createRlFactory({ startMmr = 850 } = {}) {
  const mmrByMode = Object.fromEntries(RL_MODES.map(m => [m, startMmr + randInt(-60, 60)]));
  return ({ sessionNum, date, matchNum, result, edgeCase }) => {
    const mode = pick(RL_MODES);
    const startMMR = mmrByMode[mode];
    const endMMR = Math.max(0, startMMR + rlDelta(result));
    mmrByMode[mode] = endMMR;

    let tags = [];
    if (edgeCase === 'notag') tags = [];
    else if (edgeCase === 'manytags') tags = pickManyTags(RL_TAGS, randInt(3, 5));
    else tags = pickTags(RL_TAGS, result);

    return normalizeRl({
      date,
      session: sessionNum,
      match: matchNum,
      mode,
      result,
      goals: result === 'W' ? randInt(1, 3) : randInt(0, 1),
      assists: randInt(0, 3),
      saves: randInt(0, 5),
      startMMR,
      endMMR,
      mmrDiff: endMMR - startMMR,
      tags,
      notes: buildNotes(edgeCase, sessionNum),
    });
  };
}

function createValFactory({ startRr = 42 } = {}) {
  let rr = startRr;
  return ({ sessionNum, date, matchNum, result, edgeCase }) => {
    const startRR = rr;
    const endRR = Math.max(0, Math.min(100, startRR + valDelta(result)));
    rr = endRR;

    let tags = [];
    if (edgeCase === 'notag') tags = [];
    else if (edgeCase === 'manytags') tags = pickManyTags(VAL_TAGS, randInt(3, 4));
    else tags = pickTags(VAL_TAGS, result);

    const kills = result === 'W' ? randInt(14, 28) : randInt(6, 18);
    const deaths = result === 'W' ? randInt(8, 16) : randInt(14, 24);

    return normalizeVal({
      date,
      session: sessionNum,
      match: matchNum,
      mode: 'Competitive',
      result,
      kills,
      deaths,
      valAssists: randInt(2, 12),
      acs: randInt(160, 280),
      agent: pick(AGENTS),
      map: pick(MAPS),
      startRR,
      endRR,
      rrDiff: endRR - startRR,
      tags,
      notes: buildNotes(edgeCase, sessionNum),
    });
  };
}

export function generateRlMatches(count, opts = {}) {
  const plan = buildSessionPlan(count);
  return generateFromPlan(plan, createRlFactory(opts));
}

export function generateRlSessions(sessionCount, opts = {}) {
  const plan = buildSessionPlanFromCount(sessionCount);
  return generateFromPlan(plan, createRlFactory(opts));
}

export function generateValorantMatches(count, opts = {}) {
  const plan = buildSessionPlan(count);
  return generateFromPlan(plan, createValFactory(opts));
}

export function generateValorantSessions(sessionCount, opts = {}) {
  const plan = buildSessionPlanFromCount(sessionCount);
  return generateFromPlan(plan, createValFactory(opts));
}

export function generateSessionsForGame(gameId, sessionCount, opts = {}) {
  return gameId === GAME_IDS.VALORANT
    ? generateValorantSessions(sessionCount, opts)
    : generateRlSessions(sessionCount, opts);
}

export function buildQaGoalsState(rlGames, valGames) {
  const base = normalizeGoalsStorage({});
  const rlMode = "2's";
  const rlEnd = rlGames.filter(g => g.mode === rlMode).at(-1)?.endMMR ?? 900;
  const rlWeek = getGamesInWeek(rlGames, 0);
  const valWeek = getGamesInWeek(valGames, 0);
  const valEnd = valGames.at(-1)?.endRR ?? 55;
  const rlLossTag = 'Tilt';
  const valLossTag = 'Tilt';

  base[GAME_IDS.ROCKET_LEAGUE] = {
    mmrTarget: rlEnd - 80,
    gamesPerWeek: Math.max(1, rlWeek.length + 2),
    winRateTarget: 45,
    focusTag: rlLossTag,
  };
  base[GAME_IDS.VALORANT] = {
    mmrTarget: 12,
    gamesPerWeek: Math.max(1, valWeek.length - 1),
    winRateTarget: 58,
    focusTag: valLossTag,
  };
  return base;
}

export function generateFullQaDataset(opts = {}) {
  const rl = generateRlMatches(100, opts);
  const val = generateValorantMatches(100, opts);
  const goals = buildQaGoalsState(rl, val);
  return { rl, val, goals };
}

export function mergeQaIntoGames(allGames, gameId, qaGames) {
  const other = allGames.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) !== gameId);
  const real = allGames.filter(g =>
    (g.game ?? GAME_IDS.ROCKET_LEAGUE) === gameId
    && !String(g.notes ?? '').startsWith(QA_NOTE_PREFIX),
  );
  const merged = [...real, ...qaGames].map((g, i) => ({ ...g, game: gameId, match: i + 1 }));
  return [...other, ...merged];
}

export function mergeFullQaDataset(allGames, { rl, val }) {
  let merged = mergeQaIntoGames(allGames, GAME_IDS.ROCKET_LEAGUE, rl);
  merged = mergeQaIntoGames(merged, GAME_IDS.VALORANT, val);
  return merged;
}

export function stripQaFromGames(allGames, gameId = null) {
  const strip = g => !String(g.notes ?? '').startsWith(QA_NOTE_PREFIX);
  if (gameId) {
    const other = allGames.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) !== gameId);
    const kept = allGames.filter(g => (g.game ?? GAME_IDS.ROCKET_LEAGUE) === gameId && strip(g));
    return [...other, ...kept.map((g, i) => ({ ...g, match: i + 1 }))];
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

export function countQaSessions(games) {
  return new Set(games.map(g => g.session)).size;
}
