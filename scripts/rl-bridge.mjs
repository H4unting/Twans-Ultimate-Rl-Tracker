#!/usr/bin/env node
/**
 * Local bridge: Rocket League Stats API (TCP :49123) → HTTP :49200 for the tracker.
 *
 * Usually started via start-grind.bat / scripts/start-grind.mjs (one window).
 * Standalone: node scripts/rl-bridge.mjs "YourExactRLName"
 */

import net from 'net';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const RL_PORT = 49123;
const DEFAULT_HTTP_PORT = 49200;

export function startBridge(options = {}) {
  const playerName = (options.playerName ?? process.env.RL_PLAYER_NAME ?? '').trim();
  const httpPort = options.httpPort ?? DEFAULT_HTTP_PORT;

  let rlConnected = false;
  let inMatch = false;
  let live = { goals: 0, assists: 0, saves: 0, score: 0 };
  let lastMatch = null;
  let buffer = '';

  function matchPlayer(players) {
    if (!players?.length) return null;
    if (!playerName) return players.find(p => !p.bBot) ?? players[0];
    const q = playerName.toLowerCase();
    return players.find(p => (p.Name || p.PlayerName || '').toLowerCase() === q)
      ?? players.find(p => (p.Name || p.PlayerName || '').toLowerCase().includes(q));
  }

  function applyPlayer(p) {
    if (!p) return;
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

  function handleEvent(raw) {
    const event = raw.event || raw.Event || raw.type || '';
    const data = raw.data || raw;

    if (event === 'MatchCreated' || event === 'MatchInitialized' || event === 'RoundStarted') {
      inMatch = true;
      live = { goals: 0, assists: 0, saves: 0, score: 0 };
    }

    const players = data.Players || data.players;
    if (players?.length) {
      inMatch = true;
      applyPlayer(matchPlayer(players));
    }

    if (event === 'MatchEnded' || event === 'PodiumStart') {
      if (inMatch && (live.goals || live.assists || live.saves || live.score)) {
        lastMatch = { ...live, endedAt: Date.now(), consumed: false };
        console.log(`Match ended — G:${live.goals} A:${live.assists} S:${live.saves}`);
      }
      inMatch = false;
    }
  }

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
      console.log('RL connection closed — retrying in 3s…');
      setTimeout(connectRL, 3000);
    });

    socket.on('error', () => {
      rlConnected = false;
      socket.destroy();
      setTimeout(connectRL, 3000);
    });
  }

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    if (req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        rlConnected,
        inMatch,
        playerName: playerName || null,
        httpPort,
      }));
      return;
    }

    if (req.url === '/live') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ inMatch, stats: live }));
      return;
    }

    if (req.url === '/last-match') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(lastMatch));
      return;
    }

    if (req.url === '/last-match/consume' && req.method === 'POST') {
      const out = lastMatch;
      if (lastMatch) lastMatch = { ...lastMatch, consumed: true };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out));
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(httpPort, '127.0.0.1', () => {
      console.log(`Stats bridge → http://127.0.0.1:${httpPort}`);
      if (!playerName) {
        console.warn('Tip: set RLNAME in start-grind.bat to your exact RL display name');
      } else {
        console.log(`Watching player: ${playerName}`);
      }
      connectRL();
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
