/**
 * Twans Tracker Bridge — Windows tray launcher
 * Bridge scripts are bundled inside the app; config lives next to the exe.
 */

const {
  app, Tray, Menu, shell, nativeImage, dialog,
} = require('electron');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const APP_VERSION = '1.1.0';
const BRIDGE_STATUS_URL = 'http://127.0.0.1:49200/status';
const DEFAULT_TRACKER_URL = 'https://h4unting.github.io/Twans-Ultimate-Rl-Tracker/';

let tray = null;
let bridgeProc = null;
let statusTimer = null;
let bridgeState = { running: false, rlConnected: false, playerName: null, error: null };
let launcherConfig = { trackerUrl: DEFAULT_TRACKER_URL, openTrackerOnStart: true };

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (launcherConfig.trackerUrl) {
      shell.openExternal(launcherConfig.trackerUrl);
    }
  });
}

app.disableHardwareAcceleration();

function readJson(filePath, fallback) {
  try {
    return { ...fallback, ...JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  } catch {
    return fallback;
  }
}

function uniqueDirs(candidates) {
  const seen = new Set();
  const out = [];
  for (const dir of candidates) {
    if (!dir) continue;
    const normalized = path.resolve(String(dir).trim());
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

/** Folder where grind-config.json / bridge.log live — next to the exe you clicked. */
function findDataRoot() {
  const candidates = uniqueDirs([
    process.env.TWANS_TRACKER_ROOT,
    process.env.PORTABLE_EXECUTABLE_DIR,
    process.env.PORTABLE_EXECUTABLE_FILE ? path.dirname(process.env.PORTABLE_EXECUTABLE_FILE) : null,
    process.cwd(),
    path.dirname(process.execPath),
    path.resolve(__dirname, '..', '..'),
  ]);

  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }

  return path.dirname(process.execPath);
}

/** Bundled bridge scripts (inside the exe) or local scripts/ folder. */
function findBridgeScriptsDir(dataRoot) {
  const bundled = path.join(process.resourcesPath, 'bridge-scripts');
  if (fs.existsSync(path.join(bundled, 'start-grind.mjs'))) {
    return bundled;
  }

  const local = path.join(dataRoot, 'scripts');
  if (fs.existsSync(path.join(local, 'start-grind.mjs'))) {
    return local;
  }

  const dev = path.resolve(__dirname, '..', '..', 'scripts');
  if (fs.existsSync(path.join(dev, 'start-grind.mjs'))) {
    return dev;
  }

  return null;
}

function loadLauncherConfig(root) {
  const fromRoot = readJson(path.join(root, 'bridge-launcher.json'), {});
  const fromGrind = readJson(path.join(root, 'grind-config.json'), {});
  launcherConfig = {
    trackerUrl: fromRoot.trackerUrl || fromGrind.trackerUrl || DEFAULT_TRACKER_URL,
    openTrackerOnStart: fromRoot.openTrackerOnStart !== false,
  };
}

function findNodeExecutable(dataRoot) {
  const bundled = path.join(dataRoot, 'launcher', 'node-runtime', 'node.exe');
  if (fs.existsSync(bundled)) return bundled;

  const which = spawnSync('where', ['node'], { encoding: 'utf8', windowsHide: true });
  if (which.status === 0) {
    const first = which.stdout.split(/\r?\n/).find(Boolean);
    if (first) return first.trim();
  }

  return null;
}

function appendBridgeLog(dataRoot, chunk) {
  if (!dataRoot) return;
  const logPath = path.join(dataRoot, 'bridge.log');
  fs.appendFile(logPath, chunk, () => {});
}

function createTrayIcon(connected) {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  const r = connected ? 56 : 230;
  const g = connected ? 180 : 92;
  const b = connected ? 90 : 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - size / 2 + 0.5;
      const dy = y - size / 2 + 0.5;
      const inside = (dx * dx + dy * dy) <= (size / 2 - 1) ** 2;
      const o = (y * size + x) * 4;
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
      buf[o + 3] = inside ? 255 : 0;
    }
  }

  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

function fetchBridgeStatus() {
  return new Promise((resolve) => {
    const req = http.get(BRIDGE_STATUS_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(null);
    });
  });
}

function statusLine() {
  if (bridgeState.error) return bridgeState.error;
  if (!bridgeState.running) return 'Bridge starting…';
  if (bridgeState.rlConnected) return 'RL connected — auto-stats on';
  return 'Bridge running — waiting for Rocket League';
}

function buildMenu() {
  const player = bridgeState.playerName
    ? `Player: ${bridgeState.playerName}`
    : 'Player: set name in tracker setup';

  return Menu.buildFromTemplate([
    { label: `Twans Tracker Bridge v${APP_VERSION}`, enabled: false },
    { label: statusLine(), enabled: false },
    { label: player, enabled: false },
    { type: 'separator' },
    {
      label: 'Open tracker',
      click: () => shell.openExternal(launcherConfig.trackerUrl),
    },
    {
      label: 'Restart bridge',
      click: () => {
        stopBridge();
        startBridge(app.dataRoot, app.scriptsDir, app.nodePath);
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]);
}

function refreshTray() {
  if (!tray) return;
  tray.setImage(createTrayIcon(bridgeState.rlConnected));
  tray.setToolTip(`Twans Tracker Bridge — ${statusLine()}`);
  tray.setContextMenu(buildMenu());
}

async function pollStatus() {
  const status = await fetchBridgeStatus();
  if (status) {
    bridgeState.running = true;
    bridgeState.rlConnected = Boolean(status.rlConnected);
    bridgeState.playerName = status.playerName || bridgeState.playerName;
    bridgeState.error = null;
  } else if (bridgeProc && !bridgeProc.killed) {
    bridgeState.running = true;
    bridgeState.rlConnected = false;
  } else {
    bridgeState.running = false;
    bridgeState.rlConnected = false;
  }
  refreshTray();
}

function stopBridge() {
  if (bridgeProc && !bridgeProc.killed) {
    try {
      spawnSync('taskkill', ['/pid', String(bridgeProc.pid), '/T', '/F'], { windowsHide: true });
    } catch {
      bridgeProc.kill();
    }
  }
  bridgeProc = null;
  bridgeState.running = false;
  bridgeState.rlConnected = false;
}

function startBridge(dataRoot, scriptsDir, nodePath) {
  stopBridge();

  const scriptPath = path.join(scriptsDir, 'start-grind.mjs');
  appendBridgeLog(dataRoot, `\n--- Bridge start v${APP_VERSION} ---\n`);
  appendBridgeLog(dataRoot, `dataRoot=${dataRoot}\nscriptsDir=${scriptsDir}\n`);

  bridgeProc = spawn(nodePath, [scriptPath], {
    cwd: dataRoot,
    env: {
      ...process.env,
      TWANS_TRACKER_ROOT: dataRoot,
      TRACKER_URL: launcherConfig.trackerUrl,
      BRIDGE_NO_BROWSER: '1',
      BRIDGE_QUIET: '1',
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  bridgeProc.stdout?.on('data', (chunk) => appendBridgeLog(dataRoot, chunk));
  bridgeProc.stderr?.on('data', (chunk) => appendBridgeLog(dataRoot, chunk));

  bridgeProc.on('exit', (code) => {
    if (code && code !== 0) {
      bridgeState.error = `Bridge exited (${code}) — see bridge.log`;
    }
    bridgeProc = null;
    bridgeState.running = false;
    bridgeState.rlConnected = false;
    refreshTray();
  });

  bridgeState.error = null;
  bridgeState.running = true;
  refreshTray();
}

function showSetupError(message) {
  dialog.showErrorBox(`Twans Tracker Bridge v${APP_VERSION}`, message);
}

app.whenReady().then(() => {
  const dataRoot = findDataRoot();
  const scriptsDir = findBridgeScriptsDir(dataRoot);

  if (!scriptsDir) {
    showSetupError(
      'Bridge scripts are missing from this build.\n\n'
      + 'Run launcher\\build-bridge.bat again to rebuild the exe.',
    );
    app.quit();
    return;
  }

  const nodePath = findNodeExecutable(dataRoot);
  if (!nodePath) {
    showSetupError(
      'Node.js is required to run the RL bridge.\n\n'
      + 'Install Node.js LTS from https://nodejs.org\n'
      + 'Or use start-grind.bat until Node is installed.',
    );
    app.quit();
    return;
  }

  app.dataRoot = dataRoot;
  app.scriptsDir = scriptsDir;
  app.nodePath = nodePath;
  loadLauncherConfig(dataRoot);

  tray = new Tray(createTrayIcon(false));
  tray.setToolTip('Twans Tracker Bridge');
  tray.on('double-click', () => shell.openExternal(launcherConfig.trackerUrl));
  refreshTray();

  startBridge(dataRoot, scriptsDir, nodePath);

  if (launcherConfig.openTrackerOnStart) {
    shell.openExternal(launcherConfig.trackerUrl);
  }

  statusTimer = setInterval(pollStatus, 2500);
  pollStatus();
});

app.on('before-quit', () => {
  if (statusTimer) clearInterval(statusTimer);
  stopBridge();
});

app.on('window-all-closed', (e) => e.preventDefault());
