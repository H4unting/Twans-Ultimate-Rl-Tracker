/**
 * Twans Ultimate Tracker — Windows desktop launcher (tray)
 * Starts local tracker (:8080) + bridge (:49200), opens browser, auto-restarts on crash.
 */

const {
  app, Tray, Menu, shell, nativeImage, dialog,
} = require('electron');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const APP_VERSION = '1.2.0';
const APP_TITLE = 'Twans Ultimate Tracker';
const BRIDGE_STATUS_URL = 'http://127.0.0.1:49200/status';
const TRACKER_STATUS_URL = 'http://127.0.0.1:8080/api/bridge/status';
const DEFAULT_TRACKER_URL = 'http://localhost:8080';
const MAX_RESTARTS = 8;
const RESTART_BASE_MS = 2500;

let tray = null;
let bridgeProc = null;
let statusTimer = null;
let restartAttempts = 0;
let appQuitting = false;
let bridgeState = {
  running: false,
  trackerUp: false,
  rlConnected: false,
  gameRunning: false,
  playerName: null,
  error: null,
  phase: 'connecting',
};
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

function resolveConfigDir(root) {
  const nested = path.join(root, 'config');
  if (fs.existsSync(nested)) return nested;
  return root;
}

function readConfigJson(root, fileName, fallback = {}) {
  const nested = path.join(root, 'config', fileName);
  if (fs.existsSync(nested)) return readJson(nested, fallback);
  return readJson(path.join(root, fileName), fallback);
}

function findDataRoot() {
  const candidates = uniqueDirs([
    process.env.TWANS_TRACKER_ROOT,
    process.env.PORTABLE_EXECUTABLE_DIR,
    process.env.PORTABLE_EXECUTABLE_FILE ? path.dirname(process.env.PORTABLE_EXECUTABLE_FILE) : null,
    process.cwd(),
    path.dirname(process.execPath),
    path.resolve(__dirname, '..', '..', '..'),
    path.resolve(__dirname, '..', '..'),
  ]);

  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }

  return path.dirname(process.execPath);
}

function findBridgeScriptsDir(dataRoot) {
  const bundled = path.join(process.resourcesPath, 'bridge-scripts');
  if (fs.existsSync(path.join(bundled, 'start-grind.mjs'))) {
    return bundled;
  }

  const local = path.join(dataRoot, 'scripts');
  if (fs.existsSync(path.join(local, 'start-grind.mjs'))) {
    return local;
  }

  const dev = path.resolve(__dirname, '..', '..', '..', 'scripts');
  if (fs.existsSync(path.join(dev, 'start-grind.mjs'))) {
    return dev;
  }

  const legacyDev = path.resolve(__dirname, '..', '..', 'scripts');
  if (fs.existsSync(path.join(legacyDev, 'start-grind.mjs'))) {
    return legacyDev;
  }

  return null;
}

function loadLauncherConfig(root) {
  const fromRoot = readConfigJson(root, 'bridge-launcher.json', {});
  const fromGrind = readConfigJson(root, 'grind-config.json', {});
  launcherConfig = {
    trackerUrl: fromRoot.trackerUrl || fromGrind.trackerUrl || DEFAULT_TRACKER_URL,
    openTrackerOnStart: fromRoot.openTrackerOnStart !== false,
  };
}

function findNodeExecutable(dataRoot) {
  const candidates = [
    path.join(dataRoot, 'tools', 'launcher', 'node-runtime', 'node.exe'),
    path.join(dataRoot, 'launcher', 'node-runtime', 'node.exe'),
  ];
  for (const bundled of candidates) {
    if (fs.existsSync(bundled)) return bundled;
  }

  const which = spawnSync('where', ['node'], { encoding: 'utf8', windowsHide: true });
  if (which.status === 0) {
    const first = which.stdout.split(/\r?\n/).find(Boolean);
    if (first) return first.trim();
  }

  return null;
}

function appendBridgeLog(dataRoot, chunk) {
  if (!dataRoot) return;
  const logPath = path.join(resolveConfigDir(dataRoot), 'bridge.log');
  try {
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > 2_000_000) {
      fs.writeFileSync(logPath, `[log rotated ${new Date().toISOString()}]\n`);
    }
  } catch {
    /* ignore rotation errors */
  }
  fs.appendFile(logPath, chunk, () => {});
}

function fetchJson(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, json: JSON.parse(data) });
        } catch {
          resolve({ ok: false, json: null });
        }
      });
    });
    req.on('error', () => resolve({ ok: false, json: null }));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve({ ok: false, json: null });
    });
  });
}

function createTrayIcon(phase) {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  const colors = {
    tracking: [56, 180, 90],
    waiting: [230, 170, 40],
    connecting: [100, 140, 220],
    error: [230, 70, 70],
  };
  const [r, g, b] = colors[phase] || colors.connecting;

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

function statusLine() {
  if (bridgeState.error) return bridgeState.error;
  if (bridgeState.phase === 'tracking') return 'Tracking — game connected';
  if (bridgeState.phase === 'waiting') return 'Waiting — launch your game';
  if (bridgeState.phase === 'connecting') return 'Starting services…';
  return 'Error — check bridge.log';
}

function buildMenu() {
  const player = bridgeState.playerName
    ? `Player: ${bridgeState.playerName}`
    : 'Player: set name in tracker setup';

  return Menu.buildFromTemplate([
    { label: `${APP_TITLE} v${APP_VERSION}`, enabled: false },
    { label: statusLine(), enabled: false },
    { label: player, enabled: false },
    { type: 'separator' },
    {
      label: 'Open tracker',
      click: () => shell.openExternal(launcherConfig.trackerUrl),
    },
    {
      label: 'Restart tracker',
      click: () => {
        restartAttempts = 0;
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
  tray.setImage(createTrayIcon(bridgeState.phase));
  tray.setToolTip(`${APP_TITLE} — ${statusLine()}`);
  tray.setContextMenu(buildMenu());
}

async function pollStatus() {
  const [bridge, tracker] = await Promise.all([
    fetchJson(BRIDGE_STATUS_URL),
    fetchJson(TRACKER_STATUS_URL),
  ]);

  bridgeState.trackerUp = tracker.ok;
  if (bridge.ok && bridge.json) {
    bridgeState.running = true;
    bridgeState.rlConnected = Boolean(bridge.json.rlConnected);
    bridgeState.gameRunning = Boolean(
      bridge.json.inMatch
      || bridge.json.rocketLeagueRunning
      || bridge.json.valorantProcessRunning,
    );
    bridgeState.playerName = bridge.json.playerName || bridgeState.playerName;
    bridgeState.error = null;
    restartAttempts = 0;

    if (bridgeState.gameRunning || bridge.json.inMatch) {
      bridgeState.phase = 'tracking';
    } else if (bridgeState.rlConnected || bridgeState.trackerUp) {
      bridgeState.phase = 'waiting';
    } else {
      bridgeState.phase = 'waiting';
    }
  } else if (tracker.ok) {
    bridgeState.running = true;
    bridgeState.rlConnected = false;
    bridgeState.gameRunning = false;
    bridgeState.phase = 'waiting';
    bridgeState.error = null;
  } else if (bridgeProc && !bridgeProc.killed) {
    bridgeState.running = true;
    bridgeState.phase = 'connecting';
  } else {
    bridgeState.running = false;
    bridgeState.rlConnected = false;
    bridgeState.gameRunning = false;
    bridgeState.phase = 'error';
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
  bridgeState.gameRunning = false;
}

function scheduleBridgeRestart(dataRoot, scriptsDir, nodePath) {
  if (appQuitting || restartAttempts >= MAX_RESTARTS) {
    bridgeState.error = restartAttempts >= MAX_RESTARTS
      ? 'Tracker stopped — use Restart from tray menu'
      : null;
    bridgeState.phase = 'error';
    refreshTray();
    return;
  }
  restartAttempts += 1;
  const delay = Math.min(RESTART_BASE_MS * restartAttempts, 15000);
  bridgeState.error = `Restarting… (${restartAttempts}/${MAX_RESTARTS})`;
  bridgeState.phase = 'connecting';
  refreshTray();
  setTimeout(() => {
    if (!appQuitting) startBridge(dataRoot, scriptsDir, nodePath);
  }, delay);
}

function startBridge(dataRoot, scriptsDir, nodePath) {
  stopBridge();

  const scriptPath = path.join(scriptsDir, 'start-grind.mjs');
  appendBridgeLog(dataRoot, `\n--- ${APP_TITLE} start v${APP_VERSION} ---\n`);
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
    bridgeProc = null;
    bridgeState.running = false;
    bridgeState.rlConnected = false;
    bridgeState.gameRunning = false;
    if (appQuitting) return;
    if (code === 0) {
      void pollStatus();
      return;
    }
    appendBridgeLog(dataRoot, `\n[exit code ${code}]\n`);
    scheduleBridgeRestart(dataRoot, scriptsDir, nodePath);
  });

  bridgeState.error = null;
  bridgeState.phase = 'connecting';
  bridgeState.running = true;
  refreshTray();
}

function showSetupError(message) {
  dialog.showErrorBox(`${APP_TITLE} v${APP_VERSION}`, message);
}

app.whenReady().then(() => {
  const dataRoot = findDataRoot();
  const scriptsDir = findBridgeScriptsDir(dataRoot);

  if (!scriptsDir) {
    showSetupError(
      'Tracker scripts are missing from this build.\n\n'
      + 'Run build-tray-app.bat from the tracker folder to rebuild Twans Ultimate Tracker.exe.',
    );
    app.quit();
    return;
  }

  const nodePath = findNodeExecutable(dataRoot);
  if (!nodePath) {
    showSetupError(
      'Node.js is required to run the tracker.\n\n'
      + 'Install Node.js LTS from https://nodejs.org\n'
      + 'Or use Rocket League Tracker.bat until Node is installed.',
    );
    app.quit();
    return;
  }

  app.dataRoot = dataRoot;
  app.scriptsDir = scriptsDir;
  app.nodePath = nodePath;
  loadLauncherConfig(dataRoot);

  tray = new Tray(createTrayIcon('connecting'));
  tray.setToolTip(APP_TITLE);
  tray.on('double-click', () => shell.openExternal(launcherConfig.trackerUrl));
  refreshTray();

  startBridge(dataRoot, scriptsDir, nodePath);

  if (launcherConfig.openTrackerOnStart) {
    setTimeout(() => shell.openExternal(launcherConfig.trackerUrl), 1200);
  }

  statusTimer = setInterval(pollStatus, 2500);
  pollStatus();
});

app.on('before-quit', () => {
  appQuitting = true;
  if (statusTimer) clearInterval(statusTimer);
  stopBridge();
});

app.on('window-all-closed', (e) => e.preventDefault());
