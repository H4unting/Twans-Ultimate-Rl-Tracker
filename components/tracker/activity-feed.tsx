"use client"

import {
  ACHIEVEMENTS,
  GAMES,
  MATCHES,
  SESSIONS,
  type GameId,
} from "@/lib/tracker-data"
import { cn } from "@/lib/utils"
import { Award, Clock, Swords, Trophy } from "lucide-react"
import { useState } from "react"

type Tab = "matches" | "achievements" | "sessions"

const TABS: { id: Tab; label: string }[] = [
  { id: "matches", label: "Matches" },
  { id: "achievements", label: "Achievements" },
  { id: "sessions", label: "Sessions" },
]

function gameDot(game: GameId) {
  const g = GAMES.find((x) => x.id === game)
  return g?.accent ?? "var(--primary)"
}

export function ActivityFeed() {
  const [tab, setTab] = useState<Tab>("matches")

  return (
    <section className="flex h-full flex-col rounded-3xl border border-border glass p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-base font-bold tracking-wide">
          Activity
        </h2>
        <div className="flex items-center gap-1 rounded-full border border-border bg-background/50 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                tab === t.id
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-2.5 overflow-y-auto pr-1">
        {tab === "matches" &&
          MATCHES.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-background/40 p-3 transition-colors hover:border-primary/30"
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl",
                  m.result === "win"
                    ? "bg-[color-mix(in_oklch,var(--success)_18%,transparent)] text-[var(--success)]"
                    : "bg-[color-mix(in_oklch,var(--destructive)_18%,transparent)] text-[var(--destructive)]",
                )}
              >
                <Swords className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: gameDot(m.game) }}
                  />
                  <p className="truncate text-sm font-semibold">{m.mode}</p>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {m.agentOrCar} · {m.statLine}
                </p>
              </div>
              <div className="text-right">
                <p className="font-heading text-sm font-bold">{m.score}</p>
                <p
                  className="text-xs font-medium"
                  style={{
                    color:
                      m.mmrChange >= 0 ? "var(--success)" : "var(--destructive)",
                  }}
                >
                  {m.mmrChange >= 0 ? "+" : ""}
                  {m.mmrChange}
                </p>
              </div>
            </div>
          ))}

        {tab === "achievements" &&
          ACHIEVEMENTS.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-background/40 p-3"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--accent)_18%,transparent)] text-accent">
                <Trophy className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{a.title}</p>
                <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
              </div>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {a.timeAgo}
              </span>
            </div>
          ))}

        {tab === "sessions" &&
          SESSIONS.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-background/40 p-3"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                <Award className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: gameDot(s.game) }}
                  />
                  <p className="truncate text-sm font-semibold">{s.label}</p>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {s.record} · {s.timeAgo}
                </p>
              </div>
              <p
                className="font-heading text-sm font-bold"
                style={{ color: s.net >= 0 ? "var(--success)" : "var(--destructive)" }}
              >
                {s.net >= 0 ? "+" : ""}
                {s.net}
              </p>
            </div>
          ))}
      </div>
    </section>
  )
}
