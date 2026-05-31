/** Shared local bridge online state (RL + Valorant) */

let bridgeOnline = false;

export function setBridgeOnline(online) {
  bridgeOnline = Boolean(online);
}

export function isBridgeUp() {
  return bridgeOnline;
}
