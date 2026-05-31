# Folder layout

```
Twans Ultimate Tracker/
├── start-grind.bat          ← RL + Val auto-log (double-click this)
├── start-val-grind.bat      ← Val only (safer for Vanguard)
├── push-updates.bat         ← Copy site to GitHub repo (dev)
├── build-tray-app.bat       ← Build Twans Auto-Log.exe (optional)
├── index.html               ← Web app entry
├── css/  js/  scripts/      ← Tracker + bridge code
├── config/                  ← Your keys & auto-log state (gitignored)
├── docs/                    ← Setup guides + Supabase SQL
├── integrations/overwolf/   ← Optional Overwolf extension
└── tools/launcher/          ← Electron tray app source
```

## Daily use

1. **`start-val-grind.bat`** (Valorant) or **`start-grind.bat`** (RL + Val)
2. Open **http://localhost:8080**
3. Play — matches log after they finish

See **docs/SETUP.md** for full setup.
