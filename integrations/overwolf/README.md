# Twans Val Auto-Log (Overwolf)

Simple Valorant auto-log — **no Henrik API key, no Riot ID setup**. Overwolf reads match data from the game client and sends it to your local tracker bridge.

## What you need running

1. **`Valorant Tracker.bat`** — local bridge + tracker at `http://localhost:8080`
2. **Tracker tab** at `http://localhost:8080` (not GitHub Pages / Live Server)
3. **Overwolf** with **Twans Val Auto-Log** loaded
4. **Auto-log ON** in the tracker dock

## One-time install

### Step 1 — Install Overwolf

Download and install from [overwolf.com](https://www.overwolf.com/).

### Step 2 — Sign in to Overwolf

**Required before loading unpacked extensions.** If you skip this, Overwolf shows *"Unauthorized App"*.

1. Click the **Appstore** icon in the Overwolf dock (or open the Overwolf client and sign in)
2. Sign in with your Overwolf account (create one free if needed)

### Step 3 — Load the extension (developer / unpacked)

This app is **not** on the Overwolf Appstore yet. You load it as an **unpacked extension** — the same method Overwolf documents for app development ([basic sample app](https://dev.overwolf.com/ow-native/getting-started/onboarding-resources/basic-sample-app/)).

1. Open Overwolf **Development options** using either path:
   - **Wrench icon** in the dock → **About** tab → **Development options**, or
   - Right-click the **Overwolf tray icon** → **Settings** → **About** → **Development options**, or
   - **Settings** → **Support** → **Development options** (some client versions)
2. Click **Load unpacked extension** (not a Store install — do not double-click an OPK or expect an Appstore download)
3. Select the folder: **`integrations/overwolf`** inside your tracker download  
   (In the tracker app: **Auto-Log Setup → Copy path** when `Valorant Tracker.bat` is running)

**⚠ Wrong folder?** Overwolf shows *"Couldn't load extension — missing manifest.json"* if you pick **Desktop**, **Downloads**, or the **tracker repo root**. Select only **`integrations/overwolf`** — double-click **`OPEN-THIS-FOLDER.bat`** in that folder to open Explorer and see the instructions.

The folder must contain `manifest.json`, `background.js`, and `icon.png`.

After updating extension files (e.g. `icon.png`), reload without re-picking the folder: **Development options → Reload extension** (or remove and **Load unpacked extension** again on `integrations/overwolf`).

#### Developer whitelist (important)

Per [Overwolf SDK docs](https://dev.overwolf.com/ow-native/getting-started/sdk-introduction#get-whitelisted-as-a-developer), **only whitelisted developer accounts** can load or run apps that are not from the official Appstore — including unpacked extensions and unsigned OPKs.

- If you are the **app author** or actively developing: submit an [app proposal](https://www.overwolf.com/app-proposal-submission-form/login-form) to get your Overwolf username whitelisted (typically reviewed within a few business days).
- If you are a **regular player** (not a developer): Overwolf may block the unpacked load with *"Unauthorized App"* even when the folder path is correct. **Use the Henrik API fallback** in Auto-Log Setup until Twans Val Auto-Log is published on the Overwolf Appstore.

### Step 4 — Enable the app

In Overwolf, enable **Twans Val Auto-Log** (Library tab or apps tray). The icon is the **cyan squircle with star** (Twans Ultimate Tracker mark). If you update the tracker folder, reload via **Load unpacked extension** again.

### Step 5 — Start the tracker

1. Double-click **`Valorant Tracker.bat`** — keep the console window open
2. Open **`http://localhost:8080`** in your browser (use the tab the `.bat` opens)
3. Sign in if needed → **Auto-Log Setup** should show **● Overwolf linked** once the extension pings the bridge
4. Turn **Auto-log** on in the dock

### Step 6 — Play

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
| **Unauthorized App** — *"install from an unauthorized source"* | **(1)** Sign in: click **Appstore** in the Overwolf dock and log into your Overwolf account, then retry **Load unpacked extension**. **(2)** If still blocked: your account is not **developer-whitelisted** — Overwolf only allows unpacked/non-store apps for approved developers ([docs](https://dev.overwolf.com/ow-native/getting-started/onboarding-resources/basic-sample-app/)). Use **Henrik API fallback** below, or submit an [app proposal](https://www.overwolf.com/app-proposal-submission-form/login-form) if you are developing this extension. |
| **missing manifest.json** / extension won't load | You picked the wrong folder (Desktop, repo root, etc.). Run **`OPEN-THIS-FOLDER.bat`** in `integrations/overwolf` or use **Copy path** in Auto-Log Setup. |
| Tracker says **Auto-log off** | Run **`Valorant Tracker.bat`** first. Use **`http://localhost:8080`**, not port 5500 or GitHub Pages. |
| **Waiting for Overwolf extension** | Reload the unpacked extension in Overwolf. Keep `.bat` running. Restart Overwolf if needed. |
| Pill never shows **Overwolf linked** | Open Auto-Log Setup → **Copy path** → reload extension pointing at that folder. Hard refresh tracker (Ctrl+F5). |
| No match logged | Auto-log must be ON. Play a full Competitive/Unrated match — not custom. Check Overwolf sees Valorant running. |
| Tried to install from Appstore / OPK | This extension is loaded via **Development options → Load unpacked extension**, not the Store. |

## Fallback — Henrik API (recommended if Unauthorized App persists)

If Overwolf blocks the unpacked extension (not logged in, or account not developer-whitelisted), auto-log still works without Overwolf:

1. Open the tracker at **`http://localhost:8080`** with **`Valorant Tracker.bat`** running
2. Go to **Auto-Log Setup**
3. Expand **Fallback — Henrik API (if not using Overwolf)**
4. Enter your **Riot ID** + region and a free API key from [api.henrikdev.xyz/dashboard](https://api.henrikdev.xyz/dashboard/)
5. Click **Apply & Go**

## Publish to Overwolf store (optional)

Create a developer account at [Overwolf Developers](https://dev.overwolf.com/), add store assets, and submit this folder for review.
