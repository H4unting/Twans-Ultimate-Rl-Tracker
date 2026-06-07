"use client"

import { ClipboardList, History, Play } from "lucide-react"
import type { LucideIcon } from "lucide-react"

const ACTIONS: {
  id: string
  label: string
  desc: string
  icon: LucideIcon
  primary?: boolean
}[] = [
  {
    id: "log",
    label: "Log Match",
    desc: "Add a result",
    icon: ClipboardList,
  },
  {
    id: "session",
    label: "Start Session",
    desc: "Track your grind",
    icon: Play,
    primary: true,
  },
  {
    id: "review",
    label: "Review Games",
    desc: "Find your mistakes",
    icon: History,
  },
]

export function QuickActions() {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {ACTIONS.map((a) => {
        const Icon = a.icon
        return (
          <button
            key={a.id}
            className={
              a.primary
                ? "group flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary p-4 text-left text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)] transition-transform hover:-translate-y-0.5"
                : "group flex items-center gap-3 rounded-2xl border border-border glass p-4 text-left transition-colors hover:border-primary/40"
            }
          >
            <span
              className={
                a.primary
                  ? "flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15"
                  : "flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary transition-colors group-hover:bg-primary/15"
              }
            >
              <Icon className="size-5" />
            </span>
            <span className="leading-tight">
              <span className="block font-heading text-sm font-bold tracking-wide">
                {a.label}
              </span>
              <span
                className={
                  a.primary
                    ? "block text-xs text-primary-foreground/80"
                    : "block text-xs text-muted-foreground"
                }
              >
                {a.desc}
              </span>
            </span>
          </button>
        )
      })}
    </section>
  )
}
