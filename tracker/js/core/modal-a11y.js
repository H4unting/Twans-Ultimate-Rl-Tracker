/** Focus trap + Escape for modal overlays */

const previousFocus = new Map();

function focusableElements(container) {
  if (!container) return [];
  return [...container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter(el => !el.hidden && el.getAttribute('aria-hidden') !== 'true');
}

export function bindModalA11y(overlayId, { onClose, initialFocusId } = {}) {
  const overlay = document.getElementById(overlayId);
  if (!overlay || overlay.dataset.a11yWired) return;
  overlay.dataset.a11yWired = '1';

  const modal = overlay.querySelector('.modal');

  overlay.addEventListener('keydown', e => {
    if (!overlay.classList.contains('open')) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      onClose?.();
      return;
    }

    if (e.key !== 'Tab') return;

    const items = focusableElements(modal);
    if (!items.length) return;

    const first = items[0];
    const last = items[items.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  const observer = new MutationObserver(() => {
    if (overlay.classList.contains('open')) {
      previousFocus.set(overlayId, document.activeElement);
      const target = (initialFocusId && document.getElementById(initialFocusId))
        || focusableElements(modal)[0]
        || modal;
      target?.focus?.();
    } else {
      const prev = previousFocus.get(overlayId);
      prev?.focus?.();
      previousFocus.delete(overlayId);
    }
  });

  observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
}
