/** Quick Log dock — fast mid-session logging with keyboard shortcuts */

import { TAG_GROUPS } from './config.js';
import { showToast } from './ui.js';
import { getLoggingSessionNum } from './sessions.js';

const PREFS_KEY = 'rl-grind-prefs';

const prefs = loadPrefs();
let callbacks = {};
let quickTags = [];

export function loadPrefs() {
  try {
    return { lastMode: "2's", autoLog: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return { lastMode: "2's", autoLog: true };
  }
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
  applyPrefs();
}

export function showQuickDock() {
  document.getElementById('quick-dock')?.classList.remove('hidden');
  document.body.classList.add('has-quick-dock');
  syncStartMMR();
}

export function hideQuickDock() {
  document.getElementById('quick-dock')?.classList.add('hidden');
  document.body.classList.remove('has-quick-dock');
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
    const last = callbacks.getLastMMR();
    if (last !== '') fStart.value = last;
  }

  const notes = document.getElementById('quick-notes')?.value ?? '';
  const fNotes = document.getElementById('f-notes');
  if (fNotes) fNotes.value = notes;

  stateSyncTagsToForm();
}

export function getQuickLogPayload() {
  syncFormFromQuick();
  return {
    date: document.getElementById('f-date')?.value,
    session: getLoggingSessionNum(),
    mode: getQuickMode(),
    result: getQuickResult(),
    goals: getQuickStat('goals'),
    assists: getQuickStat('assists'),
    saves: getQuickStat('saves'),
    startMMR: document.getElementById('f-startmmr')?.value,
    endMMR: document.getElementById('quick-endmmr')?.value,
    notes: document.getElementById('quick-notes')?.value ?? '',
  };
}

export function applyLiveStats(stats) {
  setQuickStat('goals', stats.goals ?? 0);
  setQuickStat('assists', stats.assists ?? 0);
  setQuickStat('saves', stats.saves ?? 0);
  if (stats.result) setQuickResult(stats.result);
  if (stats.mode) setQuickMode(stats.mode);
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
  const last = callbacks.getLastMMR?.();
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
}

export function flashAutoLogged() {
  const inner = document.querySelector('.quick-dock-inner');
  if (!inner) return;
  inner.classList.add('auto-logged');
  setTimeout(() => inner.classList.remove('auto-logged'), 1400);
}

function renderQuickTags() {
  const el = document.getElementById('quick-tags');
  if (!el) return;
  const hotTags = ['Tilt', 'Autopilot', 'Bad Positioning', 'Overcommitting', 'Giving Away Possession', 'Hesitation'];
  el.innerHTML = hotTags.map(tag => {
    const cat = TAG_GROUPS.find(g => g.tags.includes(tag))?.cat ?? 'def';
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

  document.getElementById('quick-wl-win')?.addEventListener('click', () => setQuickResult('W'));
  document.getElementById('quick-wl-loss')?.addEventListener('click', () => setQuickResult('L'));

  document.getElementById('quick-log-btn')?.addEventListener('click', () => callbacks.submitQuick?.());

  document.getElementById('auto-log-toggle')?.addEventListener('click', () => {
    setAutoLogEnabled(!isAutoLogEnabled());
    showToast(isAutoLogEnabled() ? 'Auto-log ON — games save when a match ends' : 'Auto-log OFF — manual LOG');
    callbacks.onAutoLogToggle?.();
  });

  document.querySelectorAll('#quick-mode-pills button').forEach(btn => {
    btn.addEventListener('click', () => {
      setQuickMode(btn.dataset.mode);
      savePrefs({ lastMode: btn.dataset.mode });
    });
  });

  document.getElementById('f-mode')?.addEventListener('change', e => {
    setQuickMode(e.target.value);
    savePrefs({ lastMode: e.target.value });
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

    if (e.key === 'w' || e.key === 'W') {
      if (!typing) { e.preventDefault(); setQuickResult('W'); }
    } else if (e.key === 'l' || e.key === 'L') {
      if (!typing) { e.preventDefault(); setQuickResult('L'); }
    } else if (e.key === 'Enter' && (e.target?.id === 'quick-endmmr' || !typing)) {
      const end = document.getElementById('quick-endmmr')?.value;
      if (end) { e.preventDefault(); callbacks.submitQuick?.(); }
    }
  });
}
