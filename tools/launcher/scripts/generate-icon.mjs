/**
 * Generate multi-size Windows icon.ico from source PNG.
 * Source: ../../integrations/overwolf/icon.png (canonical brand asset)
 * Output: ../assets/icon.ico (+ sync ../assets/icon.png)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const launcherRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(launcherRoot, '..', '..');
const sourcePng = path.join(repoRoot, 'integrations', 'overwolf', 'icon.png');
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
