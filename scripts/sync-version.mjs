#!/usr/bin/env node
/** Sync version.json cache token into index.html asset query strings */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
const cache = version.cache;

if (!cache) {
  console.error('version.json missing "cache" field');
  process.exit(1);
}

const htmlPath = path.join(root, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace(/\?v=[^"']+/g, `?v=${cache}`);
fs.writeFileSync(htmlPath, html);

console.log(`Cache bust synced → ?v=${cache} (app ${version.app})`);
