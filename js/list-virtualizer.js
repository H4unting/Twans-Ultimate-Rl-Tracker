/** Windowed list — render only visible rows on scroll. */

export const VIRTUAL_MIN_ITEMS = 20;
export const DEFAULT_OVERSCAN = 4;
export const DEFAULT_ROW_HEIGHT = 52;

/**
 * Mount a virtual scroll surface.
 * @param {object} opts
 * @param {HTMLElement} opts.scrollEl - overflow scroll container
 * @param {HTMLElement} opts.mountEl - tbody or list element for visible slice
 * @param {unknown[]} opts.items
 * @param {(item: unknown, index: number) => string} opts.renderItem
 * @param {number} [opts.rowHeight]
 * @param {number} [opts.overscan]
 * @param {number} [opts.minItems]
 * @param {'list'|'table'} [opts.mode]
 * @param {number} [opts.colspan] - table spacer colspan
 * @param {() => void} [opts.onRangeChange]
 */
export function mountVirtualList({
  scrollEl,
  mountEl,
  items,
  renderItem,
  rowHeight = DEFAULT_ROW_HEIGHT,
  overscan = DEFAULT_OVERSCAN,
  minItems = VIRTUAL_MIN_ITEMS,
  mode = 'list',
  colspan = 1,
  onRangeChange,
}) {
  let destroyed = false;
  let rafId = 0;
  let currentItems = items;
  let measuredHeight = rowHeight;
  let lastStart = -1;
  let lastEnd = -1;
  let lastCount = -1;

  function calcRange() {
    const scrollTop = scrollEl.scrollTop;
    const viewH = scrollEl.clientHeight || scrollEl.offsetHeight || 400;
    const start = Math.max(0, Math.floor(scrollTop / measuredHeight) - overscan);
    const end = Math.min(
      currentItems.length,
      Math.ceil((scrollTop + viewH) / measuredHeight) + overscan,
    );
    return { start, end };
  }

  function measureFirstRow() {
    const row = mode === 'table'
      ? mountEl.querySelector('tr:not(.virtual-spacer)')
      : mountEl.querySelector(':scope > :not(.virtual-spacer)');
    if (row?.offsetHeight > 0) measuredHeight = row.offsetHeight;
  }

  function renderRange(force = false) {
    if (destroyed) return;
    const { start, end } = calcRange();
    if (!force && start === lastStart && end === lastEnd && lastCount === currentItems.length) return;
    lastStart = start;
    lastEnd = end;
    lastCount = currentItems.length;

    const topH = start * measuredHeight;
    const bottomH = Math.max(0, (currentItems.length - end) * measuredHeight);
    const slice = currentItems.slice(start, end);
    const rows = slice.map((item, i) => renderItem(item, start + i)).join('');

    if (mode === 'table') {
      mountEl.innerHTML = `
        <tr class="virtual-spacer" aria-hidden="true"><td colspan="${colspan}" style="height:${topH}px;padding:0;border:none;line-height:0"></td></tr>
        ${rows}
        <tr class="virtual-spacer" aria-hidden="true"><td colspan="${colspan}" style="height:${bottomH}px;padding:0;border:none;line-height:0"></td></tr>`;
    } else {
      mountEl.innerHTML = `
        <div class="virtual-spacer" style="height:${topH}px" aria-hidden="true"></div>
        ${rows}
        <div class="virtual-spacer" style="height:${bottomH}px" aria-hidden="true"></div>`;
    }

    if (start === 0 && slice.length) measureFirstRow();
    onRangeChange?.();
  }

  function onScroll() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      renderRange();
    });
  }

  function attach() {
    scrollEl.classList.add('virtual-scroll-host');
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    renderRange(true);
  }

  function destroy() {
    destroyed = true;
    if (rafId) cancelAnimationFrame(rafId);
    scrollEl.removeEventListener('scroll', onScroll);
    scrollEl.classList.remove('virtual-scroll-host');
  }

  function update(newItems) {
    currentItems = newItems;
    lastStart = -1;
    lastEnd = -1;
    lastCount = -1;
    measuredHeight = rowHeight;
    scrollEl.scrollTop = 0;
    renderRange(true);
  }

  function scrollToIndex(index) {
    scrollEl.scrollTop = Math.max(0, index * measuredHeight);
    renderRange(true);
  }

  if (currentItems.length < minItems) {
    if (mode === 'table') mountEl.innerHTML = currentItems.map((item, i) => renderItem(item, i)).join('');
    else mountEl.innerHTML = currentItems.map((item, i) => renderItem(item, i)).join('');
    onRangeChange?.();
    return { update, destroy: () => {}, scrollToIndex: () => {}, remeasure: () => {} };
  }

  attach();
  return {
    update,
    destroy,
    scrollToIndex,
    remeasure: () => {
      measuredHeight = rowHeight;
      lastStart = -1;
      renderRange(true);
    },
  };
}

export function shouldVirtualize(count, minItems = VIRTUAL_MIN_ITEMS) {
  return count >= minItems;
}
