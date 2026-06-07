/** Date/time helpers — game-agnostic */

export function parseDisplayDate(dateStr) {
  if (!dateStr) return null;
  const [mm, dd, yy] = dateStr.split('/');
  return new Date(2000 + parseInt(yy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
}

export function formatDisplayDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
}

export function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function getWeekEnd(weekStart) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d;
}

export function formatWeekLabel(weekStart, weekEnd) {
  const opts = { month: 'short', day: 'numeric' };
  const a = weekStart.toLocaleDateString('en-US', opts);
  const b = weekEnd.toLocaleDateString('en-US', { ...opts, year: weekStart.getFullYear() !== weekEnd.getFullYear() ? 'numeric' : undefined });
  return `${a} – ${b}`;
}

export function getWeekKey(date) {
  const ws = getWeekStart(date);
  return `${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, '0')}-${String(ws.getDate()).padStart(2, '0')}`;
}
