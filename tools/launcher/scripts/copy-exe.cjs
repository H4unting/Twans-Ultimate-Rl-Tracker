/** Copy built portable exe to tracker root for easy access. */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const launcherRoot = path.join(__dirname, '..');
const markerFile = path.join(launcherRoot, '.build-output-dir');
let outputDir = 'dist';
if (fs.existsSync(markerFile)) {
  const v = fs.readFileSync(markerFile, 'utf8').trim();
  if (v) outputDir = v;
}

const APP_EXE = 'Twans Ultimate Tracker.exe';
const built = path.join(launcherRoot, outputDir, APP_EXE);
const dest = path.join(launcherRoot, '..', '..', APP_EXE);
const legacyDest = path.join(launcherRoot, '..', '..', 'Twans Auto-Log.exe');
const legacyDest2 = path.join(launcherRoot, '..', '..', 'Twans-Tracker-Bridge.exe');

if (!fs.existsSync(built)) {
  console.error('Build output not found:', built);
  if (outputDir !== 'dist') {
    const fallback = path.join(launcherRoot, 'dist', APP_EXE);
    if (fs.existsSync(fallback)) {
      console.error('(Also checked default dist path:', fallback + ')');
    }
  }
  process.exit(1);
}

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}

function stopTrackerApp() {
  spawnSync('taskkill', ['/IM', APP_EXE, '/T'], { windowsHide: true, encoding: 'utf8' });
  sleep(600);
  spawnSync('taskkill', ['/IM', APP_EXE, '/T', '/F'], { windowsHide: true, encoding: 'utf8' });
  sleep(400);
}

function copyWithRetry(src, destPath, maxWaitMs = 12000) {
  stopTrackerApp();
  const delays = [300, 500, 800, 1200, 1500, 2000, 2500, 3000];
  let waited = 0;
  for (let i = 0; i < delays.length && waited < maxWaitMs; i++) {
    try {
      fs.copyFileSync(src, destPath);
      return true;
    } catch (err) {
      if (err.code !== 'EBUSY' && err.code !== 'EPERM') throw err;
      if (i === 3) stopTrackerApp();
      sleep(delays[i]);
      waited += delays[i];
    }
  }
  try {
    fs.copyFileSync(src, destPath);
    return true;
  } catch (err) {
    if (err.code === 'EBUSY' || err.code === 'EPERM') return false;
    throw err;
  }
}

function failCopyLocked() {
  const useAlt = process.env.TWANS_BUILD_ALT === '1';
  if (useAlt) {
    const alt = path.join(path.dirname(dest), 'Twans Ultimate Tracker-new.exe');
    try {
      fs.copyFileSync(built, alt);
      console.warn('TWANS_BUILD_ALT=1: saved locked overwrite as:', alt);
      console.warn('Close Twans Ultimate Tracker.exe, delete/rename manually if needed.');
      return;
    } catch (err) {
      console.error('Copy failed (alt path):', err.message);
      process.exit(1);
    }
  }
  console.error('');
  console.error('Could not update repo root exe — file is in use.');
  console.error('Close Twans Ultimate Tracker and run build again.');
  console.error('Built exe is at:', built);
  process.exit(1);
}

if (!copyWithRetry(built, dest)) {
  failCopyLocked();
}
console.log('Copied to', dest);

for (const legacy of [legacyDest, legacyDest2]) {
  try {
    if (copyWithRetry(built, legacy, 4000)) {
      console.log('Also copied legacy name:', legacy);
    }
  } catch {
    /* legacy name optional */
  }
}
