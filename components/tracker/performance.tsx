"use client"

import type { GameProfile } from "@/lib/tracker-data"
import { ArrowDownRight, ArrowUpRight, Activity } from "lucide-react"
import { Sparkline } from "./sparkline"

type PerformanceProps = {
  profile: GameProfile
  accent: string
}

export function Performance({ profile, accent }: PerformanceProps) {
  const p = profile.performance
  return (
    <section className="rounded-3xl border border-border glass p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <h2 className="font-heading text-base font-bold tracking-wide">
            Performance
          </h2>
        </div>
        <span className="text-xs font-medium text-muted-foreground">Last 20 games</span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Win rate */}
        <div className="rounded-2xl border border-border bg-background/40 p-4">
          <p className="text-xs font-medium text-muted-foreground">Win Rate</p>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-heading text-3xl font-bold">{p.winRate}%</span>
          </div>
          <Delta value={p.winRateDelta} suffix="%" />
        </div>

        {/* KDA */}
        <div className="rounded-2xl border border-border bg-background/40 p-4">
          <p className="text-xs font-medium text-muted-foreground">{p.kdaLabel}</p>
          <div className="mt-1 font-heading text-3xl font-bold">{p.kda}</div>
          <p className="mt-2 text-xs text-muted-foreground">Per match avg</p>
        </div>

        {/* Trend chart spanning 2 cols */}
        <div className="col-span-2 rounded-2xl border border-border bg-background/40 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Recent Trend
            </p>
            <span className="text-xs font-medium text-[var(--success)]">Climbing</span>
          </div>
          <Sparkline data={p.trend} color={accent} className="mt-2 h-14 w-full" />
        </div>
      </div>

      {/* Detailed stat line */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {p.primaryStats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-background/40 p-3 text-center"
          >
            <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            <p className="mt-1 font-heading text-xl font-bold">{s.value}</p>
            <div className="mt-0.5 flex justify-center">
              <Delta value={s.delta} compact />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Delta({
  value,
  suffix = "",
  compact = false,
}: {
  value: number
  suffix?: string
  compact?: boolean
}) {
  const up = value >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={
        compact
          ? "inline-flex items-center gap-0.5 text-xs font-medium"
          : "mt-2 inline-flex items-center gap-1 text-xs font-medium"
      }
      style={{ color: up ? "var(--success)" : "var(--destructive)" }}
    >
      <Icon className="size-3" />
      {up ? "+" : ""}
      {value}
      {suffix}
    </span>
  )
}
