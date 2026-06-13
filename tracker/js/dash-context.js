/** Dashboard visibility helpers — shared by pollers and render schedulers */

import { state } from './state.js';

export function isDashboardPage() {
  return (state.activePage || 'dashboard') === 'dashboard';
}

/** On dashboard with no live grind session — safe to slow polls and defer DOM work */
export function isDashboardIdle() {
  return isDashboardPage() && !state.session.active;
}
