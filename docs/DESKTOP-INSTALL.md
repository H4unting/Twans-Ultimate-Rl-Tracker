# Desktop install — Windows Smart App Control & unsigned builds

This guide is for **developers and early testers** running locally built copies of **Twans Ultimate Tracker**. It explains why Windows may block the EXE and what you can do **right now** without a code-signing certificate.

> **We cannot bypass Smart App Control (SAC) from the app or repo.** SAC is enforced by Windows. Local unsigned builds require either changing Windows settings (your choice) or obtaining an **Authenticode** certificate for release builds.

---

## Why Windows blocked the EXE

When you see **“Smart App Control blocked”** with *“could not verify its publisher”*, Windows refused to run the file because:

1. The EXE is **not signed** with a trusted Authenticode certificate.
2. **Smart App Control** (Windows 11, when enabled) blocks unsigned or unrecognized apps **before** they run. There is no “Run anyway” button for SAC the way SmartScreen sometimes offers.

Metadata in `electron-builder` (`productName`, `publisherName`, etc.) improves installer labels and version info but **does not** satisfy SAC or SmartScreen. Only a valid code signature from a trusted CA does.

---

## Smart App Control vs SmartScreen

| | **Smart App Control (SAC)** | **SmartScreen** |
|---|---------------------------|-------------------|
| **Where** | Windows Security → App & browser control → Smart App Control | Same area, under “Reputation-based protection” |
| **When active** | Windows 11 — often after a clean install in **evaluation mode**, or when you turned it **On** | Most Windows 10/11 installs |
| **Unsigned app** | **Blocked** — app does not start | May warn (“Windows protected your PC”) but often allows **More info → Run anyway** |
| **Fix for dev** | Turn SAC **Off** (see below) or use dev paths that avoid the packaged EXE | Unblock-File / remove Mark of the Web; or sign the binary |

SAC and SmartScreen are separate. Disabling SmartScreen does **not** disable SAC.

---

## What to do RIGHT NOW (local development)

Pick one path. All avoid needing a cert for day-to-day coding.

### Option A — Run without the packaged EXE (recommended for dev)

From the repo root:

```powershell
cd tools\launcher
npm install   # first time only
npm start
```

This launches Electron in dev mode: same UI and bridge behavior, no unsigned portable EXE. **SAC does not apply** to `electron .` the same way it blocks a downloaded unsigned EXE.

### Option B — Turn off Smart App Control (Windows settings)

If you need to test the **packaged** portable EXE or NSIS installer:

1. Open **Windows Security** → **App & browser control** → **Smart App Control**.
2. Set Smart App Control to **Off**.

**Notes:**

- SAC is often only configurable while Windows is **not** in Smart App Control evaluation mode. If the toggle is missing or greyed out, you may need to reinstall Windows without SAC evaluation, or stay on **Option A** until you have a signed build.
- Turning SAC off is a **machine-wide** security choice — only do this on a dev PC you control.

There is no supported in-app or script workaround for SAC on an unsigned EXE.

### Option C — Unblock file / remove Mark of the Web (SmartScreen & MOTW)

Helpful when Windows downloaded the ZIP/EXE from the browser and applied **Mark of the Web** (MOTW), or when **SmartScreen** (not SAC) is the blocker:

**PowerShell (repo root):**

```powershell
.\scripts\unblock-local-exe.ps1
```

Or manually:

```powershell
Unblock-File -LiteralPath ".\Twans Ultimate Tracker.exe"
```

For a downloaded ZIP **before** extracting:

1. Right-click the `.zip` → **Properties**.
2. If you see **Unblock**, check it → **Apply** → extract.
3. Or: `Unblock-File -LiteralPath ".\TwansUltimateTracker.zip"`

`Unblock-File` clears MOTW; it **does not** satisfy Smart App Control if SAC is On and blocking unsigned apps.

### Option D — Run build output directly

After `cd tools\launcher && npm run build`:

- Portable: `tools\launcher\dist\Twans Ultimate Tracker.exe`
- Unpacked: `tools\launcher\dist\win-unpacked\Twans Ultimate Tracker.exe`

`postbuild` also copies the portable EXE to the repo root. **Same signing status** — SAC will block these too if SAC is On and the binary is unsigned.

---

## Building locally (maintainers)

```powershell
cd tools\launcher
npm run build          # portable + NSIS installer
npm run build:portable # portable only
npm run build:installer
```

Outputs:

| Artifact | Path |
|----------|------|
| Portable EXE | `tools\launcher\dist\Twans Ultimate Tracker.exe` |
| NSIS installer | `tools\launcher\dist\TwansUltimateTrackerSetup.exe` |
| Copied portable | repo root `Twans Ultimate Tracker.exe` |

The NSIS installer uses **one-click: off** and lets the user choose the install directory. The installer can still be blocked when unsigned under SAC or SmartScreen.

---

## Long-term: code signing (commercial distribution)

For players and public release, plan on **Authenticode code signing**:

| Approach | Notes |
|----------|--------|
| **Standard code signing cert** | From a public CA (DigiCert, Sectigo, etc.). Reduces SmartScreen warnings over time as reputation builds. |
| **EV (Extended Validation) cert** | Higher trust; often faster SmartScreen reputation; may require hardware token (USB HSM). **Recommended** for a desktop product distributed on the web. |
| **electron-builder** | Set `win.signAndEditExecutable: true` (or remove `false`) and provide cert via environment variables at build time. |

**Never commit** certificate files or passwords to git.

### Signing environment variables (CI / release machine only)

Set on the build host when you have a cert — not in the repo:

| Variable | Purpose |
|----------|---------|
| `CSC_LINK` | Path to `.pfx` / `.p12` **or** base64-encoded cert (CI secret) |
| `CSC_KEY_PASSWORD` | Password for the cert container |

Example (PowerShell, local release machine):

```powershell
$env:CSC_LINK = "C:\secrets\twans-codesign.pfx"
$env:CSC_KEY_PASSWORD = "your-password-here"
cd tools\launcher
npm run build
```

See also `.env.example` — signing vars are documented there as comments only; real values belong in user env or CI secrets.

After signing, rebuild portable + installer and smoke-test on a **fresh VM** with SAC On and default SmartScreen to validate player experience.

---

## Quick reference

| Goal | Action |
|------|--------|
| Code today, no SAC fight | `cd tools\launcher && npm start` |
| Test packaged EXE on dev PC | SAC **Off**, or accept Windows block until signed |
| SmartScreen / MOTW after download | `Unblock-File` or `scripts\unblock-local-exe.ps1` |
| Ship to players | Authenticode signing (EV recommended) + installer smoke on clean Windows |

---

## Related docs

- [DESKTOP-VISION.md](DESKTOP-VISION.md) — product packaging roadmap
- [REGRESSION-CHECKLIST-DESKTOP.md](REGRESSION-CHECKLIST-DESKTOP.md) — installer smoke matrix
- Desktop engineer skill — `tools/launcher/` build and EXE-first architecture
