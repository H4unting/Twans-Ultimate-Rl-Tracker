export type GameId = "rocket-league" | "valorant"

export type Game = {
  id: GameId
  name: string
  short: string
  accent: string // tailwind text color via inline style token
}

export const GAMES: Game[] = [
  { id: "rocket-league", name: "Rocket League", short: "RL", accent: "var(--chart-1)" },
  { id: "valorant", name: "Valorant", short: "VAL", accent: "var(--destructive)" },
]

export type GameProfile = {
  rank: string
  division: string
  rankImageHint: string
  playlist: string
  mmrLabel: string
  mmr: number
  mmrToNext: number
  nextRank: string
  rankFloor: number
  rankCeil: number
  profileLevel: number
  levelProgress: number // 0-100
  winStreak: number
  session: {
    active: boolean
    games: number
    netMmr: number
    durationMin: number
  }
  performance: {
    winRate: number
    winRateDelta: number
    kdaLabel: string
    kda: string
    primaryStats: { label: string; value: string; delta: number }[]
    trend: number[] // mmr trend over recent games (relative)
  }
}

export const PROFILES: Record<GameId, GameProfile> = {
  "rocket-league": {
    rank: "Champion II",
    division: "Division III",
    rankImageHint: "rocket league champion rank emblem",
    playlist: "Ranked Doubles 2v2",
    mmrLabel: "MMR",
    mmr: 1248,
    mmrToNext: 52,
    nextRank: "Champion III",
    rankFloor: 1145,
    rankCeil: 1300,
    profileLevel: 287,
    levelProgress: 64,
    winStreak: 5,
    session: { active: true, games: 7, netMmr: 38, durationMin: 92 },
    performance: {
      winRate: 61,
      winRateDelta: 4,
      kdaLabel: "Avg Score",
      kda: "412",
      primaryStats: [
        { label: "Goals", value: "1.8", delta: 0.3 },
        { label: "Assists", value: "1.1", delta: 0.1 },
        { label: "Saves", value: "2.4", delta: -0.2 },
      ],
      trend: [1180, 1172, 1195, 1188, 1210, 1224, 1216, 1238, 1232, 1248],
    },
  },
  valorant: {
    rank: "Diamond I",
    division: "RR 64",
    rankImageHint: "valorant diamond rank badge",
    playlist: "Competitive",
    mmrLabel: "RR",
    mmr: 64,
    mmrToNext: 36,
    nextRank: "Diamond II",
    rankFloor: 0,
    rankCeil: 100,
    profileLevel: 142,
    levelProgress: 41,
    winStreak: 3,
    session: { active: true, games: 4, netMmr: 51, durationMin: 68 },
    performance: {
      winRate: 57,
      winRateDelta: -2,
      kdaLabel: "K/D/A",
      kda: "1.34",
      primaryStats: [
        { label: "Kills", value: "19.2", delta: 1.4 },
        { label: "Deaths", value: "14.6", delta: -0.8 },
        { label: "Assists", value: "5.1", delta: 0.6 },
      ],
      trend: [10, 28, 19, 41, 33, 52, 47, 64],
    },
  },
}

export type MatchResult = "win" | "loss"

export type Match = {
  id: string
  game: GameId
  result: MatchResult
  mode: string
  score: string
  mmrChange: number
  statLine: string
  agentOrCar: string
  timeAgo: string
}

export const MATCHES: Match[] = [
  {
    id: "m1",
    game: "rocket-league",
    result: "win",
    mode: "Ranked Doubles",
    score: "4 - 2",
    mmrChange: 9,
    statLine: "2 Goals · 1 Assist · 3 Saves",
    agentOrCar: "Octane",
    timeAgo: "4m ago",
  },
  {
    id: "m2",
    game: "valorant",
    result: "win",
    mode: "Competitive · Ascent",
    score: "13 - 9",
    mmrChange: 22,
    statLine: "24 K · 13 D · 6 A",
    agentOrCar: "Jett",
    timeAgo: "31m ago",
  },
  {
    id: "m3",
    game: "rocket-league",
    result: "win",
    mode: "Ranked Doubles",
    score: "3 - 1",
    mmrChange: 8,
    statLine: "1 Goal · 2 Assists · 2 Saves",
    agentOrCar: "Fennec",
    timeAgo: "52m ago",
  },
  {
    id: "m4",
    game: "valorant",
    result: "loss",
    mode: "Competitive · Bind",
    score: "11 - 13",
    mmrChange: -18,
    statLine: "17 K · 16 D · 4 A",
    agentOrCar: "Raze",
    timeAgo: "1h ago",
  },
  {
    id: "m5",
    game: "rocket-league",
    result: "win",
    mode: "Ranked Doubles",
    score: "5 - 3",
    mmrChange: 10,
    statLine: "3 Goals · 1 Assist · 1 Save",
    agentOrCar: "Octane",
    timeAgo: "2h ago",
  },
]

export type Achievement = {
  id: string
  game: GameId
  title: string
  detail: string
  timeAgo: string
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "a1",
    game: "rocket-league",
    title: "5 Win Streak",
    detail: "Your hottest run this week",
    timeAgo: "12m ago",
  },
  {
    id: "a2",
    game: "valorant",
    title: "Clutch Master",
    detail: "Won 3 clutch rounds in one match",
    timeAgo: "33m ago",
  },
  {
    id: "a3",
    game: "rocket-league",
    title: "New Peak MMR",
    detail: "Reached 1248 — season high",
    timeAgo: "2h ago",
  },
]

export type SessionSummary = {
  id: string
  game: GameId
  label: string
  record: string
  net: number
  timeAgo: string
}

export const SESSIONS: SessionSummary[] = [
  {
    id: "s1",
    game: "rocket-league",
    label: "Evening grind",
    record: "5W · 2L",
    net: 38,
    timeAgo: "Live now",
  },
  {
    id: "s2",
    game: "valorant",
    label: "Warmup queue",
    record: "3W · 1L",
    net: 51,
    timeAgo: "Live now",
  },
  {
    id: "s3",
    game: "rocket-league",
    label: "Late night ranked",
    record: "6W · 3L",
    net: 24,
    timeAgo: "Yesterday",
  },
]
