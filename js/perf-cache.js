/** Memoization for hot-path pure functions — invalidate via gamesVersion */

let gamesVersion = 0;
const statsCache = new Map();
const filterCache = new Map();
const MAX_CACHE_ENTRIES = 48;

export function bumpGamesVersion() {
  gamesVersion += 1;
  statsCache.clear();
  filterCache.clear();
}

export function getGamesVersion() {
  return gamesVersion;
}

function pruneMap(map) {
  if (map.size <= MAX_CACHE_ENTRIES) return;
  const drop = map.size - MAX_CACHE_ENTRIES;
  const keys = map.keys();
  for (let i = 0; i < drop; i += 1) {
    const { value: key } = keys.next();
    if (key !== undefined) map.delete(key);
  }
}

function gamesTailKey(games) {
  if (!games?.length) return '0';
  const first = games[0];
  const last = games[games.length - 1];
  return `${games.length}:${first?.match}:${last?.match}:${last?.result}`;
}

export function cachedCalcStats(games, gameId, calcStatsFn) {
  if (!games?.length) return calcStatsFn(games, gameId);
  const key = `${gamesVersion}|${gameId}|${gamesTailKey(games)}`;
  if (statsCache.has(key)) return statsCache.get(key);
  const result = calcStatsFn(games, gameId);
  statsCache.set(key, result);
  pruneMap(statsCache);
  return result;
}

function filtersKey(filters) {
  return JSON.stringify(filters ?? {});
}

export function cachedApplyFilters(games, filters, gameId, applyFiltersFn) {
  const key = `${gamesVersion}|${gameId}|${gamesTailKey(games)}|${filtersKey(filters)}`;
  if (filterCache.has(key)) return filterCache.get(key);
  const result = applyFiltersFn(games, filters, gameId);
  filterCache.set(key, result);
  pruneMap(filterCache);
  return result;
}
