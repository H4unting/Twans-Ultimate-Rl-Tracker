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
const CONFIG_FILE = path.join(ROOT, 'grind-config.json');

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

export function patchStartGrindBat(rlName) {
  const batPath = path.join(ROOT, 'start-grind.bat');
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
      /REM === EDIT THIS to your exact Rocket League display name ===/,
      `REM === EDIT THIS to your exact Rocket League display name ===\r\n${line}`,
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

  return {
    config,
    paths: {
      trackerRoot: ROOT,
      grindConfig: CONFIG_FILE,
      grindConfigExists: fs.existsSync(CONFIG_FILE),
      startGrindBat: path.join(ROOT, 'start-grind.bat'),
      statsApiIni: iniPath,
      statsApiIniExists: fs.existsSync(iniPath),
      statsApiIniConfigured: iniOk,
    },
  };
}

export function applyLocalSetup({ rlDisplayName, riotId, riotApiKey, riotRegion, patchIni = true }) {
  const name = String(rlDisplayName ?? '').trim();
  const partial = {};
  if (name) partial.rlDisplayName = name;
  if (riotId) partial.riotId = String(riotId).trim();
  if (riotApiKey) partial.riotApiKey = String(riotApiKey).trim();
  if (riotRegion) partial.riotRegion = String(riotRegion).trim().toLowerCase();
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
      result.warnings.push(`Could not update start-grind.bat: ${e.message}`);
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
