#!/usr/bin/env node
/** Sync version.json cache token into index.html asset query strings */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const trackerRoot = path.join(root, 'tracker');
const version = JSON.parse(fs.readFileSync(path.join(trackerRoot, 'version.json'), 'utf8'));
const cache = version.cache;

if (!cache) {
  console.error('version.json missing "cache" field');
  process.exit(1);
}

const htmlPath = path.join(trackerRoot, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace(/\?v=[^"']+/g, `?v=${cache}`);
fs.writeFileSync(htmlPath, html);

const versionJsPath = path.join(trackerRoot, 'js/core/version.js');
if (fs.existsSync(versionJsPath)) {
  let versionJs = fs.readFileSync(versionJsPath, 'utf8');
  versionJs = versionJs.replace(
    /export const APP_VERSION = '[^']*';/,
    `export const APP_VERSION = '${version.app}';`,
  );
  versionJs = versionJs.replace(
    /export const CACHE_BUST = '[^']*';/,
    `export const CACHE_BUST = '${cache}';`,
  );
  fs.writeFileSync(versionJsPath, versionJs);
  console.log(`Updated js/core/version.js → app ${version.app}, cache ${cache}`);
}

console.log(`Cache bust synced → ?v=${cache} (app ${version.app})`);
