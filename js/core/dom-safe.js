/** Safe HTML/string helpers for user-generated content (XSS mitigation). */

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

/** Allow only http(s) and data:image URLs for img src. */
export function sanitizeImageUrl(url) {
  const s = String(url ?? '').trim();
  if (!s) return '';
  if (s.startsWith('data:image/')) return s;
  try {
    const u = new URL(s);
    if (u.protocol === 'https:' || u.protocol === 'http:') return u.href;
  } catch { /* reject */ }
  return '';
}
