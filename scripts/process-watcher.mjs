/** Lightweight Windows process detection for session auto-start */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const RL_IMAGE = 'RocketLeague.exe';
const VAL_IMAGE = 'VALORANT-Win64-Shipping.exe';
const RIOT_CLIENT_IMAGE = 'RiotClientServices.exe';
const CACHE_MS = 3000;

let cache = {
  rocketLeagueRunning: false,
  valorantProcessRunning: false,
  riotClientRunning: false,
  checkedAt: 0,
};

async function isProcessRunning(imageName) {
  if (process.platform !== 'win32') return false;
  try {
    const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq ${imageName}" /NH`, { windowsHide: true });
    const target = imageName.toLowerCase();
    for (const line of stdout.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || /^info:/i.test(trimmed)) continue;
      const image = trimmed.split(/\s+/)[0]?.toLowerCase();
      if (image === target) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function getGameProcessState(force = false) {
  if (process.platform !== 'win32') {
    return { rocketLeagueRunning: false, valorantProcessRunning: false, riotClientRunning: false };
  }
  if (!force && Date.now() - cache.checkedAt < CACHE_MS) {
    return {
      rocketLeagueRunning: cache.rocketLeagueRunning,
      valorantProcessRunning: cache.valorantProcessRunning,
      riotClientRunning: cache.riotClientRunning,
    };
  }

  const [rl, val, riot] = await Promise.all([
    isProcessRunning(RL_IMAGE),
    isProcessRunning(VAL_IMAGE),
    isProcessRunning(RIOT_CLIENT_IMAGE),
  ]);

  cache = {
    rocketLeagueRunning: rl,
    valorantProcessRunning: val,
    riotClientRunning: riot,
    checkedAt: Date.now(),
  };

  return { rocketLeagueRunning: rl, valorantProcessRunning: val, riotClientRunning: riot };
}

export function startProcessWatcher(intervalMs = 4000, onChange) {
  if (process.platform !== 'win32') return () => {};
  let prev = { rocketLeagueRunning: false, valorantProcessRunning: false, riotClientRunning: false };
  const tick = async () => {
    const next = await getGameProcessState(true);
    const changed = next.rocketLeagueRunning !== prev.rocketLeagueRunning
      || next.valorantProcessRunning !== prev.valorantProcessRunning
      || next.riotClientRunning !== prev.riotClientRunning;
    if (changed) {
      prev = next;
      onChange?.(next);
    }
  };
  const id = setInterval(tick, intervalMs);
  tick();
  return () => clearInterval(id);
}
