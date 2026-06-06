#!/usr/bin/env node

/**

 * One-window launcher: RL stats bridge + local tracker for auto-log.

 * Always serves http://localhost:8080 on the gaming PC (Supabase syncs your data either way).

 */



import http from 'http';

import fs from 'fs';

import path from 'path';

import { exec } from 'child_process';

import { fileURLToPath } from 'url';

import { startBridge } from './rl-bridge.mjs';

import { loadGrindConfig } from './local-setup.mjs';



const TRACKER_PORT = 8080;
const BRIDGE_PORT = 49200;
const LOCAL_TRACKER_URL = `http://localhost:${TRACKER_PORT}`;



function resolveTrackerRoot() {

  if (process.env.TWANS_TRACKER_ROOT) {

    return path.resolve(process.env.TWANS_TRACKER_ROOT);

  }

  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

}



const ROOT = resolveTrackerRoot();



const MIME = {

  '.html': 'text/html; charset=utf-8',

  '.css': 'text/css; charset=utf-8',

  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',

  '.json': 'application/json; charset=utf-8',

  '.png': 'image/png',

  '.jpg': 'image/jpeg',

  '.jpeg': 'image/jpeg',

  '.svg': 'image/svg+xml',

  '.ico': 'image/x-icon',

  '.webp': 'image/webp',

  '.woff': 'font/woff',

  '.woff2': 'font/woff2',

  '.txt': 'text/plain; charset=utf-8',

};



function openBrowser(url) {

  const cmd = process.platform === 'win32'

    ? `start "" "${url}"`

    : process.platform === 'darwin'

      ? `open "${url}"`

      : `xdg-open "${url}"`;

  exec(cmd);

}



function isLocalTrackerUrl(url) {

  try {

    const host = new URL(url).hostname;

    return host === 'localhost' || host === '127.0.0.1';

  } catch {

    return true;

  }

}



function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function proxyToBridge(req, res, bridgePath) {
  try {
    const url = `http://127.0.0.1:${BRIDGE_PORT}${bridgePath}`;
    const init = { method: req.method };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = await readRequestBody(req);
      if (req.headers['content-type']) {
        init.headers = { 'Content-Type': req.headers['content-type'] };
      }
    }
    const upstream = await fetch(url, init);
    const body = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'bridge unavailable' }));
  }
}

function createTrackerServer() {

  return http.createServer((req, res) => {

    let urlPath = (req.url || '/').split('?')[0];
    const query = (req.url || '').includes('?') ? req.url.slice(req.url.indexOf('?')) : '';

    if (urlPath.startsWith('/api/bridge')) {
      const bridgePath = urlPath.slice('/api/bridge'.length) || '/status';
      proxyToBridge(req, res, `${bridgePath}${query}`);
      return;
    }

    if (urlPath === '/') urlPath = '/index.html';



    const filePath = path.normalize(path.join(ROOT, decodeURIComponent(urlPath)));

    if (!filePath.startsWith(ROOT)) {

      res.writeHead(403);

      res.end('Forbidden');

      return;

    }



    fs.readFile(filePath, (err, data) => {

      if (err) {

        res.writeHead(err.code === 'ENOENT' ? 404 : 500);

        res.end(err.code === 'ENOENT' ? 'Not found' : 'Server error');

        return;

      }

      const ext = path.extname(filePath).toLowerCase();
      const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
      if (['.html', '.js', '.css', '.mjs'].includes(ext)) {
        headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
        headers.Pragma = 'no-cache';
      }

      res.writeHead(200, headers);

      res.end(data);

    });

  });

}



const config = loadGrindConfig();

const playerArg = process.argv[2]?.trim();
const playerName = (playerArg && !playerArg.startsWith('--'))
  ? playerArg
  : (config.rlDisplayName || process.env.RL_PLAYER_NAME || '');

const configuredTrackerUrl = (process.env.TRACKER_URL || config.trackerUrl || LOCAL_TRACKER_URL).trim();

const skipBrowser = process.env.BRIDGE_NO_BROWSER === '1' || process.argv.includes('--no-browser');

const valOnly = process.env.VAL_ONLY === '1' || process.argv.includes('--val-only');

const launchRl = process.argv.includes('--launch-rl');

const launchVal = process.argv.includes('--launch-val');

const autoPoll = process.argv.includes('--auto-poll');

const quiet = process.env.BRIDGE_QUIET === '1';



function log(...args) {

  if (!quiet) console.log(...args);

}

function printLauncherBanner() {
  if (quiet || (!launchRl && !launchVal)) return;
  log('');
  log('  Connecting services...');
}

function launchRocketLeague() {
  if (process.platform !== 'win32') {
    log('  Launch Rocket League manually (auto-launch is Windows-only).');
    return;
  }
  log('');
  log('  Launching Rocket League...');
  exec('start "" "steam://rungameid/252950"', (err) => {
    if (err) {
      console.warn('  Could not open Steam. Start Rocket League manually (Steam app ID 252950).');
      console.warn('  Epic players: open Rocket League from the Epic Games launcher.');
    }
  });
}

function launchValorant() {
  if (process.platform !== 'win32') {
    log('  Launch Valorant manually (auto-launch is Windows-only).');
    return;
  }
  log('');
  log('  Launching Valorant...');
  const riotUri = 'riotclient://launch-product=valorant&patchline=live';
  exec(`start "" "${riotUri}"`, (err) => {
    if (err) tryLaunchValorantViaRiotClientExe();
  });
}

function tryLaunchValorantViaRiotClientExe() {
  const candidates = [
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Riot Games', 'Riot Client', 'RiotClientServices.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Riot Games', 'Riot Client', 'RiotClientServices.exe'),
  ];
  for (const exe of candidates) {
    if (fs.existsSync(exe)) {
      exec(`"${exe}" --launch-product=valorant --launch-patchline=live`, (err) => {
        if (err) {
          console.warn('  Could not start Valorant via Riot Client. Open Valorant manually.');
        }
      });
      return;
    }
  }
  console.warn('  Riot Client not found. Open Valorant manually, or install the Riot Client.');
  console.warn('  URI fallback: riotclient://launch-product=valorant&patchline=live');
}

function launchGameIfRequested() {
  if (launchRl && !valOnly) launchRocketLeague();
  else if (launchVal && valOnly) launchValorant();
}

function printReadyMessage() {
  if (quiet || (!launchRl && !launchVal)) return;
  log('');
  log('  Ready. Good luck!');
  log('');
  log('  Keep this window open while you play.');
  log('  Tracker: ' + LOCAL_TRACKER_URL);
  log('');
}



log('');

if (launchRl && !valOnly) {
  /* Banner printed by .bat */
} else if (launchVal && valOnly) {
  /* Banner printed by .bat */
} else {
  log('  Twans Ultimate Tracker');
  log(`  Player: ${playerName || '(set via tracker setup — Apply & Go)'}`);
  if (valOnly) {
    log('  Mode: Valorant only (no Rocket League TCP bridge)');
  }
  log(`  Local tracker: ${LOCAL_TRACKER_URL}`);
  if (!isLocalTrackerUrl(configuredTrackerUrl)) {
    log(`  Remote bookmark: ${configuredTrackerUrl} (phone / other devices — not for auto-log)`);
  }
  log('');
}

printLauncherBanner();

await startBridge({ playerName, skipRl: valOnly, manualValPoll: !autoPoll });



const tracker = createTrackerServer();

await new Promise((resolve, reject) => {

  tracker.on('error', reject);

  tracker.listen(TRACKER_PORT, '127.0.0.1', resolve);

});



launchGameIfRequested();
printReadyMessage();

if (!quiet && !launchRl && !launchVal) {

  console.log('');

  console.log('  ============================================');

  console.log('  TWANS ULTIMATE TRACKER — READ THIS');

  console.log('  ============================================');

  console.log('');

  console.log('  Open on THIS PC:  ' + LOCAL_TRACKER_URL);

  console.log('  Auto-log API:     http://127.0.0.1:49200');

  console.log('  Player:           ' + (playerName || '(use Apply & Go in tracker setup)'));

  console.log('');

  console.log('  >>> KEEP THIS RUNNING while you play <<<');

  console.log('  >>> Use localhost:8080 on your gaming PC (not GitHub Pages) <<<');

  if (valOnly) {
    console.log('  >>> Valorant: open http://localhost:8080 once to arm auto-log <<<');
    console.log('  >>> Do not Ctrl+C mid-match <<<');
  } else {
    console.log('  >>> Playing Val only? Double-click Valorant Tracker.bat <<<');
  }

  console.log('');

}



if (valOnly && skipBrowser) {
  setTimeout(() => {
    if (!quiet) {
      console.log('');
      console.log('  >>> Opening tracker in your browser — keep that tab open for auto-log <<<');
      console.log('');
    }
    openBrowser(LOCAL_TRACKER_URL);
  }, 15000);
} else if (!skipBrowser) {
  openBrowser(LOCAL_TRACKER_URL);
}

