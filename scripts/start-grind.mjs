#!/usr/bin/env node
/**
 * One-window launcher: RL stats bridge + opens your tracker URL.
 * Bridge-only when TRACKER_URL points off localhost (e.g. GitHub Pages).
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { startBridge } from './rl-bridge.mjs';
import { loadGrindConfig } from './local-setup.mjs';

const TRACKER_PORT = 8080;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

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
const trackerUrl = (process.env.TRACKER_URL || `http://localhost:${TRACKER_PORT}`).trim();
const useLocalServer = isLocalTrackerUrl(trackerUrl);

console.log('');
console.log('  Twans Ultimate Tracker');
console.log(`  Player: ${playerName || '(set RLNAME in start-grind.bat)'}`);
console.log(`  Tracker URL: ${trackerUrl}`);
console.log('');

await startBridge({ playerName });

if (useLocalServer) {
  const tracker = createTrackerServer();
  await new Promise((resolve, reject) => {
    tracker.on('error', reject);
    tracker.listen(TRACKER_PORT, '127.0.0.1', resolve);
  });
} else {
  console.log('  Bridge only — tracker opens from your bookmark (no local site server).');
}

console.log('');
console.log('  ============================================');
console.log('  TWANS ULTIMATE TRACKER — READ THIS');
console.log('  ============================================');
console.log('');
console.log('  Tracker:  ' + trackerUrl);
console.log('  Bridge:   http://127.0.0.1:49200 (auto-log from RL)');
console.log('  Player:   ' + (playerName || '(edit RLNAME in start-grind.bat)'));
console.log('');
console.log('  >>> KEEP THIS WINDOW OPEN while you play <<<');
console.log('  >>> Close it only when you\'re done grinding <<<');
console.log('');
console.log('  Auto-log works when this window is open and you use the tracker in your browser.');
console.log('');
console.log('  ============================================');
console.log('');

openBrowser(trackerUrl);
