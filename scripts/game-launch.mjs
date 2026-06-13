/** Shared Windows game launch helpers — used by start-grind.mjs and bridge API */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { getGameProcessState } from './process-watcher.mjs';

const RL_PROCESS = 'RocketLeague';
const VAL_PROCESS = 'VALORANT-Win64-Shipping';

function focusProcessWindow(processName) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(false);
      return;
    }
    const ps1 = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class TwansWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
$p = Get-Process -Name '${processName}' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($p) {
  [TwansWin]::ShowWindow($p.MainWindowHandle, 9) | Out-Null
  [TwansWin]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
  exit 0
}
exit 1
`.trim();
    const tmp = path.join(tmpdir(), `twans-focus-${Date.now()}.ps1`);
    try {
      fs.writeFileSync(tmp, ps1, 'utf8');
      exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmp}"`, { windowsHide: true }, (err) => {
        try { fs.unlinkSync(tmp); } catch { /* ignore */ }
        resolve(!err);
      });
    } catch {
      resolve(false);
    }
  });
}

export function launchRocketLeague(log = console.log) {
  if (process.platform !== 'win32') {
    log('Launch Rocket League manually (auto-launch is Windows-only).');
    return Promise.resolve({ ok: false, error: 'Windows only' });
  }
  return getGameProcessState(true).then(async (state) => {
    if (state.rocketLeagueRunning) {
      const focused = await focusProcessWindow(RL_PROCESS);
      return { ok: true, alreadyRunning: true, focused, method: 'focus' };
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

  const state = await getGameProcessState(true);
  if (state.valorantProcessRunning) {
    const focused = await focusProcessWindow(VAL_PROCESS);
    return { ok: true, alreadyRunning: true, focused, method: 'focus' };
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
