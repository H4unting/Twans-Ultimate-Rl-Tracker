/** Write local tracker + Rocket League config from the setup wizard (bridge only). */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

function resolveTrackerRoot() {
  if (process.env.TWANS_TRACKER_ROOT) {
    return path.resolve(process.env.TWANS_TRACKER_ROOT);
  }
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
}

const ROOT = resolveTrackerRoot();
const CONFIG_DIR = path.join(ROOT, 'config');

const LEGACY_FILES = [
  ['grind-config.json', 'grind-config.json'],
  ['bridge-launcher.json', 'bridge-launcher.json'],
  ['.valorant-bridge-state.json', '.valorant-bridge-state.json'],
  ['bridge.log', 'bridge.log'],
];

function ensureConfigDir() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function migrateLegacyConfigFiles() {
  ensureConfigDir();
  for (const [legacyName, targetName] of LEGACY_FILES) {
    const legacy = path.join(ROOT, legacyName);
    const target = path.join(CONFIG_DIR, targetName);
    if (!fs.existsSync(legacy) || fs.existsSync(target)) continue;
    try {
      fs.renameSync(legacy, target);
    } catch {
      try { fs.copyFileSync(legacy, target); } catch { /* ignore */ }
    }
  }
}

migrateLegacyConfigFiles();

const CONFIG_FILE = path.join(CONFIG_DIR, 'grind-config.json');
const VAL_BRIDGE_STATE_FILE = path.join(CONFIG_DIR, '.valorant-bridge-state.json');
const BRIDGE_LAUNCHER_FILE = path.join(CONFIG_DIR, 'bridge-launcher.json');
const BRIDGE_LOG_FILE = path.join(CONFIG_DIR, 'bridge.log');

export function getConfigDir() {
  return CONFIG_DIR;
}

export function getBridgeLogPath() {
  return BRIDGE_LOG_FILE;
}

export function loadValorantBridgeState() {
  try {
    return JSON.parse(fs.readFileSync(VAL_BRIDGE_STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function saveValorantBridgeState(partial) {
  ensureConfigDir();
  const next = {
    ...loadValorantBridgeState(),
    ...partial,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(VAL_BRIDGE_STATE_FILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

export function clearValorantBridgeState() {
  try {
    fs.unlinkSync(VAL_BRIDGE_STATE_FILE);
  } catch { /* ignore */ }
}

const INI_SECTION = '[TAGame.MatchStatsExporter_TA]';
const INI_KEYS = { Port: '49123', PacketSendRate: '10' };

export function getTrackerRoot() {
  return ROOT;
}

export function loadGrindConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function saveGrindConfig(partial) {
  ensureConfigDir();
  const next = { ...loadGrindConfig(), ...partial, updatedAt: new Date().toISOString() };
  fs.writeFileSync(CONFIG_FILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

export function findStatsApiIniPath() {
  const home = os.homedir();
  const candidates = [
    path.join(home, 'Documents', 'My Games', 'Rocket League', 'TAGame', 'Config', 'DefaultStatsAPI.ini'),
    path.join(home, 'OneDrive', 'Documents', 'My Games', 'Rocket League', 'TAGame', 'Config', 'DefaultStatsAPI.ini'),
    path.join(home, 'OneDrive', 'My Games', 'Rocket League', 'TAGame', 'Config', 'DefaultStatsAPI.ini'),
  ];
  return candidates.find(p => fs.existsSync(p)) ?? candidates[0];
}

function patchIniSection(lines, section, keys) {
  let start = lines.findIndex(l => l.trim().toLowerCase() === section.toLowerCase());
  if (start === -1) {
    if (lines.length && lines[lines.length - 1]?.trim()) lines.push('');
    lines.push(section);
    start = lines.length - 1;
  }

  let end = start + 1;
  while (end < lines.length && lines[end].trim() && !lines[end].trim().startsWith('[')) end++;

  const existing = {};
  for (let i = start + 1; i < end; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith(';')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    existing[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }

  const merged = { ...existing, ...keys };
  const body = Object.entries(merged).map(([k, v]) => `${k}=${v}`);
  return [...lines.slice(0, start + 1), ...body, ...lines.slice(end)];
}

export function patchStatsApiIni(iniPath = findStatsApiIniPath()) {
  fs.mkdirSync(path.dirname(iniPath), { recursive: true });
  let content = '';
  try {
    content = fs.readFileSync(iniPath, 'utf8');
  } catch {
    content = '';
  }
  const lines = content.split(/\r?\n/);
  const next = patchIniSection(lines, INI_SECTION, INI_KEYS);
  fs.writeFileSync(iniPath, `${next.join('\n').replace(/\n+$/, '')}\n`, 'utf8');
  return iniPath;
}

const RL_LAUNCHER_BAT = 'Rocket League Tracker.bat';

export function patchStartGrindBat(rlName) {
  const batPath = path.join(ROOT, RL_LAUNCHER_BAT);
  const safe = String(rlName ?? '').trim().replace(/"/g, '');
  if (!safe) throw new Error('Name is empty');

  let content = fs.readFileSync(batPath, 'utf8');
  const line = safe.includes(' ')
    ? `set "RLNAME=${safe}"`
    : `set RLNAME=${safe}`;

  if (/^set "?RLNAME=/m.test(content)) {
    content = content.replace(/^set "?RLNAME=.*$/m, line);
  } else {
    content = content.replace(
      /REM === Your RL name \(or set via tracker setup — Apply & Go\) ===/,
      `REM === Your RL name (or set via tracker setup — Apply & Go) ===\r\n${line}`,
    );
  }

  fs.writeFileSync(batPath, content, 'utf8');
  return batPath;
}

export function getSetupStatus() {
  const iniPath = findStatsApiIniPath();
  const config = loadGrindConfig();
  let iniOk = false;
  try {
    if (fs.existsSync(iniPath)) {
      const text = fs.readFileSync(iniPath, 'utf8');
      iniOk = /PacketSendRate\s*=\s*10/i.test(text) && /Port\s*=\s*49123/i.test(text);
    }
  } catch { /* ignore */ }

  const henrikKey = String(config.henrikApiKey || '').trim();
  const envHenrik = String(process.env.HENRIK_API_KEY || '').trim();
  const legacyRiotKey = String(config.riotApiKey || '').trim();
  const key = envHenrik || henrikKey || (legacyRiotKey.startsWith('RGAPI-') ? '' : legacyRiotKey);
  const { riotApiKey: _omit, henrikApiKey: _omit2, ...safeConfig } = config;
  return {
    config: {
      ...safeConfig,
      henrikApiKeySet: Boolean(key),
      hasLegacyRiotKey: legacyRiotKey.startsWith('RGAPI-'),
      /** Prefer HENRIK_API_KEY env var — keys are never returned to the client. */
      henrikKeyViaEnv: Boolean(process.env.HENRIK_API_KEY?.trim()),
    },
    paths: {
      trackerRoot: ROOT,
      configDir: CONFIG_DIR,
      overwolfExtension: path.join(ROOT, 'tracker', 'integrations', 'overwolf'),
      grindConfig: CONFIG_FILE,
      grindConfigExists: fs.existsSync(CONFIG_FILE),
      startGrindBat: path.join(ROOT, RL_LAUNCHER_BAT),
      startValGrindBat: path.join(ROOT, 'Valorant Tracker.bat'),
      legacyStartGrindBat: path.join(ROOT, 'start-grind.bat'),
      legacyStartValGrindBat: path.join(ROOT, 'start-val-grind.bat'),
      statsApiIni: iniPath,
      statsApiIniExists: fs.existsSync(iniPath),
      statsApiIniConfigured: iniOk,
    },
  };
}

export function applyLocalSetup({ rlDisplayName, riotId, riotApiKey, henrikApiKey, riotRegion, patchIni = true }) {
  const name = String(rlDisplayName ?? '').trim().slice(0, 64);
  const partial = {};
  if (name) partial.rlDisplayName = name;
  if (riotId) partial.riotId = String(riotId).trim().slice(0, 64);
  // Env var takes precedence — do not overwrite disk key with empty wizard submit.
  const envHenrik = String(process.env.HENRIK_API_KEY ?? '').trim();
  const henrik = String(henrikApiKey ?? riotApiKey ?? '').trim();
  if (henrik && !henrik.startsWith('RGAPI-')) partial.henrikApiKey = henrik.slice(0, 128);
  else if (envHenrik && !envHenrik.startsWith('RGAPI-')) {
    /* key loaded from environment at runtime — optional persist skip */
  }
  if (riotRegion) partial.riotRegion = String(riotRegion).trim().toLowerCase().slice(0, 16);
  if (Object.keys(partial).length) saveGrindConfig(partial);

  if (!name && !riotId) throw new Error('Enter your Rocket League or Riot ID first');

  const result = {
    ok: true,
    rlDisplayName: name || partial.rlDisplayName || '',
    files: {},
    warnings: [],
  };

  result.files.grindConfig = CONFIG_FILE;

  if (name) {
    try {
      result.files.startGrindBat = patchStartGrindBat(name);
    } catch (e) {
      result.warnings.push(`Could not update Rocket League Tracker.bat: ${e.message}`);
    }
  }

  if (patchIni) {
    const iniPath = findStatsApiIniPath();
    try {
      result.files.statsApiIni = patchStatsApiIni(iniPath);
      result.iniNeedsRlRestart = true;
    } catch (e) {
      result.warnings.push(`Stats API file: ${e.message}`);
    }
  }

  return result;
}

export { BRIDGE_LAUNCHER_FILE, CONFIG_FILE, CONFIG_DIR };
