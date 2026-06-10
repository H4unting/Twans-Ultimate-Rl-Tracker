/** Phase 1 offline queue — retry failed Supabase writes on reconnect */

const QUEUE_KEY = 'rl-grind-offline-queue';
const MAX_QUEUE = 40;

function loadQueue() {
  try {
    const raw = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveQueue(items) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUE)));
  } catch {
    /* quota */
  }
}

function isRetryableError(e) {
  const msg = String(e?.message ?? e);
  if (e?.name === 'AbortError' || /abort/i.test(msg)) return true;
  if (/failed to fetch|network|timeout|timed out|load failed/i.test(msg)) return true;
  return false;
}

export function getOfflineQueueSize() {
  return loadQueue().length;
}

export function enqueueOfflineWrite(entry) {
  const queue = loadQueue();
  queue.push({ ...entry, queuedAt: Date.now() });
  saveQueue(queue);
}

/** @param {{ saveGames?: Function, saveSettings?: Function }} handlers */
export async function flushOfflineQueue(handlers = {}) {
  const queue = loadQueue();
  if (!queue.length) return 0;

  const remaining = [];
  let flushed = 0;

  for (const item of queue) {
    try {
      if (item.type === 'games' && handlers.saveGames) {
        await handlers.saveGames(item.games, item.gameId ?? null, { fromQueue: true });
        flushed += 1;
      } else if (item.type === 'settings' && handlers.saveSettings) {
        await handlers.saveSettings(item.settings, { fromQueue: true });
        flushed += 1;
      } else {
        remaining.push(item);
      }
    } catch (e) {
      if (isRetryableError(e)) remaining.push(item);
      else remaining.push(item);
    }
  }

  saveQueue(remaining);
  return flushed;
}

export function shouldQueueSyncError(e) {
  return isRetryableError(e);
}
