/**
 * Lightweight client error log — ring buffer in sessionStorage, no external services.
 * Wired from boot.js for uncaught errors; call logError() from catch blocks incrementally.
 */

const STORAGE_KEY = 'rl-grind-error-log';
const MAX_ENTRIES = 50;

function readBuffer() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBuffer(entries) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch { /* quota — ignore */ }
}

export function logError(context, err, options = {}) {
  const msg = err?.message ?? String(err ?? 'Unknown error');
  const entry = {
    t: new Date().toISOString(),
    context: String(context ?? 'app'),
    msg,
    stack: err?.stack ? String(err.stack).slice(0, 800) : undefined,
  };
  console.error(`[tracker:${entry.context}]`, err ?? msg);
  const buf = readBuffer();
  buf.push(entry);
  writeBuffer(buf);
  if (options.toast && options.userMsg) {
    import('../ui.js').then(({ showToast }) => showToast(options.userMsg, 'error')).catch(() => {});
  }
  return entry;
}

export function getErrorLog() {
  return readBuffer();
}

export function clearErrorLog() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function installGlobalErrorHandlers() {
  window.addEventListener('error', (event) => {
    logError('uncaught', event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    logError('unhandledrejection', event.reason);
  });
}
