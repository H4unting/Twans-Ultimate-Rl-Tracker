/** Player-facing status labels — no localhost / bridge / port jargon */

import { GAME_IDS } from './games.js';
import { state } from './state.js';

export function waitingForGameLabel(gameId = state.activeGame) {
  return gameId === GAME_IDS.VALORANT
    ? 'Waiting for Valorant'
    : 'Waiting for Rocket League';
}

export const STATUS = {
  tracking: 'Tracking',
  connectionIssue: 'Connection issue',
  starting: 'Starting…',
  reconnecting: 'Reconnecting…',
  trackingResumed: 'Tracking resumed',
  processingMatch: 'Processing match…',
};

export function trackingLabel(gameId = state.activeGame) {
  return gameId === GAME_IDS.VALORANT
    ? 'Tracking Valorant'
    : 'Tracking Rocket League';
}

export function formatStatusPill(phase, gameId = state.activeGame) {
  if (phase === 'tracking') return `● ${trackingLabel(gameId)}`;
  if (phase === 'error') return `● ${STATUS.connectionIssue}`;
  if (phase === 'reconnecting') return `● ${STATUS.reconnecting}`;
  if (phase === 'connecting') return `● ${STATUS.starting}`;
  return `● ${waitingForGameLabel(gameId)}`;
}

/** Dev-only detail — never show in UI copy */
export function logStatusDebug(context, detail) {
  if (typeof console !== 'undefined' && console.debug) {
    console.debug(`[tracker-status] ${context}`, detail);
  }
}
