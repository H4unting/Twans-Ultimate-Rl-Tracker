"use client"

import type { Game, GameProfile } from "@/lib/tracker-data"
import { Flame, Radio, TrendingUp } from "lucide-react"

type HeroProps = {
  game: Game
  profile: GameProfile
}

export function Hero({ game, profile }: HeroProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border glass p-6 md:p-8">
      {/* ambient glow */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full opacity-30 blur-3xl"
        style={{ background: game.accent }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--primary)" }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        {/* Rank block */}
        <div className="flex items-center gap-5 md:gap-7">
          <div className="relative shrink-0">
            <div
              className="absolute inset-0 rounded-2xl opacity-50 blur-xl"
              style={{ background: game.accent }}
              aria-hidden="true"
            />
            <img
              src="/rank-emblem.png"
              alt={`${profile.rank} rank emblem`}
              className="relative size-24 object-contain md:size-32"
            />
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  background: "color-mix(in oklch, var(--accent) 18%, transparent)",
                  color: "var(--accent)",
                }}
              >
                {game.name}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {profile.playlist}
              </span>
            </div>
            <h1 className="font-heading text-4xl font-extrabold leading-none tracking-tight text-balance md:text-6xl">
              {profile.rank}
            </h1>
            <p className="mt-2 text-sm font-medium text-muted-foreground md:text-base">
              {profile.division}
            </p>
          </div>
        </div>

        {/* Live stats */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:w-[440px]">
          <Stat
            label={profile.mmrLabel}
            value={profile.mmr.toLocaleString()}
            hint={`+${profile.mmrToNext} to ${profile.nextRank}`}
            accent="var(--primary)"
          />
          <Stat
            label="Profile Level"
            value={profile.profileLevel.toString()}
            hint={`${profile.levelProgress}% to next`}
            accent="var(--chart-5)"
          />
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Flame className="size-3.5 text-accent" />
              Win Streak
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="font-heading text-3xl font-bold text-accent">
                {profile.winStreak}
              </span>
              <span className="text-sm text-muted-foreground">wins</span>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Radio
                className={
                  profile.session.active
                    ? "size-3.5 text-[var(--success)]"
                    : "size-3.5"
                }
              />
              Session
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="font-heading text-3xl font-bold">
                {profile.session.games}
              </span>
              <span className="flex items-center gap-0.5 text-sm font-medium text-[var(--success)]">
                <TrendingUp className="size-3.5" />+{profile.session.netMmr}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint: string
  accent: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/40 p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1.5 font-heading text-3xl font-bold" style={{ color: accent }}>
        {value}
      </div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{hint}</div>
    </div>
  )
}
