/** Dev validation overlay — off unless localStorage dev-overlay=1 or ?dev=1 */

const REFRESH_MS = 1000;
let panel = null;
let refreshTimer = null;
let activeTimers = 0;
let activeIntervals = 0;
let timersPatched = false;

export function isDevOverlayEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem('dev-overlay') === '1') return true;
  } catch { /* private mode */ }
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get('dev') === '1') {
      try { localStorage.setItem('dev-overlay', '1'); } catch { /* ignore */ }
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

function patchTimerTracking() {
  if (timersPatched || typeof window === 'undefined') return;
  timersPatched = true;
  const origSetTimeout = window.setTimeout.bind(window);
  const origSetInterval = window.setInterval.bind(window);
  const origClearTimeout = window.clearTimeout.bind(window);
  const origClearInterval = window.clearInterval.bind(window);
  const timeoutIds = new Set();
  const intervalIds = new Set();

  window.setTimeout = (...args) => {
    const id = origSetTimeout(...args);
    timeoutIds.add(id);
    activeTimers = timeoutIds.size;
    return id;
  };
  window.setInterval = (...args) => {
    const id = origSetInterval(...args);
    intervalIds.add(id);
    activeIntervals = intervalIds.size;
    return id;
  };
  window.clearTimeout = (id) => {
    timeoutIds.delete(id);
    activeTimers = timeoutIds.size;
    origClearTimeout(id);
  };
  window.clearInterval = (id) => {
    intervalIds.delete(id);
    activeIntervals = intervalIds.size;
    origClearInterval(id);
  };
}

function bootMs() {
  const marks = window.__BOOT_MARKS;
  if (!marks?.length) return window.__appReady ? 'ready' : '…';
  const last = marks[marks.length - 1];
  return `${last.ms}ms (${last.phase})`;
}

function memMb() {
  const m = performance.memory;
  if (!m) return 'n/a';
  return `${Math.round(m.usedJSHeapSize / 1048576)} MB`;
}

function row(label, value) {
  return `<div class="dev-overlay-row"><span>${label}</span><span>${value}</span></div>`;
}

function refreshPanel() {
  if (!panel) return;
  const w = window;
  panel.innerHTML = `
    <div class="dev-overlay-title">Dev overlay</div>
    ${row('Startup', bootMs())}
    ${row('Dash renders', w.__DASH_RENDER_COUNT ?? 0)}
    ${row('Match log', w.__MATCHLOG_RENDER_COUNT ?? 0)}
    ${row('Review', w.__REVIEW_RENDER_COUNT ?? 0)}
    ${row('Squad', w.__SQUAD_RENDER_COUNT ?? 0)}
    ${row('Charts', w.__CHARTS_RENDER_COUNT ?? 0)}
    ${row('Timers', activeTimers)}
    ${row('Intervals', activeIntervals)}
    ${row('Supabase req', w.__SUPABASE_REQUEST_COUNT ?? 0)}
    ${row('Memory', memMb())}
    ${row('Last save', w.__LAST_MATCH_SAVE_MS != null ? `${w.__LAST_MATCH_SAVE_MS}ms` : '—')}
  `;
}

function injectStyles() {
  if (document.getElementById('dev-overlay-styles')) return;
  const style = document.createElement('style');
  style.id = 'dev-overlay-styles';
  style.textContent = `
    #dev-overlay-panel {
      position: fixed; right: 8px; bottom: 8px; z-index: 99999;
      min-width: 168px; padding: 8px 10px; font: 11px/1.35 ui-monospace, monospace;
      color: #c8d0dc; background: rgba(12, 14, 22, 0.92);
      border: 1px solid rgba(255,255,255,0.12); border-radius: 6px;
      pointer-events: none; box-shadow: 0 4px 16px rgba(0,0,0,0.45);
    }
    #dev-overlay-panel .dev-overlay-title {
      font-weight: 600; color: #8ab4ff; margin-bottom: 4px; letter-spacing: 0.02em;
    }
    #dev-overlay-panel .dev-overlay-row {
      display: flex; justify-content: space-between; gap: 12px;
    }
    #dev-overlay-panel .dev-overlay-row span:last-child { color: #e8eaed; }
  `;
  document.head.appendChild(style);
}

export function initDevOverlay() {
  if (!isDevOverlayEnabled() || panel) return;
  patchTimerTracking();
  injectStyles();
  panel = document.createElement('div');
  panel.id = 'dev-overlay-panel';
  panel.setAttribute('aria-hidden', 'true');
  document.body.appendChild(panel);
  refreshPanel();
  refreshTimer = setInterval(refreshPanel, REFRESH_MS);
}
