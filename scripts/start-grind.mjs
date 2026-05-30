#!/usr/bin/env node
/**
 * One-window launcher: RL stats bridge + tracker (same app everywhere).
 * Used by start-grind.bat — no second console window needed.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { startBridge } from './rl-bridge.mjs';

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

const playerName = process.argv[2]?.trim() || process.env.RL_PLAYER_NAME || '';

console.log('');
console.log('  RL Grind Tracker');
console.log(`  Player: ${playerName || '(set RLNAME in start-grind.bat)'}`);
console.log('');

await startBridge({ playerName });

const tracker = createTrackerServer();
await new Promise((resolve, reject) => {
  tracker.on('error', reject);
  tracker.listen(TRACKER_PORT, '127.0.0.1', resolve);
});

const url = `http://localhost:${TRACKER_PORT}`;

console.log('');
console.log('  ============================================');
console.log('  RL GRIND TRACKER — READ THIS');
console.log('  ============================================');
console.log('');
console.log('  Tracker:  ' + url);
console.log('  Player:   ' + (playerName || '(edit RLNAME in start-grind.bat)'));
console.log('');
console.log('  >>> KEEP THIS WINDOW OPEN while you play <<<');
console.log('  >>> Close it only when you\'re done grinding <<<');
console.log('');
console.log('  Same app as GitHub Pages — one platform, auto-stats when bridge connects.');
console.log('  After each game: W/L -> G/A/S -> End MMR -> LOG (or auto-log)');
console.log('');
console.log('  ============================================');
console.log('');

openBrowser(url);
