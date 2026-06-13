/** Stop running app instances and pick a writable electron-builder output dir. */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const launcherRoot = path.join(__dirname, '..');
const distDir = path.join(launcherRoot, 'dist');
const markerFile = path.join(launcherRoot, '.build-output-dir');

const APP_EXE = 'Twans Ultimate Tracker.exe';

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}

function stopTrackerApp() {
  for (const args of [['/IM', APP_EXE, '/T'], ['/IM', APP_EXE, '/T', '/F']]) {
    const r = spawnSync('taskkill', args, { windowsHide: true, encoding: 'utf8' });
    const out = (r.stdout || '') + (r.stderr || '');
    if (r.status === 0) {
      console.log('Stopped running', APP_EXE);
      return;
    }
    if (/not found|no tasks/i.test(out)) return;
  }
}

function tryRemoveDist() {
  if (!fs.existsSync(distDir)) return true;
  try {
    fs.rmSync(distDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 });
    return !fs.existsSync(distDir);
  } catch (err) {
    console.warn('Could not remove dist:', err.message);
    return false;
  }
}

function isDistLocked() {
  const probe = path.join(distDir, 'win-unpacked', 'resources', 'app.asar');
  if (!fs.existsSync(probe)) return false;
  try {
    fs.unlinkSync(probe);
    return false;
  } catch (err) {
    return err.code === 'EBUSY' || err.code === 'EPERM';
  }
}

function main() {
  console.log('Preparing build (close', APP_EXE, 'if build fails on locked files)...');
  stopTrackerApp();
  sleep(1200);
  if (tryRemoveDist()) {
    fs.writeFileSync(markerFile, 'dist', 'utf8');
    console.log('Using output directory: dist');
    return;
  }
  stopTrackerApp();
  sleep(800);
  if (tryRemoveDist()) {
    fs.writeFileSync(markerFile, 'dist', 'utf8');
    console.log('Using output directory: dist');
    return;
  }
  if (isDistLocked() || fs.existsSync(distDir)) {
    const alt = 'dist-build-' + Date.now();
    fs.writeFileSync(markerFile, alt, 'utf8');
    console.warn(APP_EXE + ' or another process may still be using tools/launcher/dist.');
    console.warn('Using alternate output: ' + alt);
    console.warn('Close Twans Ultimate Tracker, then delete old dist when convenient.');
    return;
  }
  fs.writeFileSync(markerFile, 'dist', 'utf8');
}

main();
