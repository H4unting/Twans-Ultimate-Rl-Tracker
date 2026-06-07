"use client"

import { GAMES, PROFILES, type GameId } from "@/lib/tracker-data"
import { useState } from "react"
import { ActivityFeed } from "./activity-feed"
import { Hero } from "./hero"
import { Performance } from "./performance"
import { QuickActions } from "./quick-actions"
import { RankProgress } from "./rank-progress"
import { Topbar } from "./topbar"

export function Dashboard() {
  const [active, setActive] = useState<GameId>("rocket-league")
  const game = GAMES.find((g) => g.id === active)!
  const profile = PROFILES[active]

  return (
    <div className="min-h-screen">
      <Topbar active={active} onChange={setActive} />

      <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
        <Hero game={game} profile={profile} />

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left / main column */}
          <div className="space-y-6 lg:col-span-2">
            <RankProgress profile={profile} />
            <QuickActions />
            <Performance profile={profile} accent={game.accent} />
          </div>

          {/* Right column — activity */}
          <div className="lg:col-span-1">
            <ActivityFeed />
          </div>
        </div>
      </main>
    </div>
  )
}
