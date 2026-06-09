/** Copy built portable exe to tracker root for easy access. */

const fs = require('fs');
const path = require('path');

const built = path.join(__dirname, '..', 'dist', 'Twans Ultimate Tracker.exe');
const dest = path.join(__dirname, '..', '..', '..', 'Twans Ultimate Tracker.exe');
const legacyDest = path.join(__dirname, '..', '..', '..', 'Twans Auto-Log.exe');
const legacyDest2 = path.join(__dirname, '..', '..', '..', 'Twans-Tracker-Bridge.exe');

if (!fs.existsSync(built)) {
  console.error('Build output not found:', built);
  process.exit(1);
}

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* sync wait */ }
}

function copyWithRetry(src, destPath, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    try {
      fs.copyFileSync(src, destPath);
      return true;
    } catch (err) {
      if (err.code !== 'EBUSY' || i === attempts - 1) throw err;
      sleep(500);
    }
  }
  return false;
}

try {
  copyWithRetry(built, dest);
  console.log('Copied to', dest);
  for (const legacy of [legacyDest, legacyDest2]) {
    try {
      copyWithRetry(built, legacy);
      console.log('Also copied legacy name:', legacy);
    } catch {
      /* old exe locked or unwanted — primary name is enough */
    }
  }
} catch (err) {
  const alt = path.join(path.dirname(dest), 'Twans Ultimate Tracker-new.exe');
  try {
    copyWithRetry(built, alt);
    console.warn('Could not overwrite locked exe. Saved as:', alt);
    console.warn('Close Twans Ultimate Tracker.exe, then rename the new file.');
  } catch {
    console.error('Copy failed:', err.message);
    console.error('Built exe is at:', built);
    process.exit(1);
  }
}
