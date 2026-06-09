/** Shared Windows game launch helpers — used by start-grind.mjs and bridge API */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

export function launchRocketLeague(log = console.log) {
  if (process.platform !== 'win32') {
    log('Launch Rocket League manually (auto-launch is Windows-only).');
    return { ok: false, error: 'Windows only' };
  }
  return new Promise((resolve) => {
    exec('start "" "steam://rungameid/252950"', (err) => {
      if (err) {
        resolve({
          ok: false,
          error: 'Could not open Steam — start Rocket League manually (Steam app ID 252950). Epic: use Epic Games launcher.',
        });
        return;
      }
      resolve({ ok: true, method: 'steam' });
    });
  });
}

function launchValorantViaUri(log) {
  const riotUri = 'riotclient://launch-product=valorant&patchline=live';
  return new Promise((resolve) => {
    exec(`start "" "${riotUri}"`, (err) => {
      if (err) {
        resolve({ ok: false, error: 'Could not start Valorant — open it manually from Riot Client.' });
        return;
      }
      resolve({ ok: true, method: 'riot-uri' });
    });
  });
}

export async function launchValorant(log = console.log) {
  if (process.platform !== 'win32') {
    log('Launch Valorant manually (auto-launch is Windows-only).');
    return { ok: false, error: 'Windows only' };
  }

  const candidates = [
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Riot Games', 'Riot Client', 'RiotClientServices.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Riot Games', 'Riot Client', 'RiotClientServices.exe'),
  ];

  for (const exe of candidates) {
    if (fs.existsSync(exe)) {
      return new Promise((resolve) => {
        exec(`"${exe}" --launch-product=valorant --launch-patchline=live`, async (err) => {
          if (err) {
            resolve(await launchValorantViaUri(log));
            return;
          }
          resolve({ ok: true, method: 'riot-client', path: exe });
        });
      });
    }
  }

  return launchValorantViaUri(log);
}
