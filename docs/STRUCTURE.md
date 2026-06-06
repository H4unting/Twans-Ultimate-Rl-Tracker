# Folder structure

```
├── Rocket League Tracker.bat  ← RL auto-log + launches Rocket League
├── Valorant Tracker.bat       ← Val only (safer for Vanguard)
├── start-grind.bat            ← legacy wrapper → Rocket League Tracker.bat
├── start-val-grind.bat        ← legacy wrapper → Valorant Tracker.bat
├── index.html                 ← tracker UI (served at localhost:8080)
├── css/  js/  scripts/        ← web app + local bridge
├── config/                    ← grind-config.json, bridge-launcher.json
├── docs/                      ← setup, SQL, release notes
├── integrations/overwolf/     ← optional Valorant Overwolf app
└── tools/launcher/            ← build Twans Auto-Log.exe (tray app)
```

## Daily workflow

1. **`Valorant Tracker.bat`** (Valorant) or **`Rocket League Tracker.bat`** (Rocket League)
2. Tracker opens at http://localhost:8080 — sign in once
3. Play — auto-log saves matches when they finish
4. Keep the launcher window open while you play
