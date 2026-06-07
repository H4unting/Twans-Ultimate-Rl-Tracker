# What players can ignore

The GitHub repo includes files for **developers and the project owner**. If you only play and track stats, you do not need to open, edit, or run anything in the lists below.

---

## Safe to ignore (developer / owner only)

| Path | What it is |
|------|------------|
| **`Kill-Port-8080.bat`** | Frees port 8080 with `taskkill` — often needs admin. Players close Live Server manually instead. |
| **`push-updates.bat`** | Publishes site updates to GitHub Pages |
| **`docs/supabase/`** | Database SQL for the owner’s Supabase project |
| **`docs/SETUP.md`** | Full developer + Supabase setup |
| **`docs/RELEASE-*.md`, `docs/SECURITY-*.md`, `docs/QA-*.md`, etc.** | Internal release and audit notes |
| **`.cursor/`** | Cursor IDE agent skills — not part of the app |
| **`scripts/`** (except running via `.bat`) | Node bridge code — launchers call these for you |
| **`integrations/overwolf/`** | Unpacked Overwolf dev extension — most players get Unauthorized App; use Henrik API |
| **`tools/launcher/`** | Optional tray app build scripts |
| **`config/qa.local.example.js`** | QA testing config |
| **`.env.example`** | Environment template for developers |
| **`node_modules/`** | Created if a developer runs package installs — not required for `.bat` launchers |
| **`app/`, `components/`, `next.config.mjs`** | Experimental / alternate UI — the live player app is `index.html` + `js/` |

---

## What players actually use

| Path | Purpose |
|------|---------|
| **GitHub Pages bookmark** | Stats, sign-in, manual logging — no download |
| **`Valorant Tracker (Player).bat`** | Valorant local auto-log (Henrik) — no admin |
| **`Rocket League Tracker.bat`** | Rocket League local auto-log (BakkesMod) |
| **`docs/USER-SETUP.md`** | Step-by-step player guide |
| **`legal/`** | Privacy, terms, disclaimer |

---

## Two launcher names (Valorant)

| File | For |
|------|-----|
| **`Valorant Tracker (Player).bat`** | Regular users — no admin, Henrik setup, manual port fix |
| **`Valorant Tracker.bat`** | Same app; mentions `Kill-Port-8080.bat` for devs who can kill processes |

Both start the same tracker on `http://localhost:8080`. Players should prefer **`Valorant Tracker (Player).bat`**.
