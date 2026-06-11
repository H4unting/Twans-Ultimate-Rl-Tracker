# Twans brand assets

## Master logo

**Canonical source:** `integrations/overwolf/icon.png` (512×512 teal square + star).

Optional override: copy or export to `assets/brand/logo-master.png` — `generate-icon.mjs` prefers this path when present.

Navbar uses inline SVG in `index.html` (vector, theme-aware). Do not use screenshot crops for icons.

## Generate desktop icons

From repo root (requires `png-to-ico` in `tools/launcher`):

```bash
cd tools/launcher
npm install
node scripts/generate-icon.mjs
```

Outputs:

- `tools/launcher/assets/icon.ico` — Windows tray + window
- `tools/launcher/assets/icon.png` — sync copy of master

## Favicon (web)

Regenerate 32×32 PNGs from the master with your image tool, or:

```bash
# Example with ImageMagick (if installed)
magick integrations/overwolf/icon.png -resize 32x32 public/icon-light-32x32.png
```

Web PWA mark in `public/icon.svg` is legacy — prefer star master for new exports.
