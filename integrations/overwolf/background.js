/** Twans Val Auto-Log — Overwolf background page (feeds local bridge on :49200) */

const BRIDGE = 'http://127.0.0.1:49200';
const VALORANT_GAME_ID = 21640;
const FEATURES = ['gep_internal', 'me', 'game_info', 'match_info', 'kill', 'death'];

const AGENT_MAP = {
  Clay_PC_C: 'Raze',
  Pandemic_PC_C: 'Viper',
  Wraith_PC_C: 'Omen',
  Hunter_PC_C: 'Sova',
  Thorne_PC_C: 'Sage',
  Phoenix_PC_C: 'Phoenix',
  Wushu_PC_C: 'Jett',
  Gumshoe_PC_C: 'Cypher',
  Sarge_PC_C: 'Brimstone',
  Breach_PC_C: 'Breach',
  Vampire_PC_C: 'Reyna',
  Killjoy_PC_C: 'Killjoy',
  Guide_PC_C: 'Skye',
  Stealth_PC_C: 'Yoru',
  Rift_PC_C: 'Astra',
  Grenadier_PC_C: 'KAY/O',
  Deadeye_PC_C: 'Chamber',
  Sprinter_PC_C: 'Neon',
  BountyHunter_PC_C: 'Fade',
  Mage_PC_C: 'Harbor',
  AggroBot_PC_C: 'Gekko',
  Cable_PC_C: 'Deadlock',
  Sequoia_PC_C: 'Iso',
  Smonk_PC_C: 'Clove',
  Nox_PC_C: 'Vyse',
  Cashew_PC_C: 'Tejo',
  Terra_PC_C: 'Waylay',
};

const state = {
  agent: '',
  map: '',
  gameMode: '',
  matchOutcome: '',
  matchId: '',
  kills: 0,
  deaths: 0,
  assists: 0,
  inMatch: false,
  lastSentId: '',
};

function agentName(id) {
  if (!id) return '';
  return AGENT_MAP[id] || id.replace(/_PC_C$/i, '').replace(/_/g, ' ');
}

function resetMatchState() {
  state.agent = '';
  state.map = '';
  state.gameMode = '';
  state.matchOutcome = '';
  state.matchId = '';
  state.kills = 0;
  state.deaths = 0;
  state.assists = 0;
  state.inMatch = false;
}

function bridgePost(path, body) {
  return fetch(`${BRIDGE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : '{}',
  }).catch(() => null);
}

function pingBridge() {
  return bridgePost('/valorant/overwolf/ping').then((res) => res?.ok === true);
}

const PING_FAST_MS = 5000;
const PING_SLOW_MS = 20000;
let bridgePingOk = false;
let pingTimer = null;

function scheduleBridgePing() {
  if (pingTimer) clearInterval(pingTimer);
  const ms = bridgePingOk ? PING_SLOW_MS : PING_FAST_MS;
  pingTimer = setInterval(async () => {
    const ok = await pingBridge();
    if (ok && !bridgePingOk) {
      bridgePingOk = true;
      scheduleBridgePing();
    }
  }, ms);
}

function applyInfoUpdate(update) {
  const info = update?.info;
  if (!info) return;

  if (info.me?.agent) state.agent = agentName(info.me.agent);
  if (info.match_info?.map) state.map = info.match_info.map;
  if (info.match_info?.game_mode) state.gameMode = info.match_info.game_mode;
  if (info.match_info?.match_outcome) state.matchOutcome = info.match_info.match_outcome;
  if (info.match_info?.match_id) state.matchId = info.match_info.match_id;
  if (info.match_info?.pseudo_match_id && !state.matchId) {
    state.matchId = info.match_info.pseudo_match_id;
  }

  Object.keys(info.match_info || {}).forEach((key) => {
    if (!key.startsWith('scoreboard_')) return;
    try {
      const row = JSON.parse(info.match_info[key]);
      if (!row?.is_local) return;
      state.kills = Number(row.kills ?? state.kills);
      state.deaths = Number(row.deaths ?? state.deaths);
      state.assists = Number(row.assists ?? state.assists);
      if (row.character) state.agent = agentName(row.character);
    } catch { /* ignore malformed scoreboard rows */ }
  });
}

async function sendMatchEnd() {
  const outcome = String(state.matchOutcome || '').toLowerCase();
  const result = outcome === 'victory' ? 'W' : outcome === 'defeat' ? 'L' : null;
  if (!result) return;

  const matchId = state.matchId || `ow-${Date.now()}`;
  if (state.lastSentId === matchId) return;

  const rounds = Math.max(state.kills + state.deaths, 1);
  const acs = Math.round((state.kills * 150 + state.assists * 50) / rounds);

  const res = await bridgePost('/valorant/overwolf-match', {
    result,
    match_outcome: outcome,
    game_mode: state.gameMode,
    agent: state.agent,
    map: state.map,
    kills: state.kills,
    deaths: state.deaths,
    valAssists: state.assists,
    assists: state.assists,
    acs,
    matchId,
  });

  if (res?.ok) state.lastSentId = matchId;
}

function onGameEvent(event) {
  if (event.name === 'match_start') {
    resetMatchState();
    state.inMatch = true;
    pingBridge();
    return;
  }
  if (event.name === 'match_end') {
    sendMatchEnd().finally(resetMatchState);
  }
}

function onNewEvents(payload) {
  (payload?.events || []).forEach(onGameEvent);
}

function onInfoUpdates2(update) {
  applyInfoUpdate(update);
}

function registerGameEvents() {
  overwolf.games.events.setRequiredFeatures(FEATURES, (result) => {
    if (result?.success === false) {
      console.warn('Twans Val Auto-Log: could not register GEP features', result);
    }
  });
  overwolf.games.events.onNewEvents.addListener(onNewEvents);
  overwolf.games.events.onInfoUpdates2.addListener(onInfoUpdates2);
}

function whenValorantRunning(cb) {
  overwolf.games.getRunningGameInfo((info) => {
    if (info?.isRunning && info.classId === VALORANT_GAME_ID) cb();
  });
}

function init() {
  pingBridge().then((ok) => {
    if (ok) bridgePingOk = true;
    scheduleBridgePing();
  });

  whenValorantRunning(registerGameEvents);

  overwolf.games.onGameInfoUpdated.addListener((update) => {
    if (update?.gameInfo?.classId !== VALORANT_GAME_ID) return;
    if (update.gameInfo.isRunning) registerGameEvents();
    else resetMatchState();
  });
}

if (typeof overwolf !== 'undefined') init();
