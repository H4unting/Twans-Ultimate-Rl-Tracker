/** Host mode — live site = glance (read-only), localhost = grind (log & edit) */

export function isGrindHost() {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

export function isGlanceMode() {
  return !isGrindHost();
}

export function applyAppMode() {
  document.body.classList.toggle('glance-mode', isGlanceMode());
  document.body.classList.toggle('grind-mode', isGrindHost());
  document.getElementById('glance-banner')?.classList.toggle('hidden', isGrindHost());
}
