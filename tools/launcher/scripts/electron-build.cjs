/** Run electron-builder with output dir from prepare-build marker. */

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

const args = [
  'electron-builder',
  '--win',
  'portable',
  'nsis',
  `--config.directories.output=${outputDir}`,
];

console.log('electron-builder output:', outputDir);
const r = spawnSync('npx', args, { cwd: launcherRoot, stdio: 'inherit', shell: true });
process.exit(typeof r.status === 'number' ? r.status : 1);
