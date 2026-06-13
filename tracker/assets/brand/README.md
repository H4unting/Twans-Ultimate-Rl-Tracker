# Twans brand assets

## Universal logo (canonical)

**Vector source:** `logo-universal.svg` — cyan rounded square (`#00d4aa`) with centered black star.

Repo-wide source lives at `../../assets/brand/logo-universal.svg`. Regenerate PNGs from `tools/launcher`:

```bash
cd tools/launcher
npm install
node scripts/generate-brand-assets.mjs
node scripts/generate-icon.mjs
```

Outputs (this folder + `assets/brand/`):

| File | Size | Use |
|------|------|-----|
| `logo-master.png` | 1024×1024 | Favicon, Electron source, download page |
| `logo-512.png` | 512×512 | Overwolf icon sync |
| `logo-256.png` | 256×256 | Small exports |

`generate-icon.mjs` prefers `tracker/assets/brand/logo-master.png` when present.

Navbar uses inline SVG in `index.html` (star on teal tile via CSS). Do not use screenshot crops for icons.
