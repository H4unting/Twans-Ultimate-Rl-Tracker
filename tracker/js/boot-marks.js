/** Shared startup timeline marks — console [boot +Nms], window.__BOOT_MARKS, dev overlay */

let bootT0 = 0;

export function markBoot(phase) {
  if (!bootT0 && typeof performance !== 'undefined') bootT0 = performance.now();
  const elapsed = bootT0 && typeof performance !== 'undefined'
    ? Math.round(performance.now() - bootT0)
    : 0;
  console.info(`[boot +${elapsed}ms] ${phase}`);
  if (typeof window !== 'undefined') {
    (window.__BOOT_MARKS ||= []).push({ phase, ms: elapsed });
  }
}

/** Inline index.html script — no ES module scope */
export function pushBootMark(phase, ms = 0) {
  if (typeof window !== 'undefined') {
    (window.__BOOT_MARKS ||= []).push({ phase, ms });
  }
  console.info(`[boot +${ms}ms] ${phase}`);
}
