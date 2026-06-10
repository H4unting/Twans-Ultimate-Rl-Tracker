/**
 * Twans Ultimate Tracker — Windows desktop launcher (tray + embedded window)
 * Starts local tracker (:8080) + bridge (:49200), auto-restarts on crash.
 * UI loads via twans:// custom protocol — no visible localhost URL.
 */

const {
  app, Tray, Menu, shell, nativeImage, dialog, BrowserWindow, protocol, net,
} = require('electron');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { pathToFileURL } = require('url');

const APP_VERSION = '1.3.0';
const APP_TITLE = 'Twans Ultimate Tracker';
const APP_PROTOCOL = 'twans';
const APP_HOST = 'app';
const APP_URL = `${APP_PROTOCOL}://${APP_HOST}/index.html`;
const INTERNAL_TRACKER_ORIGIN = 'http://127.0.0.1:8080';
const BRIDGE_STATUS_URL = 'http://127.0.0.1:49200/status';
const TRACKER_STATUS_URL = `${INTERNAL_TRACKER_ORIGIN}/api/bridge/status`;
const MAX_RESTARTS = 8;
const RESTART_BASE_MS = 2500;
const TRACKER_READY_ATTEMPTS = 3;
const APP_LOAD_ATTEMPTS = 3;
const APP_LOAD_RETRY_MS = 400;
/** Chromium: navigation replaced (splash → app, blocked localhost redirect) */
const ERR_ABORTED = -3;
const IS_DEV = !app.isPackaged;

protocol.registerSchemesAsPrivileged([{
  scheme: APP_PROTOCOL,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
  },
}]);

let tray = null;
let mainWindow = null;
let bridgeProc = null;
let statusTimer = null;
let restartAttempts = 0;
let appQuitting = false;
let trackerRoot = null;
let startupT0 = 0;
let bridgeState = {
  running: false,
  trackerUp: false,
  rlConnected: false,
  gameRunning: false,
  playerName: null,
  error: null,
  phase: 'connecting',
};
let launcherConfig = { openTrackerOnStart: true };
let appLoadInFlight = false;
let trackerLoadFailures = 0;
let trackerErrorShown = false;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showTrackerWindow();
  });
}

app.disableHardwareAcceleration();

function logStartup(message) {
  const elapsed = startupT0 ? Date.now() - startupT0 : 0;
  const line = `[startup +${elapsed}ms] ${message}`;
  if (IS_DEV) console.log(line);
  if (app.dataRoot) appendBridgeLog(app.dataRoot, `${line}\n`);
}

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

function findTrackerRoot(dataRoot) {
  const bundled = path.join(process.resourcesPath, 'tracker-app');
  if (fs.existsSync(path.join(bundled, 'index.html'))) return bundled;
  if (fs.existsSync(path.join(dataRoot, 'index.html'))) return dataRoot;
  return dataRoot;
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
  launcherConfig = {
    openTrackerOnStart: fromRoot.openTrackerOnStart !== false,
  };
}

function isPathUnderRoot(root, filePath) {
  const rel = path.relative(path.resolve(root), path.resolve(filePath));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function registerAppProtocol(root) {
  const appRoot = path.resolve(root);
  protocol.handle(APP_PROTOCOL, async (request) => {
    try {
      const reqUrl = new URL(request.url);
      let rel = decodeURIComponent(reqUrl.pathname);
      if (rel === '/' || rel === '') rel = '/index.html';
      const filePath = path.resolve(appRoot, rel.replace(/^\//, '').split('/').join(path.sep));
      if (!isPathUnderRoot(appRoot, filePath)) {
        return new Response('Forbidden', { status: 403 });
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        appendBridgeLog(app.dataRoot, `[protocol] missing ${filePath}\n`);
        return new Response('Not found', { status: 404 });
      }
      return net.fetch(pathToFileURL(filePath).href);
    } catch (err) {
      appendBridgeLog(app.dataRoot, `[protocol] ${err}\n`);
      return new Response('Server error', { status: 500 });
    }
  });
}

function getAppIconPath() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  const ico = path.join(assetsDir, 'icon.ico');
  if (fs.existsSync(ico)) return ico;
  const png = path.join(assetsDir, 'icon.png');
  if (fs.existsSync(png)) return png;
  return undefined;
}

function loadAppIconImage() {
  const iconPath = getAppIconPath();
  if (!iconPath) return nativeImage.createEmpty();
  const img = nativeImage.createFromPath(iconPath);
  return img.isEmpty() ? nativeImage.createEmpty() : img;
}

function getWindowIcon() {
  return getAppIconPath();
}

function getSplashDataUrl() {
  const iconPath = getWindowIcon();
  let iconSrc = '';
  if (iconPath) {
    try {
      const b64 = fs.readFileSync(iconPath).toString('base64');
      iconSrc = `data:image/png;base64,${b64}`;
    } catch { /* text-only splash */ }
  }
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:#0a0a0f;color:#e8e8ef;font-family:Segoe UI,system-ui,sans-serif}
    .wrap{text-align:center;padding:32px}
    img{width:72px;height:72px;border-radius:16px;margin-bottom:20px;
      box-shadow:0 0 32px -8px rgba(230,92,0,.55)}
    h1{font-size:18px;font-weight:700;letter-spacing:.04em;margin-bottom:8px}
    h1 span{color:#e65c00}
    p{font-size:13px;color:#8888a0}
    .spin{width:28px;height:28px;border:3px solid rgba(230,92,0,.25);
      border-top-color:#e65c00;border-radius:50%;margin:20px auto 0;
      animation:spin .8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style></head><body><div class="wrap">
    ${iconSrc ? `<img src="${iconSrc}" alt="">` : ''}
    <h1>TWANS <span>ULTIMATE</span></h1>
    <p>Starting tracker…</p>
    <div class="spin" aria-hidden="true"></div>
  </div></body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
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

function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function waitForTrackerReady(maxMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const tracker = await fetchJson(TRACKER_STATUS_URL);
    if (tracker.ok) return true;
    await sleep(400);
  }
  return false;
}

function isOAuthCallbackUrl(url) {
  try {
    const u = new URL(url);
    const hostOk = u.hostname === '127.0.0.1' || u.hostname === 'localhost';
    const portOk = u.port === '8080' || u.port === '';
    if (!hostOk || !portOk) return false;
    return u.hash.includes('access_token=')
      || u.hash.includes('error=')
      || u.search.includes('code=');
  } catch {
    return false;
  }
}

function appUrlFromOAuthCallback(url) {
  const u = new URL(url);
  return `${APP_URL}${u.search}${u.hash}`;
}

function wireWindowNavigation(win) {
  const handleRedirect = (event, url) => {
    if (isOAuthCallbackUrl(url)) {
      event.preventDefault();
      void win.loadURL(appUrlFromOAuthCallback(url));
      return;
    }
    if (url.startsWith(INTERNAL_TRACKER_ORIGIN) || url.startsWith('http://localhost:8080')) {
      event.preventDefault();
    }
  };

  win.webContents.on('will-navigate', handleRedirect);
  win.webContents.on('will-redirect', handleRedirect);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (!IS_DEV) {
    win.webContents.on('devtools-opened', () => {
      win.webContents.closeDevTools();
    });
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      const key = String(input.key || '').toLowerCase();
      const reload = key === 'f5'
        || (input.control && key === 'r')
        || (input.control && input.shift && key === 'r');
      if (reload) event.preventDefault();
    });
  }
}

function createTrayIcon(phase) {
  const base = loadAppIconImage();
  if (!base.isEmpty()) {
    const sized = base.getSize();
    if (sized.width !== 16 || sized.height !== 16) {
      return base.resize({ width: 16, height: 16 });
    }
    return base;
  }

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
  if (bridgeState.error && bridgeState.phase === 'error') return 'Connection issue';
  if (bridgeState.phase === 'tracking') return 'Tracking';
  if (bridgeState.phase === 'waiting') return 'Waiting for game';
  if (bridgeState.phase === 'connecting') return 'Starting…';
  return 'Connection issue';
}

function buildMenu() {
  return Menu.buildFromTemplate([
    { label: `${APP_TITLE} v${APP_VERSION}`, enabled: false },
    { label: statusLine(), enabled: false },
    { type: 'separator' },
    {
      label: 'Open',
      click: () => showTrackerWindow(),
    },
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

function showTrackerWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }
  createMainWindow();
  void openTrackerOnStart();
  return mainWindow;
}

function openTrackerFallback() {
  if (trackerErrorShown || appQuitting) return;
  trackerErrorShown = true;
  appendBridgeLog(app.dataRoot, '[window] tracker failed to load after retries\n');
  dialog.showMessageBox({
    type: 'warning',
    title: APP_TITLE,
    message: 'Connection issue — the app is retrying.',
    detail: 'If this keeps happening, quit from the tray icon and open Twans Ultimate Tracker again.',
  }).finally(() => {
    trackerErrorShown = false;
  });
}

function scheduleAppLoadRetry(reason) {
  if (appQuitting || trackerLoadFailures >= APP_LOAD_ATTEMPTS) {
    openTrackerFallback();
    return;
  }
  trackerLoadFailures += 1;
  appendBridgeLog(app.dataRoot, `[window] ${reason}; retry ${trackerLoadFailures}/${APP_LOAD_ATTEMPTS}\n`);
  setTimeout(() => {
    if (!appQuitting) void retryOpenTracker();
  }, APP_LOAD_RETRY_MS * trackerLoadFailures);
}

async function retryOpenTracker() {
  await waitForTrackerReady(15000);
  await loadAppIntoWindow();
}

function createMainWindow() {
  try {
    logStartup('creating main window');
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 860,
      minWidth: 900,
      minHeight: 640,
      title: APP_TITLE,
      icon: getWindowIcon(),
      autoHideMenuBar: true,
      show: true,
      backgroundColor: '#0a0a0f',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        devTools: IS_DEV,
      },
    });

    wireWindowNavigation(mainWindow);

    mainWindow.on('close', (e) => {
      if (!appQuitting) {
        e.preventDefault();
        mainWindow.hide();
      }
    });

    mainWindow.webContents.on('did-finish-load', () => {
      const url = mainWindow.webContents.getURL();
      if (url.startsWith(`${APP_PROTOCOL}://`)) {
        trackerLoadFailures = 0;
        logStartup('tracker SPA loaded');
      } else if (String(url).startsWith('data:')) {
        logStartup('splash paint complete');
      }
    });

    mainWindow.webContents.on('did-fail-load', (_event, code, desc, url, isMainFrame) => {
      if (!isMainFrame || appQuitting) return;
      if (code === ERR_ABORTED) return;
      if (String(url || '').startsWith('data:')) return;
      appendBridgeLog(app.dataRoot, `[window load failed] ${code} ${desc} ${url}\n`);
      scheduleAppLoadRetry(`load failed (${code})`);
    });

    void mainWindow.loadURL(getSplashDataUrl());
    logStartup('splash loaded');
    return mainWindow;
  } catch (err) {
    appendBridgeLog(app.dataRoot, `[window create failed] ${err}\n`);
    scheduleAppLoadRetry('window create failed');
    return null;
  }
}

async function loadAppIntoWindow() {
  if (appLoadInFlight) return;
  appLoadInFlight = true;
  try {
    if (!mainWindow || mainWindow.isDestroyed()) {
      if (!createMainWindow()) return;
    }
    logStartup(`loading app via twans:// (attempt ${trackerLoadFailures + 1})`);
    await mainWindow.loadURL(APP_URL);
    logStartup('app window ready');
    trackerLoadFailures = 0;
  } catch (err) {
    appendBridgeLog(app.dataRoot, `[app load failed] ${err}\n`);
    scheduleAppLoadRetry('app load threw');
  } finally {
    appLoadInFlight = false;
  }
}

async function openTrackerOnStart() {
  logStartup('loading app shell (backend may still be starting)');
  trackerLoadFailures = 0;
  await loadAppIntoWindow();

  void (async () => {
    logStartup('waiting for backend services');
    let ready = false;
    for (let attempt = 1; attempt <= TRACKER_READY_ATTEMPTS; attempt += 1) {
      const budgetMs = attempt === 1 ? 45000 : 15000;
      ready = await waitForTrackerReady(budgetMs);
      if (ready) break;
      appendBridgeLog(app.dataRoot, `[window] backend not ready (attempt ${attempt}/${TRACKER_READY_ATTEMPTS})\n`);
      if (attempt < TRACKER_READY_ATTEMPTS) await sleep(2000);
    }
    if (ready) {
      logStartup('backend services ready');
    } else {
      appendBridgeLog(app.dataRoot, '[window] backend slow — SPA will retry bridge connection\n');
    }
  })();
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
      ? 'Tracker stopped — quit and reopen the app'
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
  appendBridgeLog(dataRoot, `dataRoot=${dataRoot}\ntrackerRoot=${trackerRoot}\nscriptsDir=${scriptsDir}\n`);

  bridgeProc = spawn(nodePath, [scriptPath], {
    cwd: dataRoot,
    env: {
      ...process.env,
      TWANS_TRACKER_ROOT: dataRoot,
      TRACKER_URL: INTERNAL_TRACKER_ORIGIN,
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

app.whenReady().then(async () => {
  startupT0 = Date.now();
  logStartup('app ready');

  const dataRoot = findDataRoot();
  trackerRoot = findTrackerRoot(dataRoot);
  const scriptsDir = findBridgeScriptsDir(dataRoot);

  if (!fs.existsSync(path.join(trackerRoot, 'index.html'))) {
    showSetupError(
      'Tracker files are missing from this build.\n\n'
      + 'Run build-tray-app.bat from the tracker folder to rebuild Twans Ultimate Tracker.exe.',
    );
    app.quit();
    return;
  }

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
      + 'Or use the installer build when bundled Node is available.',
    );
    app.quit();
    return;
  }

  app.dataRoot = dataRoot;
  app.scriptsDir = scriptsDir;
  app.nodePath = nodePath;
  loadLauncherConfig(dataRoot);

  registerAppProtocol(trackerRoot);
  logStartup(`protocol registered (root=${trackerRoot}, index=${fs.existsSync(path.join(trackerRoot, 'index.html'))})`);

  tray = new Tray(createTrayIcon('connecting'));
  tray.setToolTip(APP_TITLE);
  tray.on('double-click', () => showTrackerWindow());
  refreshTray();

  if (launcherConfig.openTrackerOnStart) {
    createMainWindow();
    logStartup('splash window shown');
  }

  startBridge(dataRoot, scriptsDir, nodePath);
  logStartup('bridge process spawned');

  if (launcherConfig.openTrackerOnStart) {
    logStartup('loading twans:// immediately');
    void openTrackerOnStart();
  }

  statusTimer = setInterval(pollStatus, 3000);
  pollStatus();
  logStartup('startup pipeline complete');
});

app.on('before-quit', () => {
  appQuitting = true;
  if (statusTimer) clearInterval(statusTimer);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.removeAllListeners('close');
    mainWindow.close();
  }
  stopBridge();
});

app.on('window-all-closed', (e) => e.preventDefault());
