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



function createTrackerServer() {

  return http.createServer((req, res) => {

    let urlPath = (req.url || '/').split('?')[0];

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

      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });

      res.end(data);

    });

  });

}



const config = loadGrindConfig();

const playerName = process.argv[2]?.trim() || config.rlDisplayName || process.env.RL_PLAYER_NAME || '';

const configuredTrackerUrl = (process.env.TRACKER_URL || config.trackerUrl || LOCAL_TRACKER_URL).trim();

const skipBrowser = process.env.BRIDGE_NO_BROWSER === '1' || process.argv.includes('--no-browser');

const quiet = process.env.BRIDGE_QUIET === '1';



function log(...args) {

  if (!quiet) console.log(...args);

}



log('');

log('  Twans Ultimate Tracker');

log(`  Player: ${playerName || '(set via tracker setup — Apply & Go)'}`);

log(`  Local tracker: ${LOCAL_TRACKER_URL}`);

if (!isLocalTrackerUrl(configuredTrackerUrl)) {

  log(`  Remote bookmark: ${configuredTrackerUrl} (phone / other devices — not for auto-log)`);

}

log('');



await startBridge({ playerName });



const tracker = createTrackerServer();

await new Promise((resolve, reject) => {

  tracker.on('error', reject);

  tracker.listen(TRACKER_PORT, '127.0.0.1', resolve);

});



if (!quiet) {

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

  console.log('');

}



if (!skipBrowser) {

  openBrowser(LOCAL_TRACKER_URL);

}

