"use client"

import { GAMES, type GameId } from "@/lib/tracker-data"
import { cn } from "@/lib/utils"
import { Bell, ChevronDown, Search } from "lucide-react"

type TopbarProps = {
  active: GameId
  onChange: (id: GameId) => void
}

export function Topbar({ active, onChange }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 md:px-8">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_20px_-4px_var(--primary)]">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
              <path
                d="M12 2l2.6 6.3L21 9l-5 4.2L17.4 20 12 16.4 6.6 20 8 13.2 3 9l6.4-.7z"
                fill="currentColor"
              />
            </svg>
          </div>
          <div className="leading-tight">
            <p className="font-heading text-sm font-bold tracking-wide">
              TWANS<span className="text-primary"> ULTIMATE</span>
            </p>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Tracker
            </p>
          </div>
        </div>

        {/* Game switch */}
        <div className="ml-2 hidden items-center gap-1 rounded-full border border-border bg-secondary/40 p-1 sm:flex">
          {GAMES.map((g) => (
            <button
              key={g.id}
              onClick={() => onChange(g.id)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                active === g.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full"
                  style={{ background: g.accent }}
                  aria-hidden="true"
                />
                {g.name}
              </span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            className="hidden items-center gap-2 rounded-full border border-border bg-secondary/40 px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground md:flex"
            aria-label="Search"
          >
            <Search className="size-4" />
            <span className="hidden lg:inline">Search players…</span>
          </button>
          <button
            className="relative flex size-9 items-center justify-center rounded-full border border-border bg-secondary/40 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="size-4" />
            <span className="absolute right-2 top-2 size-1.5 rounded-full bg-accent" />
          </button>
          <button className="flex items-center gap-2 rounded-full border border-border bg-secondary/40 py-1 pl-1 pr-2.5 transition-colors hover:bg-secondary">
            <img
              src="/avatar-gamer.png"
              alt="Your profile"
              className="size-7 rounded-full object-cover"
            />
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Mobile game switch */}
      <div className="flex items-center gap-1 border-t border-border/60 px-4 py-2 sm:hidden">
        {GAMES.map((g) => (
          <button
            key={g.id}
            onClick={() => onChange(g.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active === g.id
                ? "bg-secondary text-foreground"
                : "text-muted-foreground",
            )}
          >
            <span className="size-2 rounded-full" style={{ background: g.accent }} />
            {g.name}
          </button>
        ))}
      </div>
    </header>
  )
}
