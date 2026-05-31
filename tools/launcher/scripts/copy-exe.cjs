/** Copy built portable exe to tracker root for easy access. */

const fs = require('fs');
const path = require('path');

const built = path.join(__dirname, '..', 'dist', 'Twans Auto-Log.exe');
const dest = path.join(__dirname, '..', '..', 'Twans Auto-Log.exe');
const legacyDest = path.join(__dirname, '..', '..', 'Twans-Tracker-Bridge.exe');

if (!fs.existsSync(built)) {
  console.error('Build output not found:', built);
  process.exit(1);
}

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* sync wait */ }
}

function copyWithRetry(src, dest, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    try {
      fs.copyFileSync(src, dest);
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
  try {
    copyWithRetry(built, legacyDest);
    console.log('Also copied legacy name:', legacyDest);
  } catch {
    /* old exe locked or unwanted — primary name is enough */
  }
} catch (err) {
  const alt = path.join(path.dirname(dest), 'Twans Auto-Log-new.exe');
  try {
    copyWithRetry(built, alt);
    console.warn('Could not overwrite locked exe. Saved as:', alt);
    console.warn('Close Twans Auto-Log.exe, then rename the new file.');
  } catch {
    console.error('Copy failed:', err.message);
    console.error('Built exe is at:', built);
    process.exit(1);
  }
}
