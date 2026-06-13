/**
 * Generate multi-size Windows icon.ico from brand master PNG.
 *
 * Master source (first match wins):
 *   1. tracker/assets/brand/logo-master.png  (from logo-universal.svg via generate-brand-assets.mjs)
 *   2. assets/brand/logo-master.png
 *   3. tracker/integrations/overwolf/icon.png  (512px fallback)
 *
 * Regenerate master PNGs first:
 *   node scripts/generate-brand-assets.mjs
 *
 * Output: ../assets/icon.ico (+ sync ../assets/icon.png)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const launcherRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(launcherRoot, '..', '..');
const brandMaster = path.join(repoRoot, 'tracker', 'assets', 'brand', 'logo-master.png');
const brandFallback = path.join(repoRoot, 'assets', 'brand', 'logo-master.png');
const overwolfMaster = path.join(repoRoot, 'tracker', 'integrations', 'overwolf', 'icon.png');
const sourceBrand = fs.existsSync(brandMaster) ? brandMaster : brandFallback;
const sourcePng = fs.existsSync(sourceBrand) ? sourceBrand : overwolfMaster;
const assetsDir = path.join(launcherRoot, 'assets');
const destPng = path.join(assetsDir, 'icon.png');
const destIco = path.join(assetsDir, 'icon.ico');

if (!fs.existsSync(sourcePng)) {
  console.error(`Source icon missing: ${sourcePng}`);
  process.exit(1);
}

fs.mkdirSync(assetsDir, { recursive: true });
fs.copyFileSync(sourcePng, destPng);

const buf = await pngToIco(sourcePng);
fs.writeFileSync(destIco, buf);
console.log(`Wrote ${destIco} from ${sourcePng}`);
