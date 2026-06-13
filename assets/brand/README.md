# Twans brand assets

## Universal logo (canonical)

**Vector source:** `logo-universal.svg` — cyan rounded square (`#00d4aa`) with centered black star.

**Raster exports:** run the brand generator from `tools/launcher`:

```bash
cd tools/launcher
npm install
node scripts/generate-brand-assets.mjs
node scripts/generate-icon.mjs
```

Outputs:

| File | Size | Use |
|------|------|-----|
| `logo-master.png` | 1024×1024 | Download page, favicon, Electron source |
| `logo-512.png` | 512×512 | Overwolf sync, medium exports |
| `logo-256.png` | 256×256 | Small UI references |
| `logo-universal.svg` | vector | Navbar / design source |

Desktop icons:

- `tools/launcher/assets/icon.ico` — Windows tray, window, installer
- `tools/launcher/assets/icon.png` — sync copy of master

Navbar uses inline SVG in `tracker/index.html` (star on teal tile via CSS). Do not use screenshot crops for icons.
