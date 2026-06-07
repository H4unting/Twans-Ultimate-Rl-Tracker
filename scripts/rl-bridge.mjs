#!/usr/bin/env node
/**
 * Local bridge: Rocket League Stats API (TCP :49123) → HTTP :49200 for the tracker.
 */

import net from 'net';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyLocalSetup, getSetupStatus, loadGrindConfig } from './local-setup.mjs';
import {
  applyCors,
  ALLOWED_ORIGINS,
  checkRateLimit,
  getBridgeAuthToken,
  initBridgeAuth,
  readJsonBody,
  requireBridgeAuth,
  sendRateLimited,
  validateSetupApply,
} from './bridge-security.mjs';

const RL_PORT = 49123;
const DEFAULT_HTTP_PORT = 49200;

let valorantBridge = null;
let valorantBridgeError = null;

async function loadValorantBridge() {
  if (valorantBridge) return valorantBridge;
  if (valorantBridgeError) return null;
  try {
    valorantBridge = await import('./valorant-bridge.mjs');
    return valorantBridge;
  } catch (err) {
    valorantBridgeError = err;
    console.warn(`Valorant auto-log unavailable (${err.message}). Rocket League bridge still works.`);
    return null;
  }
}

function unwrapData(raw) {
  let data = raw.data ?? raw.Data ?? raw;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { data = {}; }
  }
  return data ?? {};
}

function inferMode(playerCount) {
  if (playerCount <= 2) return "1's";
  if (playerCount <= 4) return "2's";
  return "3's";
}

const RANKED_PLAYLIST_IDS = {
  10: "1's",
  11: "2's",
  13: "3's",
  28: "2's",
  29: "3's",
  30: "2's",
  34: "3's",
};

function parsePlaylist(data) {
  const pi = data.PlaylistInfo || data.playlistInfo || data.Playlist || data.playlist || {};
  const name = pi.Name || pi.name || data.PlaylistName || data.playlistName || '';
  const id = pi.Id ?? pi.id ?? data.PlaylistId ?? data.playlistId ?? null;
  const isRanked = /ranked/i.test(name) || pi.bRanked || data.bRanked || RANKED_PLAYLIST_IDS[id] != null;
  return { name: name || null, id, isRanked };
}

function inferModeFromPlaylist(playlist, playerCount) {
  const name = (playlist?.name || '').toLowerCase();
  if (name.includes('duel') || name.includes('1v1') || name.includes('solo')) return "1's";
  if (name.includes('double') || name.includes('2v2') || name.includes('hoops') || name.includes('dropshot')) return "2's";
  if (name.includes('standard') || name.includes('3v3') || name.includes('rumble') || name.includes('snow day')) return "3's";
  if (playlist?.id != null && RANKED_PLAYLIST_IDS[playlist.id]) {
    return RANKED_PLAYLIST_IDS[playlist.id];
  }
  return inferMode(playerCount);
}


export function startBridge(options = {}) {
  initBridgeAuth({ token: options.authToken });
  const config = loadGrindConfig();
  let activePlayerName = (
    options.playerName
    ?? config.rlDisplayName
    ?? process.env.RL_PLAYER_NAME
    ?? ''
  ).trim();
  const httpPort = options.httpPort ?? DEFAULT_HTTP_PORT;
  const skipRl = Boolean(options.skipRl);
  const manualValPoll = options.manualValPoll !== false;
  const valLauncherMode = Boolean(options.valLauncherMode);

  let rlConnected = false;
  let inMatch = false;
  let live = { goals: 0, assists: 0, saves: 0, score: 0 };
  let lastMatch = null;
  let buffer = '';
  let playerTeamNum = null;
  let lastPlayerCount = 0;
  let currentMatchGuid = null;
  let lastFinalizedGuid = null;
  let pendingWinnerTeamNum = null;
  let currentPlaylist = { name: null, id: null, isRanked: false };

  function setPlayerName(name) {
    activePlayerName = String(name ?? '').trim();
    if (activePlayerName) {
      console.log(`Watching player: ${activePlayerName}`);
    }
  }

  function matchPlayer(players) {
    if (!players?.length) return null;
    if (!activePlayerName) return players.find(p => !p.bBot) ?? players[0];
    const q = activePlayerName.toLowerCase();
    return players.find(p => (p.Name || p.PlayerName || '').toLowerCase() === q)
      ?? players.find(p => (p.Name || p.PlayerName || '').toLowerCase().includes(q));
  }

  function applyPlayer(p) {
    if (!p) return;
    if (p.TeamNum != null || p.teamNum != null) {
      playerTeamNum = p.TeamNum ?? p.teamNum;
    }
    live = {
      goals: p.Goals ?? p.goals ?? 0,
      assists: p.Assists ?? p.assists ?? 0,
      saves: p.Saves ?? p.saves ?? 0,
      score: p.Score ?? p.score ?? 0,
    };
  }

  function parseObjects(chunk) {
    buffer += chunk;
    const events = [];
    let depth = 0;
    let start = -1;
    for (let i = 0; i < buffer.length; i++) {
      const c = buffer[i];
      if (c === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (c === '}') {
        depth--;
        if (depth === 0 && start >= 0) {
          const slice = buffer.slice(start, i + 1);
          try { events.push(JSON.parse(slice)); } catch { /* partial */ }
          start = -1;
        }
      }
    }
    if (depth === 0 && start === -1) buffer = '';
    else if (start >= 0) buffer = buffer.slice(start);
    return events;
  }

  function resetLiveMatch() {
    inMatch = true;
    live = { goals: 0, assists: 0, saves: 0, score: 0 };
    pendingWinnerTeamNum = null;
  }

  function finalizeMatch(winnerTeamNum) {
    if (winnerTeamNum == null || playerTeamNum == null) return;

    const guid = currentMatchGuid || `local-${Date.now()}`;
    if (lastFinalizedGuid === guid) return;
    lastFinalizedGuid = guid;

    const result = winnerTeamNum === playerTeamNum ? 'W' : 'L';
    lastMatch = {
      goals: live.goals,
      assists: live.assists,
      saves: live.saves,
      score: live.score,
      result,
      mode: inferModeFromPlaylist(currentPlaylist, lastPlayerCount),
      playlist: currentPlaylist.name,
      isRanked: currentPlaylist.isRanked,
      winnerTeamNum,
      playerTeamNum,
      matchGuid: guid,
      endedAt: Date.now(),
      consumed: false,
    };
    inMatch = false;
    const plLabel = currentPlaylist.name ? ` · ${currentPlaylist.name}` : '';
    console.log(`Match ended — ${result} · ${lastMatch.mode}${plLabel} · G:${live.goals} A:${live.assists} S:${live.saves}`);
  }

  function handleEvent(raw) {
    const event = raw.event || raw.Event || raw.type || '';
    const data = unwrapData(raw);

    if (data.MatchGuid) currentMatchGuid = data.MatchGuid;

    if (event === 'MatchCreated' || event === 'MatchInitialized' || event === 'RoundStarted') {
      resetLiveMatch();
      lastFinalizedGuid = null;
      if (event !== 'RoundStarted') {
        currentPlaylist = parsePlaylist(data);
      }
    }

    const players = data.Players || data.players;
    if (players?.length) {
      inMatch = true;
      lastPlayerCount = players.length;
      applyPlayer(matchPlayer(players));
    }

    const game = data.Game || data.game;
    if (game?.bHasWinner && game.Teams?.length) {
      const winnerName = game.Winner || game.winner;
      const team = game.Teams.find(t => t.Name === winnerName || t.name === winnerName);
      if (team) pendingWinnerTeamNum = team.TeamNum ?? team.teamNum;
    }

    if (event === 'MatchEnded') {
      const winner = data.WinnerTeamNum ?? data.winnerTeamNum ?? pendingWinnerTeamNum;
      finalizeMatch(winner);
    } else if (event === 'PodiumStart') {
      if (!lastMatch || lastMatch.consumed || lastMatch.matchGuid !== currentMatchGuid) {
        finalizeMatch(pendingWinnerTeamNum);
      }
      inMatch = false;
    }
  }

  let lastRlRetryLogAt = 0;
  const RL_RETRY_MS = skipRl ? 0 : 15000;
  const logRlRetry = (msg) => {
    const now = Date.now();
    if (now - lastRlRetryLogAt < 30000) return;
    lastRlRetryLogAt = now;
    console.log(msg);
  };

  function connectRL() {
    const socket = net.connect(RL_PORT, '127.0.0.1');
    socket.setEncoding('utf8');

    socket.on('connect', () => {
      rlConnected = true;
      console.log(`Connected to Rocket League Stats API (:${RL_PORT})`);
    });

    socket.on('data', chunk => {
      parseObjects(chunk).forEach(handleEvent);
    });

    socket.on('close', () => {
      rlConnected = false;
      inMatch = false;
      logRlRetry('RL connection closed — retrying in 15s… (RL not running or Stats API off)');
      setTimeout(connectRL, RL_RETRY_MS);
    });

    socket.on('error', () => {
      rlConnected = false;
      socket.destroy();
      logRlRetry('RL Stats API unavailable — retrying in 15s…');
      setTimeout(connectRL, RL_RETRY_MS);
    });
  }

  const server = http.createServer(async (req, res) => {
    applyCors(req, res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const urlPath = (req.url || '/').split('?')[0];
    const rate = checkRateLimit(req, urlPath);
    if (!rate.allowed) {
      sendRateLimited(res, rate.retryAfterSec);
      return;
    }
    if (!requireBridgeAuth(req, res, urlPath)) return;

    try {
      if (urlPath === '/status') {
        const payload = {
          rlConnected,
          inMatch,
          playerName: activePlayerName || null,
          httpPort,
          playlist: currentPlaylist.name,
          isRanked: currentPlaylist.isRanked,
          authRequired: true,
        };
        const origin = req.headers.origin;
        if (!origin || ALLOWED_ORIGINS.has(origin)) {
          payload.authToken = getBridgeAuthToken();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
        return;
      }

      if (urlPath === '/setup/status') {
        const setup = getSetupStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ...setup,
          bridgePlayerName: activePlayerName || null,
          rlConnected,
        }));
        return;
      }

      if (urlPath === '/setup/apply' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const validated = validateSetupApply(body);
        const applied = applyLocalSetup({
          rlDisplayName: validated.rlDisplayName,
          riotId: validated.riotId,
          henrikApiKey: validated.henrikApiKey,
          riotRegion: validated.riotRegion,
          patchIni: validated.patchIni,
        });
        const valBridge = await loadValorantBridge();
        valBridge?.resetValorantCache({ full: true });
        setPlayerName(applied.rlDisplayName);
        if (body.riotId && valBridge) {
          applied.riotValidation = await valBridge.validateRiotConfig();
          if (applied.riotValidation?.ok) valBridge.armValorantPolling();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(applied));
        return;
      }

      if (urlPath === '/live') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ inMatch, stats: live }));
        return;
      }

      if (urlPath === '/last-match') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(lastMatch));
        return;
      }

      if (urlPath === '/last-match/consume' && req.method === 'POST') {
        const out = lastMatch;
        if (lastMatch) lastMatch = { ...lastMatch, consumed: true };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(out));
        return;
      }

      const valBridge = await loadValorantBridge();
      if (valBridge?.handleValorantRequest(req, res)) return;

      res.writeHead(404);
      res.end('Not found');
    } catch (err) {
      const status = err.message?.includes('Unexpected field')
        || err.message?.includes('Invalid')
        || err.message?.includes('too large')
        || err.message?.includes('Enter your')
        ? 400
        : 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(httpPort, '127.0.0.1', () => {
      console.log(`Stats bridge → http://127.0.0.1:${httpPort}`);
      if (!activePlayerName) {
        console.warn('Tip: run setup in the tracker and click Apply & Go (or set RLNAME in Rocket League Tracker.bat)');
      } else {
        console.log(`Watching player: ${activePlayerName}`);
      }
      if (!skipRl) {
        console.log('Rocket League bridge connects in 30s (use Valorant Tracker.bat if you are only playing Val)');
        setTimeout(connectRL, 30000);
      } else {
        console.log('Valorant-only mode — Rocket League TCP bridge skipped');
      }
      loadValorantBridge().then((valBridge) => {
        valBridge?.startValorantBridge({
          manualArm: manualValPoll,
          deferPollMs: options.deferPollMs,
          launcherMode: valLauncherMode,
        });
      });
      resolve(server);
    });
  });
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const playerName = process.argv[2]?.trim() || '';
  startBridge({ playerName }).catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
