"use client"

import type { GameProfile } from "@/lib/tracker-data"
import { ChevronRight, Target } from "lucide-react"

type RankProgressProps = {
  profile: GameProfile
}

export function RankProgress({ profile }: RankProgressProps) {
  const span = profile.rankCeil - profile.rankFloor || 1
  const pct = Math.max(
    4,
    Math.min(100, ((profile.mmr - profile.rankFloor) / span) * 100),
  )

  return (
    <section className="rounded-3xl border border-border glass p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-primary" />
          <h2 className="font-heading text-base font-bold tracking-wide">
            Rank Progress
          </h2>
        </div>
        <button className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          History <ChevronRight className="size-3.5" />
        </button>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-end justify-between">
          <div>
            <span className="font-heading text-2xl font-bold text-primary">
              {profile.mmr.toLocaleString()}
            </span>
            <span className="ml-1 text-sm text-muted-foreground">
              {profile.mmrLabel}
            </span>
          </div>
          <div className="text-right text-sm font-medium text-muted-foreground">
            <span className="text-foreground">+{profile.mmrToNext}</span> to{" "}
            {profile.nextRank}
          </div>
        </div>

        {/* Bar */}
        <div className="relative h-4 overflow-hidden rounded-full bg-background/60 ring-1 ring-inset ring-border">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${pct}%`,
              background:
                "linear-gradient(90deg, color-mix(in oklch, var(--primary) 70%, var(--chart-5)), var(--primary))",
              boxShadow: "0 0 16px -2px var(--primary)",
            }}
          />
          {/* shimmer marker */}
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-[0_0_10px_2px_var(--primary)]"
            style={{ left: `${pct}%` }}
          />
        </div>

        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{profile.rank}</span>
          <span>{profile.nextRank}</span>
        </div>
      </div>
    </section>
  )
}
