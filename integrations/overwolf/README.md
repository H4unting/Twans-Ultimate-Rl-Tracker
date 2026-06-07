# Twans Val Auto-Log (Overwolf)

Simple Valorant auto-log — **no Henrik API key, no Riot ID setup**. Overwolf reads match data from the game client and sends it to your local tracker bridge.

## What you need running

1. **`Valorant Tracker.bat`** — local bridge + tracker at `http://localhost:8080`
2. **Tracker tab** at `http://localhost:8080` (not GitHub Pages / Live Server)
3. **Overwolf** with **Twans Val Auto-Log** loaded
4. **Auto-log ON** in the tracker dock

## One-time install

### Step 1 — Install Overwolf

Download and install from [overwolf.com](https://www.overwolf.com/). You do **not** need the Overwolf Store to load this app.

### Step 2 — Load the extension

1. Open Overwolf → **Settings** → **Support** → **Development options**
2. Turn on **Developer mode** if prompted
3. Click **Load unpacked extension**
4. Select the folder: **`integrations/overwolf`** inside your tracker download  
   (In the tracker app: **Auto-Log Setup → Copy path** when `Valorant Tracker.bat` is running)

The folder must contain `manifest.json`, `background.js`, and `icon.png`.

After updating extension files (e.g. `icon.png`), reload without re-picking the folder: **Settings → Support → Development options → Reload extension** (or remove and **Load unpacked extension** again on `integrations/overwolf`).

### Step 3 — Enable the app

In Overwolf, enable **Twans Val Auto-Log** (Library tab or apps tray). The icon is the **cyan squircle with star** (Twans Ultimate Tracker mark). If you update the tracker folder, reload via **Load unpacked extension** again.

### Step 4 — Start the tracker

1. Double-click **`Valorant Tracker.bat`** — keep the console window open
2. Open **`http://localhost:8080`** in your browser (use the tab the `.bat` opens)
3. Sign in if needed → **Auto-Log Setup** should show **● Overwolf linked** once the extension pings the bridge
4. Turn **Auto-log** on in the dock

### Step 5 — Play

Launch Valorant and play a **Competitive** match (custom/training games may not fire events). When the match ends, stats appear in the dock — confirm **End RR** and tap **LOG** (or auto-log saves if enabled).

Status pill should show **Overwolf linked** or **Auto-log ON**.

## Daily use

1. Run **`Valorant Tracker.bat`**
2. Open **`http://localhost:8080`**
3. Turn **Auto-log** on
4. Play Valorant

Overwolf starts with Windows if you left it enabled — the extension still needs the `.bat` window running for the bridge.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Extension won't load | Ensure **`icon.png`** exists in `integrations/overwolf`. Select that folder, not the repo root. |
| Tracker says **Auto-log off** | Run **`Valorant Tracker.bat`** first. Use **`http://localhost:8080`**, not port 5500 or GitHub Pages. |
| **Waiting for Overwolf extension** | Reload the unpacked extension in Overwolf. Keep `.bat` running. Restart Overwolf if needed. |
| Pill never shows **Overwolf linked** | Open Auto-Log Setup → **Copy path** → reload extension pointing at that folder. Hard refresh tracker (Ctrl+F5). |
| No match logged | Auto-log must be ON. Play a full Competitive/Unrated match — not custom. Check Overwolf sees Valorant running. |
| Overwolf Store errors | Ignore — unpacked extensions work without the Store. |

## Fallback

If Overwolf is not an option, use **Auto-Log Setup → Fallback — Henrik API** with Riot ID + free key from [api.henrikdev.xyz/dashboard](https://api.henrikdev.xyz/dashboard/).

## Publish to Overwolf store (optional)

Create a developer account at [Overwolf Developers](https://dev.overwolf.com/), add store assets, and submit this folder for review.
