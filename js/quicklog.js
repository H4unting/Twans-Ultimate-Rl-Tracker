/** Quick Log dock — fast mid-session logging with keyboard shortcuts */

import { state } from './state.js';
import { GAME_IDS, getTagGroups, getAgents, getMaps } from './games.js';
import { showToast } from './ui.js';
import { getLoggingSessionNum } from './sessions.js';

const PREFS_KEY = 'rl-grind-prefs';

const prefs = loadPrefs();
let callbacks = {};
let quickTags = [];
let audioCtx = null;
let audioUnlockWired = false;

function getAudioContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

export async function unlockAutoLogAudio() {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  return ctx.state === 'running';
}

function wireAudioUnlock() {
  if (audioUnlockWired) return;
  audioUnlockWired = true;
  const unlock = () => { unlockAutoLogAudio(); };
  document.addEventListener('pointerdown', unlock, { once: true, capture: true });
  document.addEventListener('keydown', unlock, { once: true, capture: true });
  document.addEventListener('rl-session-start', () => { void playSessionStartSound(); });
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('#session-start-btn')) unlockAutoLogAudio();
  }, { capture: true });
}

async function playTone(freq, duration = 0.18, volume = 0.14) {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  if (ctx.state !== 'running') return false;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
  return true;
}

export async function playSessionStartSound() {
  if (!isAutoLogSoundEnabled()) return;
  await playTone(523, 0.12, 0.16);
  await new Promise(r => setTimeout(r, 70));
  await playTone(784, 0.14, 0.16);
}

export function loadPrefs() {
  try {
    return { lastMode: "2's", autoLog: true, autoLogSound: true, dockCollapsed: false, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return { lastMode: "2's", autoLog: true, autoLogSound: true, dockCollapsed: false };
  }
}

export function isDockCollapsed() {
  return loadPrefs().dockCollapsed === true;
}

export function setDockCollapsed(collapsed) {
  savePrefs({ dockCollapsed: !!collapsed });
  applyDockCollapsedState();
}

export function expandDock() {
  setDockCollapsed(false);
}

export function collapseDock() {
  setDockCollapsed(true);
}

export function toggleDockCollapsed() {
  setDockCollapsed(!isDockCollapsed());
}

export function updateCollapsedStripLabel() {
  const el = document.getElementById('quick-dock-collapsed-label');
  if (!el) return;
  const title = document.getElementById('session-bar-title')?.textContent?.trim() || 'Log';
  const stats = document.getElementById('session-live-stats')?.textContent?.trim();
  el.textContent = stats ? `${title} · ${stats}` : title;
}

export function applyDockCollapsedState() {
  const collapsed = isDockCollapsed();
  const dock = document.getElementById('quick-dock');
  const visible = dock && !dock.classList.contains('hidden');
  dock?.classList.toggle('collapsed', collapsed);
  document.body.classList.toggle('quick-dock-collapsed', collapsed && visible);
  updateCollapsedStripLabel();
}

export function isAutoLogSoundEnabled() {
  return loadPrefs().autoLogSound !== false;
}

export function setAutoLogSoundEnabled(on) {
  savePrefs({ autoLogSound: !!on });
  document.getElementById('auto-log-sound-toggle')?.classList.toggle('active', !!on);
  document.getElementById('auto-log-sound-toggle')?.setAttribute('aria-pressed', on ? 'true' : 'false');
}

export function isAutoLogEnabled() {
  return loadPrefs().autoLog !== false;
}

export function setAutoLogEnabled(on) {
  savePrefs({ autoLog: !!on });
  document.getElementById('auto-log-toggle')?.classList.toggle('active', !!on);
  document.getElementById('auto-log-toggle')?.setAttribute('aria-pressed', on ? 'true' : 'false');
}

export function savePrefs(partial) {
  Object.assign(prefs, partial);
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function initQuickLog(cbs) {
  callbacks = cbs;
  wireDock();
  wireKeyboard();
  wireAudioUnlock();
  applyPrefs();
}

export function showQuickDock() {
  document.getElementById('quick-dock')?.classList.remove('hidden');
  document.body.classList.add('has-quick-dock');
  applyDockCollapsedState();
  syncStartMMR();
}

export function hideQuickDock() {
  document.getElementById('quick-dock')?.classList.add('hidden');
  document.body.classList.remove('has-quick-dock');
  document.body.classList.remove('quick-dock-collapsed');
}

export function syncQuickFromForm() {
  const mode = document.getElementById('f-mode')?.value ?? prefs.lastMode;
  setQuickMode(mode);
  setQuickResult(document.getElementById('wl-win')?.classList.contains('active') ? 'W' : 'L');
  const end = document.getElementById('f-endmmr')?.value;
  const qEnd = document.getElementById('quick-endmmr');
  if (qEnd && end) qEnd.value = end;
}

export function syncFormFromQuick() {
  const mode = getQuickMode();
  const fMode = document.getElementById('f-mode');
  if (fMode) fMode.value = mode;
  savePrefs({ lastMode: mode });

  const result = getQuickResult();
  callbacks.setFormResult?.(result);

  const end = document.getElementById('quick-endmmr')?.value;
  const fEnd = document.getElementById('f-endmmr');
  const fStart = document.getElementById('f-startmmr');
  if (fEnd && end) fEnd.value = end;
  if (fStart && callbacks.getLastMMR) {
    const last = callbacks.getLastMMR(getQuickMode());
    fStart.value = last !== '' ? last : '';
  }

  const notes = document.getElementById('quick-notes')?.value ?? '';
  const fNotes = document.getElementById('f-notes');
  if (fNotes) fNotes.value = notes;

  stateSyncTagsToForm();
}

export function getQuickLogPayload() {
  syncFormFromQuick();
  const isVal = state.activeGame === GAME_IDS.VALORANT;
  const base = {
    date: document.getElementById('f-date')?.value,
    session: getLoggingSessionNum(),
    mode: getQuickMode(),
    result: getQuickResult(),
    notes: document.getElementById('quick-notes')?.value ?? '',
  };
  if (isVal) {
    return {
      ...base,
      kills: getQuickStat('goals'),
      deaths: getQuickStat('assists'),
      valAssists: parseInt(document.getElementById('quick-val-assists')?.value, 10) || 0,
      acs: getQuickStat('saves'),
      goals: getQuickStat('goals'),
      assists: getQuickStat('assists'),
      saves: getQuickStat('saves'),
      agent: document.getElementById('quick-agent')?.value ?? '',
      map: document.getElementById('quick-map')?.value ?? '',
      startRR: document.getElementById('f-startmmr')?.value,
      endRR: document.getElementById('quick-endmmr')?.value,
      startMMR: document.getElementById('f-startmmr')?.value,
      endMMR: document.getElementById('quick-endmmr')?.value,
    };
  }
  return {
    ...base,
    goals: getQuickStat('goals'),
    assists: getQuickStat('assists'),
    saves: getQuickStat('saves'),
    startMMR: document.getElementById('f-startmmr')?.value,
    endMMR: document.getElementById('quick-endmmr')?.value,
  };
}

export function applyLiveStats(stats) {
  setQuickStat('goals', stats.kills ?? stats.goals ?? 0);
  setQuickStat('assists', stats.deaths ?? stats.assists ?? 0);
  setQuickStat('saves', stats.acs ?? stats.saves ?? 0);
  const va = document.getElementById('quick-val-assists');
  if (va) va.value = stats.valAssists ?? 0;
  if (stats.result) setQuickResult(stats.result);
  if (stats.mode) setQuickMode(stats.mode);
  if (stats.agent) {
    const agentSel = document.getElementById('quick-agent');
    if (agentSel) agentSel.value = stats.agent;
  }
  if (stats.map) {
    const mapSel = document.getElementById('quick-map');
    if (mapSel) mapSel.value = stats.map;
  }
}

export function getQuickStat(stat) {
  return parseInt(document.getElementById(`quick-${stat}-val`)?.textContent ?? '0', 10) || 0;
}

export function setQuickStat(stat, val) {
  const n = Math.max(0, parseInt(val, 10) || 0);
  const el = document.getElementById(`quick-${stat}-val`);
  if (el) el.textContent = n;
  const field = document.getElementById(`f-${stat}`);
  if (field) field.value = n;
}

function bumpStat(stat, delta) {
  setQuickStat(stat, getQuickStat(stat) + delta);
}

export function resetQuickAfterLog() {
  const qEnd = document.getElementById('quick-endmmr');
  const qNotes = document.getElementById('quick-notes');
  if (qEnd) { qEnd.value = ''; qEnd.focus(); }
  if (qNotes) qNotes.value = '';
  setQuickStat('goals', 0);
  setQuickStat('assists', 0);
  setQuickStat('saves', 0);
  quickTags = [];
  renderQuickTags();
  syncStartMMR();
}

function syncStartMMR() {
  const last = callbacks.getLastMMR?.(getQuickMode());
  const fStart = document.getElementById('f-startmmr');
  if (fStart && last !== '') fStart.value = last;
}

function getQuickMode() {
  return document.querySelector('#quick-mode-pills .active')?.dataset.mode ?? prefs.lastMode ?? "2's";
}

export function setQuickMode(mode) {
  document.querySelectorAll('#quick-mode-pills button').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  const fMode = document.getElementById('f-mode');
  if (fMode) fMode.value = mode;
}

function getQuickResult() {
  return document.getElementById('quick-wl-win')?.classList.contains('active') ? 'W' : 'L';
}

export function setQuickResult(r) {
  document.getElementById('quick-wl-win')?.classList.toggle('active', r === 'W');
  document.getElementById('quick-wl-loss')?.classList.toggle('active', r === 'L');
  callbacks.setFormResult?.(r);
}

function applyPrefs() {
  setQuickMode(prefs.lastMode ?? "2's");
  setAutoLogEnabled(isAutoLogEnabled());
  setAutoLogSoundEnabled(isAutoLogSoundEnabled());
  applyDockCollapsedState();
}

export async function playAutoLogSound() {
  if (!isAutoLogSoundEnabled()) return;
  await playTone(880, 0.2, 0.14);
}

export function flashAutoLogged() {
  const inner = document.querySelector('.quick-dock-inner');
  if (!inner) return;
  inner.classList.add('auto-logged');
  playAutoLogSound();
  setTimeout(() => inner.classList.remove('auto-logged'), 1400);
}

function renderQuickTags() {
  const el = document.getElementById('quick-tags');
  if (!el) return;
  const groups = getTagGroups(state.activeGame);
  const hotTags = (groups.flatMap(g => g.tags)).slice(0, 6);
  el.innerHTML = hotTags.map(tag => {
    const cat = groups.find(g => g.tags.includes(tag))?.cat ?? 'def';
    const sel = quickTags.includes(tag) ? ' selected' : '';
    return `<button type="button" class="tag-chip ${cat}${sel}" data-tag="${tag}">${tag}</button>`;
  }).join('');
  el.querySelectorAll('[data-tag]').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('selected');
      const tag = chip.dataset.tag;
      if (chip.classList.contains('selected')) {
        if (!quickTags.includes(tag)) quickTags.push(tag);
      } else {
        quickTags = quickTags.filter(t => t !== tag);
      }
      stateSyncTagsToForm();
    });
  });
}

function stateSyncTagsToForm() {
  callbacks.setSelectedTags?.(quickTags);
  document.querySelectorAll('#log-tags .tag-chip').forEach(chip => {
    chip.classList.toggle('selected', quickTags.includes(chip.dataset.tag));
  });
}

function wireDock() {
  renderQuickTags();

  document.getElementById('dock-collapse-btn')?.addEventListener('click', () => collapseDock());
  document.getElementById('quick-dock-expand-btn')?.addEventListener('click', () => expandDock());

  document.addEventListener('rl-session-ui-refresh', updateCollapsedStripLabel);

  document.getElementById('quick-wl-win')?.addEventListener('click', () => setQuickResult('W'));
  document.getElementById('quick-wl-loss')?.addEventListener('click', () => setQuickResult('L'));

  document.getElementById('quick-log-btn')?.addEventListener('click', () => {
    unlockAutoLogAudio();
    callbacks.submitQuick?.();
  });

  document.getElementById('auto-log-toggle')?.addEventListener('click', () => {
    setAutoLogEnabled(!isAutoLogEnabled());
    showToast(isAutoLogEnabled() ? 'Auto-log ON — games save when a match ends' : 'Auto-log OFF — manual LOG');
    callbacks.onAutoLogToggle?.();
  });

  document.getElementById('auto-log-sound-toggle')?.addEventListener('click', async () => {
    setAutoLogSoundEnabled(!isAutoLogSoundEnabled());
    showToast(isAutoLogSoundEnabled() ? 'Auto-log sound ON' : 'Auto-log sound OFF');
    if (isAutoLogSoundEnabled()) {
      await unlockAutoLogAudio();
      playAutoLogSound();
    }
  });

  document.querySelectorAll('#quick-mode-pills button').forEach(btn => {
    btn.addEventListener('click', () => {
      setQuickMode(btn.dataset.mode);
      savePrefs({ lastMode: btn.dataset.mode });
      syncStartMMR();
    });
  });

  document.getElementById('f-mode')?.addEventListener('change', e => {
    setQuickMode(e.target.value);
    savePrefs({ lastMode: e.target.value });
    syncStartMMR();
  });

  document.querySelectorAll('.qs-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      bumpStat(btn.dataset.stat, parseInt(btn.dataset.delta, 10));
    });
  });
}

function wireKeyboard() {
  document.addEventListener('keydown', e => {
    if (!document.body.classList.contains('has-quick-dock')) return;
    if (document.body.classList.contains('logged-out')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const tag = e.target?.tagName?.toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select';

    if (typing && e.target?.id !== 'quick-endmmr') return;

    if (e.key === 'h' || e.key === 'H') {
      if (!typing) { e.preventDefault(); toggleDockCollapsed(); }
    } else if (e.key === 'w' || e.key === 'W') {
      if (!typing) { e.preventDefault(); setQuickResult('W'); }
    } else if (e.key === 'l' || e.key === 'L') {
      if (!typing) { e.preventDefault(); setQuickResult('L'); }
    } else if (e.key === 'Enter' && (e.target?.id === 'quick-endmmr' || !typing)) {
      const end = document.getElementById('quick-endmmr')?.value;
      if (end) { e.preventDefault(); callbacks.submitQuick?.(); }
    }
  });
}
