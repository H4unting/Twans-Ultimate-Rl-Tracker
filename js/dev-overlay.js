/** Dev validation overlay — off unless localStorage dev-overlay=1 or ?dev=1 */

import { state } from './state.js';

const REFRESH_MS = 1000;
let panel = null;
let refreshTimer = null;
let analyzeOutput = null;
let activeTimers = 0;
let activeIntervals = 0;
let timersPatched = false;
let listenersPatched = false;
let fpsRaf = null;
let fpsFrames = 0;
let fpsLast = 0;
let fpsValue = 0;

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

function patchListenerRegistry() {
  if (listenersPatched || typeof window === 'undefined' || !EventTarget?.prototype) return;
  listenersPatched = true;
  const registry = new Map();
  window.__LISTENER_REGISTRY = registry;

  const origAdd = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function listenerTrack(type, listener, options) {
    const tag = this === document ? 'document'
      : this === window ? 'window'
        : this.id ? `#${this.id}` : (this.tagName || 'node').toLowerCase();
    const key = `${tag}:${type}`;
    registry.set(key, (registry.get(key) || 0) + 1);
    return origAdd.call(this, type, listener, options);
  };
}

function bootMark(phase) {
  const marks = window.__BOOT_MARKS;
  if (!marks?.length) return null;
  return marks.find(m => m.phase === phase) ?? null;
}

function bootDurationMs() {
  const finished = bootMark('boot-finished');
  if (finished) return `${finished.ms}ms`;
  const marks = window.__BOOT_MARKS;
  if (!marks?.length) return window.__appReady ? 'ready' : '…';
  const last = marks[marks.length - 1];
  return `${last.ms}ms (${last.phase})`;
}

function markMs(phase) {
  const m = bootMark(phase);
  return m != null ? `${m.ms}ms` : '—';
}

function memMb() {
  const m = performance.memory;
  if (!m) return 'n/a';
  return `${Math.round(m.usedJSHeapSize / 1048576)} MB`;
}

function listenerCount() {
  const reg = window.__LISTENER_REGISTRY;
  if (!reg?.size) return 0;
  let total = 0;
  reg.forEach(n => { total += n; });
  return total;
}

function startFpsLoop() {
  if (fpsRaf != null) return;
  fpsLast = performance.now();
  const tick = (now) => {
    fpsFrames += 1;
    if (now - fpsLast >= 1000) {
      fpsValue = fpsFrames;
      fpsFrames = 0;
      fpsLast = now;
    }
    fpsRaf = requestAnimationFrame(tick);
  };
  fpsRaf = requestAnimationFrame(tick);
}

function row(label, value) {
  return `<div class="dev-overlay-row"><span>${label}</span><span>${value}</span></div>`;
}

function analyzePerformance() {
  const w = window;
  const lines = [];
  const dash = w.__DASH_RENDER_COUNT ?? 0;
  const matchLog = w.__MATCHLOG_RENDER_COUNT ?? 0;
  const review = w.__REVIEW_RENDER_COUNT ?? 0;
  const squad = w.__SQUAD_RENDER_COUNT ?? 0;
  const charts = w.__CHARTS_RENDER_COUNT ?? 0;
  const listeners = listenerCount();

  if (dash > 20) {
    lines.push(`High dash renders (${dash}) — likely causes:`);
    if (matchLog > 5 && (state?.activePage ?? 'dashboard') === 'dashboard') {
      lines.push('• Match log rendering while on dashboard (should be page-gated).');
    }
    if (w.__MATCH_SAVE_DASH_RENDERS > dash * 0.5) {
      lines.push('• Frequent match-save dashboard patches — verify throttle (≤1/save).');
    }
    if (activeIntervals > 8) lines.push(`• ${activeIntervals} active intervals — check stacked timers.`);
    if ((w.__BRIDGE_REQUEST_COUNT ?? 0) > 60) {
      lines.push('• Bridge heartbeat traffic — normal ~10/min idle; higher suggests poll stacking.');
    }
    if (!lines[1]) lines.push('• Scroll deferral, session UI refresh, or tracker-data-changed bursts.');
  } else if (dash > 8) {
    lines.push(`Moderate dash renders (${dash}) — watch idle count over 10s (target ≤ +2).`);
  } else {
    lines.push(`Dash render count OK (${dash}).`);
  }

  if (listeners > 120) {
    lines.push(`Duplicate listener risk: __LISTENER_REGISTRY total ${listeners} — re-bind on innerHTML rebuild (quicklog, groups, reports).`);
  } else if (listeners > 0) {
    lines.push(`Listeners tracked (post-overlay): ${listeners} — patch runs after init; pre-existing listeners not counted.`);
  }

  const fp = bootMark('first-paint');
  const interactive = bootMark('interactive');
  const dataStart = bootMark('load-user-data-start');
  const dataLoaded = bootMark('data-loaded');
  if (fp && interactive && interactive.ms - fp.ms > 500) {
    lines.push(`Startup paint gap ${interactive.ms - fp.ms}ms (first-paint → interactive) — check shell skeleton + cache.`);
  }
  if (dataStart && dataLoaded && dataLoaded.ms - dataStart.ms > 2500) {
    lines.push(`loadUserData took ${dataLoaded.ms - dataStart.ms}ms — Supabase/network; shell should stay visible (no overlay).`);
  }
  const dom = bootMark('dom-ready');
  const auth = bootMark('auth-ready');
  if (dom && auth && auth.ms - dom.ms > 3000) {
    lines.push(`Auth probe slow (${auth.ms - dom.ms}ms dom→auth) — cold sign-in or network.`);
  }
  if (!fp) lines.push('Missing first-paint mark — boot before signed-in shell?');

  lines.push('');
  lines.push('Recommendations (manual — not auto-fixed):');
  if (dash > 15) lines.push('• Log a match; __MATCH_SAVE_DASH_RENDERS should +1, not full renderAll.');
  if (charts > dash && charts > 4) lines.push('• Charts rebuilding often — scroll #dash-performance once; verify IntersectionObserver gate.');
  if (review > 0 && (state?.activePage ?? 'dashboard') === 'dashboard') {
    lines.push('• Review render count > 0 on dashboard — hidden page leak.');
  }
  if (squad > 0 && (state?.activePage ?? 'dashboard') !== 'group') {
    lines.push('• Squad renders off-page — audit renderAll paths.');
  }
  if (lines.length <= 2) {
    lines.push('• No critical issues from counters — run idle 10s soak: dash ≤ +2.');
  }

  return lines.join('\n');
}

function runGuardrailCheck() {
  const w = window;
  const issues = [];
  if ((w.__REFRESH_AFTER_GAME_DATA_CHANGE_COUNT ?? 0) === 0) {
    issues.push('No refreshAfterGameDataChange calls yet — log a match to verify coalesced path.');
  } else {
    issues.push(`refreshAfterGameDataChange: ${w.__REFRESH_AFTER_GAME_DATA_CHANGE_COUNT} (expected on save/edit).`);
  }
  if (w.__LAST_MATCH_SAVE_MS != null) {
    issues.push(`Last save: ${w.__LAST_MATCH_SAVE_MS}ms`);
  }
  if (w.__MATCH_END_DETECT_MS != null) {
    issues.push(`Match-end detect: ${w.__MATCH_END_DETECT_MS}ms (process exit → bridge payload)`);
  }
  if ((w.__MATCH_SAVE_DASH_RENDERS ?? 0) > 0) {
    issues.push(`Match-save dash patches: ${w.__MATCH_SAVE_DASH_RENDERS}`);
  }
  issues.push('Guardrail: submitGameLog must use scheduleRefreshAfterGameDataChange, not renderAll.');
  return issues.join('\n');
}

function bootTimelineHtml() {
  const marks = window.__BOOT_MARKS;
  if (!marks?.length) return '';
  const rows = marks.map(m => `<div class="dev-overlay-row dev-overlay-mark"><span>${m.phase}</span><span>${m.ms}ms</span></div>`).join('');
  return `<div class="dev-overlay-section">Boot timeline</div>${rows}`;
}

function refreshPanel() {
  if (!panel) return;
  const w = window;
  panel.innerHTML = `
    <div class="dev-overlay-title">Dev overlay</div>
    ${bootTimelineHtml()}
    ${row('Boot total', bootDurationMs())}
    ${row('First paint', markMs('first-paint'))}
    ${row('Interactive', markMs('interactive'))}
    ${row('Auth ready', markMs('auth-ready'))}
    ${row('Data loaded', markMs('data-loaded'))}
    ${row('Dashboard', markMs('dashboard-rendered'))}
    ${row('Dash renders', w.__DASH_RENDER_COUNT ?? 0)}
    ${row('Match log', w.__MATCHLOG_RENDER_COUNT ?? 0)}
    ${row('Review', w.__REVIEW_RENDER_COUNT ?? 0)}
    ${row('Squad', w.__SQUAD_RENDER_COUNT ?? 0)}
    ${row('Charts', w.__CHARTS_RENDER_COUNT ?? 0)}
    ${row('Save refresh', w.__REFRESH_AFTER_GAME_DATA_CHANGE_COUNT ?? 0)}
    ${row('Bridge req', w.__BRIDGE_REQUEST_COUNT ?? 0)}
    ${row('Supabase req', w.__SUPABASE_REQUEST_COUNT ?? 0)}
    ${row('Listeners', listenerCount() || '—')}
    ${row('Timers', activeTimers)}
    ${row('Intervals', activeIntervals)}
    ${row('Memory', memMb())}
    ${row('FPS', fpsValue || '…')}
    ${row('Last save', w.__LAST_MATCH_SAVE_MS != null ? `${w.__LAST_MATCH_SAVE_MS}ms` : '—')}
    ${row('Match-end detect', w.__MATCH_END_DETECT_MS != null ? `${w.__MATCH_END_DETECT_MS}ms` : '—')}
    <div class="dev-overlay-actions">
      <button type="button" id="dev-overlay-analyze">Analyze Performance</button>
      <button type="button" id="dev-overlay-guardrail">Test save guardrail</button>
    </div>
    <pre class="dev-overlay-output" id="dev-overlay-output" hidden></pre>
  `;

  panel.querySelector('#dev-overlay-analyze')?.addEventListener('click', () => {
    const out = panel.querySelector('#dev-overlay-output');
    if (out) {
      out.hidden = false;
      out.textContent = analyzePerformance();
    }
  });
  panel.querySelector('#dev-overlay-guardrail')?.addEventListener('click', () => {
    const out = panel.querySelector('#dev-overlay-output');
    if (out) {
      out.hidden = false;
      out.textContent = runGuardrailCheck();
    }
  });
}

function injectStyles() {
  if (document.getElementById('dev-overlay-styles')) return;
  const style = document.createElement('style');
  style.id = 'dev-overlay-styles';
  style.textContent = `
    #dev-overlay-panel {
      position: fixed; right: 8px; bottom: 8px; z-index: 99999;
      min-width: 188px; max-width: 320px; padding: 8px 10px;
      font: 11px/1.35 ui-monospace, monospace;
      color: #c8d0dc; background: rgba(12, 14, 22, 0.92);
      border: 1px solid rgba(255,255,255,0.12); border-radius: 6px;
      pointer-events: auto; box-shadow: 0 4px 16px rgba(0,0,0,0.45);
    }
    #dev-overlay-panel .dev-overlay-title {
      font-weight: 600; color: #8ab4ff; margin-bottom: 4px; letter-spacing: 0.02em;
    }
    #dev-overlay-panel .dev-overlay-row {
      display: flex; justify-content: space-between; gap: 12px;
    }
    #dev-overlay-panel .dev-overlay-row span:last-child { color: #e8eaed; }
    #dev-overlay-panel .dev-overlay-section {
      font-weight: 600; color: #7a8699; margin: 6px 0 2px; font-size: 10px;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    #dev-overlay-panel .dev-overlay-mark span:first-child { color: #9aa0a6; max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
    #dev-overlay-panel .dev-overlay-actions {
      display: flex; flex-direction: column; gap: 4px; margin-top: 6px;
    }
    #dev-overlay-panel .dev-overlay-actions button {
      font: inherit; font-size: 10px; padding: 4px 6px; cursor: pointer;
      color: #c8d0dc; background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15); border-radius: 4px;
    }
    #dev-overlay-panel .dev-overlay-actions button:hover {
      background: rgba(138,180,255,0.15);
    }
    #dev-overlay-panel .dev-overlay-output {
      margin: 6px 0 0; padding: 6px; max-height: 140px; overflow: auto;
      font-size: 10px; line-height: 1.4; white-space: pre-wrap;
      background: rgba(0,0,0,0.35); border-radius: 4px; color: #b8c4d8;
    }
  `;
  document.head.appendChild(style);
}

/** Exposed for QA — verify match-save uses refresh path, not renderAll */
export function runDevGuardrailCheck() {
  return runGuardrailCheck();
}

export function initDevOverlay() {
  if (!isDevOverlayEnabled() || panel) return;
  patchTimerTracking();
  patchListenerRegistry();
  injectStyles();
  startFpsLoop();
  panel = document.createElement('div');
  panel.id = 'dev-overlay-panel';
  panel.setAttribute('aria-hidden', 'true');
  document.body.appendChild(panel);
  refreshPanel();
  refreshTimer = setInterval(refreshPanel, REFRESH_MS);
  window.__runDevGuardrailCheck = runDevGuardrailCheck;
}
