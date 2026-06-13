/**
 * Export high-resolution PNGs from assets/brand/logo-universal.svg.
 *
 * Outputs (per brand dir):
 *   logo-master.png  (1024)
 *   logo-512.png
 *   logo-256.png
 *
 * Also refreshes tracker/integrations/overwolf/icon.png (512).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const svgSource = path.join(repoRoot, 'assets', 'brand', 'logo-universal.svg');

const brandDirs = [
  path.join(repoRoot, 'assets', 'brand'),
  path.join(repoRoot, 'tracker', 'assets', 'brand'),
];

const exports = [
  { size: 1024, name: 'logo-master.png' },
  { size: 512, name: 'logo-512.png' },
  { size: 256, name: 'logo-256.png' },
];

if (!fs.existsSync(svgSource)) {
  console.error(`SVG source missing: ${svgSource}`);
  process.exit(1);
}

const svgBuffer = fs.readFileSync(svgSource);

for (const dir of brandDirs) {
  fs.mkdirSync(dir, { recursive: true });
  const svgDest = path.join(dir, 'logo-universal.svg');
  if (path.resolve(dir) !== path.dirname(svgSource)) {
    fs.copyFileSync(svgSource, svgDest);
  }
  for (const { size, name } of exports) {
    const dest = path.join(dir, name);
    await sharp(svgBuffer, { density: 300 }).resize(size, size).png().toFile(dest);
    console.log(`Wrote ${dest} (${size}x${size})`);
  }
}

const overwolfIcon = path.join(repoRoot, 'tracker', 'integrations', 'overwolf', 'icon.png');
fs.mkdirSync(path.dirname(overwolfIcon), { recursive: true });
await sharp(svgBuffer, { density: 300 }).resize(512, 512).png().toFile(overwolfIcon);
console.log(`Wrote ${overwolfIcon} (512x512)`);
