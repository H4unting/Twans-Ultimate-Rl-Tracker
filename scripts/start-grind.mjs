#!/usr/bin/env node

/**

 * One-window launcher: RL stats bridge + local tracker for auto-log.

 * Always serves http://localhost:8080 on the gaming PC (Supabase syncs your data either way).

 */



import http from 'http';
import net from 'net';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { startBridge } from './rl-bridge.mjs';
import { loadGrindConfig } from './local-setup.mjs';
import { launchRocketLeague, launchValorant } from './game-launch.mjs';
import {
  checkRateLimit,
  getBridgeAuthToken,
  initBridgeAuth,
  isProxyBridgePath,
  sendRateLimited,
} from './bridge-security.mjs';



const TRACKER_PORT = 8080;
const BRIDGE_PORT = 49200;
const LOCAL_TRACKER_URL = `http://localhost:${TRACKER_PORT}`;
const BRIDGE_AUTH_TOKEN = process.env.BRIDGE_AUTH_TOKEN || crypto.randomBytes(32).toString('hex');
initBridgeAuth({ token: BRIDGE_AUTH_TOKEN });



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

function isPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err) => resolve(err?.code === 'EADDRINUSE'))
      .once('listening', () => tester.close(() => resolve(false)))
      .listen(port, host);
  });
}

async function probePort8080Occupant() {
  try {
    const probe = await fetch(`http://127.0.0.1:${TRACKER_PORT}/api/bridge/status`, {
      signal: AbortSignal.timeout(1500),
    });
    if (probe.ok) return 'tracker_already_running';
    if (probe.status === 404) return 'wrong_server';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function printPort8080AlreadyRunningHelp() {
  console.log('');
  console.log(`  Port ${TRACKER_PORT} is already serving Twans Ultimate Tracker.`);
  console.log('');
  console.log('  You do NOT need to start again:');
  console.log(`    • Use your existing tab at ${LOCAL_TRACKER_URL}`);
  console.log('    • Or close the OTHER Rocket League / Valorant Tracker console window, then run this .bat again');
  console.log('');
  console.log('  Opening the tracker in your browser...');
  console.log('');
}

function printPort8080BlockedError(occupant = 'unknown') {
  console.error('');
  console.error(`  ERROR: Port ${TRACKER_PORT} is already in use.`);
  if (occupant === 'wrong_server') {
    console.error('  Something else is on port 8080 (often VS Code Live Server, Live Preview, or npx serve).');
    console.error('  That app does NOT include the auto-log bridge — close it, then run this launcher again.');
  } else {
    console.error('  Another program is blocking port 8080 (often Live Server, Live Preview, or npx serve).');
    console.error('  If a tracker console is already open, use http://localhost:8080 there instead of starting twice.');
  }
  console.error('');
  console.error('  Fix (no admin needed):');
  console.error('    1. Close VS Code Live Server / Live Preview (status bar Port: 8080 → stop)');
  console.error('    2. Close other Valorant / Rocket League Tracker console windows');
  if (process.platform === 'win32') {
    console.error(`    3. See what owns the port:  netstat -ano | findstr :${TRACKER_PORT}`);
    console.error('       End the app in Task Manager (Details → PID). Player guide: docs\\USER-SETUP.md');
    console.error('       Avoid Kill-Port-8080.bat unless you know you can kill that process.');
  } else {
    console.error(`    3. Find and stop the process using port ${TRACKER_PORT} (lsof / fuser)`);
  }
  console.error('');
  console.error(`  Auto-log requires THIS launcher on ${LOCAL_TRACKER_URL}`);
  console.error('');
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

const CORS_ALLOW_HEADERS = 'Content-Type, X-Bridge-Token';

function bridgeCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
  };
}

async function proxyToBridge(req, res, bridgePath) {
  if (!isProxyBridgePath(bridgePath)) {
    res.writeHead(403, { 'Content-Type': 'application/json', ...bridgeCorsHeaders() });
    res.end(JSON.stringify({ ok: false, error: 'Forbidden bridge path' }));
    return;
  }

  const rate = checkRateLimit(req, bridgePath);
  if (!rate.allowed) {
    sendRateLimited(res, rate.retryAfterSec);
    return;
  }

  try {
    const url = `http://127.0.0.1:${BRIDGE_PORT}${bridgePath}`;
    const init = { method: req.method };
    const headers = {};
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = await readRequestBody(req);
      if (req.headers['content-type']) {
        headers['Content-Type'] = req.headers['content-type'];
      }
      headers['X-Bridge-Token'] = BRIDGE_AUTH_TOKEN;
    }
    init.headers = headers;
    const upstream = await fetch(url, init);
    let body = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get('content-type') || 'application/json';
    if (bridgePath.split('?')[0] === '/status' && upstream.ok && contentType.includes('json')) {
      try {
        const json = JSON.parse(body.toString('utf8'));
        json.authToken = BRIDGE_AUTH_TOKEN;
        body = Buffer.from(JSON.stringify(json));
      } catch { /* pass through */ }
    }
    res.writeHead(upstream.status, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      ...bridgeCorsHeaders(),
    });
    res.end(body);
  } catch {
    res.writeHead(502, { 'Content-Type': 'application/json', ...bridgeCorsHeaders() });
    res.end(JSON.stringify({ error: 'bridge unavailable' }));
  }
}

function createTrackerServer() {

  return http.createServer((req, res) => {

    let urlPath = (req.url || '/').split('?')[0];
    const query = (req.url || '').includes('?') ? req.url.slice(req.url.indexOf('?')) : '';

    if (urlPath.startsWith('/api/bridge')) {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, bridgeCorsHeaders());
        res.end();
        return;
      }
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

const valLauncherMode = valOnly && launchVal;

const quiet = process.env.BRIDGE_QUIET === '1';



function log(...args) {

  if (!quiet) console.log(...args);

}

function valLauncherLog(...args) {
  if (!quiet && valLauncherMode) log('[valorant-launcher]', ...args);
}

function printLauncherBanner() {
  if (quiet || (!launchRl && !launchVal)) return;
  log('');
  log('  Connecting services...');
}

async function launchGameIfRequested() {
  if (launchRl && !valOnly) {
    log('');
    log('  Launching Rocket League...');
    const result = await launchRocketLeague(log);
    if (!result.ok) console.warn(`  ${result.error}`);
  } else if (launchVal && valOnly) {
    log('');
    log('  Launching Valorant...');
    valLauncherLog('Executing Valorant launch command...');
    const result = await launchValorant(valLauncherLog);
    if (!result.ok) console.warn(`  [valorant-launcher] ${result.error}`);
    else valLauncherLog('Launch method:', result.method);
  }
}

function printReadyMessage() {
  if (quiet || (!launchRl && !launchVal)) return;
  log('');
  log('  Ready. Good luck!');
  log('');
  log('  Keep this window open while you play.');
  log('  Open in your browser: ' + LOCAL_TRACKER_URL);
  if (valOnly) {
    log('  First time? Auto-Log Setup -> Riot ID + Henrik key -> Apply & Go');
  }
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

if (valLauncherMode) valLauncherLog('Launcher started');

if (await isPortInUse(TRACKER_PORT)) {
  const occupant = await probePort8080Occupant();
  if (occupant === 'tracker_already_running') {
    printPort8080AlreadyRunningHelp();
    openBrowser(LOCAL_TRACKER_URL);
    process.exit(0);
  }
  printPort8080BlockedError(occupant);
  process.exit(1);
}

let bridgeServer = null;
try {
  bridgeServer = await startBridge({
    playerName,
    skipRl: valOnly,
    manualValPoll: !autoPoll && !valLauncherMode,
    deferPollMs: valLauncherMode ? 0 : undefined,
    valLauncherMode,
    authToken: BRIDGE_AUTH_TOKEN,
  });
} catch (err) {
  console.error(err?.message || err);
  process.exit(1);
}

if (valLauncherMode) valLauncherLog(`Bridge started (port ${BRIDGE_PORT})`);

const tracker = createTrackerServer();

try {
  await new Promise((resolve, reject) => {
    tracker.on('error', async (err) => {
      if (err?.code === 'EADDRINUSE') {
        const occupant = await probePort8080Occupant();
        printPort8080BlockedError(occupant);
      }
      reject(err);
    });
    tracker.listen(TRACKER_PORT, '127.0.0.1', resolve);
  });
} catch {
  bridgeServer?.close?.();
  process.exit(1);
}

if (valLauncherMode) valLauncherLog(`Tracker ready (port ${TRACKER_PORT})`);

if (!quiet) {
  console.log('');
  console.log(`  >>> Opening ${LOCAL_TRACKER_URL} — use this tab for auto-log <<<`);
  console.log('  >>> Keep that tab + this console open while you play <<<');
  console.log('');
}
if (!skipBrowser) openBrowser(LOCAL_TRACKER_URL);

await launchGameIfRequested();
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
    console.log('  >>> Valorant: open http://localhost:8080 — Auto-Log Setup -> Henrik key <<<');
    console.log('  >>> Do not Ctrl+C mid-match <<<');
  } else {
    console.log('  >>> Playing Val only? Double-click Valorant Tracker.bat <<<');
  }

  console.log('');

}




