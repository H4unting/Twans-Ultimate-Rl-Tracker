/** Stop running app instances and pick a writable electron-builder output dir. */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const launcherRoot = path.join(__dirname, '..');
const distDir = path.join(launcherRoot, 'dist');
const markerFile = path.join(launcherRoot, '.build-output-dir');
const repoRootExe = path.join(launcherRoot, '..', '..', 'Twans Ultimate Tracker.exe');

const APP_EXE = 'Twans Ultimate Tracker.exe';

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}

function taskkillOutput(r) {
  return (r.stdout || '') + (r.stderr || '');
}

function stopTrackerApp() {
  const graceful = spawnSync('taskkill', ['/IM', APP_EXE, '/T'], {
    windowsHide: true,
    encoding: 'utf8',
  });
  const gOut = taskkillOutput(graceful);
  if (graceful.status === 0) {
    console.log('Stopped running', APP_EXE, '(graceful)');
    sleep(800);
    return;
  }
  if (/not found|no tasks/i.test(gOut)) return;

  const forced = spawnSync('taskkill', ['/IM', APP_EXE, '/T', '/F'], {
    windowsHide: true,
    encoding: 'utf8',
  });
  const fOut = taskkillOutput(forced);
  if (forced.status === 0) {
    console.log('Stopped running', APP_EXE, '(forced)');
    sleep(400);
    return;
  }
  if (!/not found|no tasks/i.test(fOut)) {
    console.warn('Could not stop all', APP_EXE, 'processes:', fOut.trim());
  }
}

/** Wait until file can be opened for write or maxMs elapses. */
function waitForFileUnlocked(filePath, maxMs = 10000) {
  if (!filePath || !fs.existsSync(filePath)) return true;
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const fd = fs.openSync(filePath, 'r+');
      fs.closeSync(fd);
      return true;
    } catch (err) {
      if (err.code !== 'EBUSY' && err.code !== 'EPERM') return true;
      sleep(400);
    }
  }
  return false;
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
  console.log('Preparing build: stopping', APP_EXE, 'if running...');
  stopTrackerApp();
  const rootReady = waitForFileUnlocked(repoRootExe, 10000);
  if (!rootReady) {
    console.warn(
      'Repo root exe still locked after 10s:',
      repoRootExe,
      '— close Twans Ultimate Tracker and retry if copy fails.'
    );
  }
  if (tryRemoveDist()) {
    fs.writeFileSync(markerFile, 'dist', 'utf8');
    console.log('Using output directory: dist');
    return;
  }
  stopTrackerApp();
  waitForFileUnlocked(repoRootExe, 3000);
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
