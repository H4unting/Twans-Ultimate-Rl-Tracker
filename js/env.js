/** Single unified app — no separate glance/grind sites */

export function applyAppMode() {
  document.body.classList.remove('glance-mode', 'grind-mode');
  document.body.classList.add('app-unified');
}

export function setBridgeHintVisible(show) {
  document.getElementById('bridge-hint-banner')?.classList.toggle('hidden', !show);
}

/** @deprecated Use auth + bridge status instead — always returns true so logging works everywhere */
export function isGrindHost() {
  return true;
}

/** @deprecated Always false — one platform */
export function isGlanceMode() {
  return false;
}
