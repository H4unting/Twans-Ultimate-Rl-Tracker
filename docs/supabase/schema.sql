-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  DEPRECATED — DO NOT RUN ON PRODUCTION                                 ║
-- ║  Contains unsafe anon read/write RLS on matches (SEC-H1).                ║
-- ║  Use docs/supabase/v1-full-setup.sql instead.                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Twans Ultimate Tracker — legacy Supabase schema (historical reference only)
-- Run this entire file once in Supabase → SQL Editor.
-- The app auto-detects the matches table and migrates data from Tracker.

-- ── Settings (per-user — replaces legacy app_settings) ───────────────────────
-- Legacy app_settings was removed (P0). Do not recreate it.
-- If upgrading an old database, run docs/supabase/drop-app-settings.sql first.

-- ── Normalized matches (one row per game) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  player text NOT NULL CHECK (player IN ('anthony', 'trystan')),
  match_num int NOT NULL,
  session int NOT NULL DEFAULT 1,
  played_at date NOT NULL,
  mode text NOT NULL,
  result text NOT NULL CHECK (result IN ('W', 'L')),
  goals int DEFAULT 0,
  assists int DEFAULT 0,
  saves int DEFAULT 0,
  start_mmr int DEFAULT 0,
  end_mmr int DEFAULT 0,
  mmr_diff int GENERATED ALWAYS AS (end_mmr - start_mmr) STORED,
  notes text DEFAULT '',
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE (player, match_num)
);

CREATE INDEX IF NOT EXISTS idx_matches_player ON matches (player);
CREATE INDEX IF NOT EXISTS idx_matches_played_at ON matches (played_at);
CREATE INDEX IF NOT EXISTS idx_matches_session ON matches (player, session);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read/write matches" ON matches;
CREATE POLICY "Allow anon read/write matches" ON matches
  FOR ALL USING (true) WITH CHECK (true);

-- ── Optional: manual migration from legacy Tracker JSON ───────────────────────
-- (The app does this automatically on first load if matches is empty.)
--
-- INSERT INTO matches (player, match_num, session, played_at, mode, result,
--   goals, assists, saves, start_mmr, end_mmr, notes, tags)
-- SELECT
--   lower(t."Player"),
--   (g->>'match')::int,
--   (g->>'session')::int,
--   to_date(g->>'date', 'MM/DD/YY'),
--   g->>'mode',
--   g->>'result',
--   COALESCE((g->>'goals')::int, 0),
--   COALESCE((g->>'assists')::int, 0),
--   COALESCE((g->>'saves')::int, 0),
--   COALESCE((g->>'startMMR')::int, 0),
--   COALESCE((g->>'endMMR')::int, 0),
--   COALESCE(g->>'notes', ''),
--   COALESCE(ARRAY(SELECT jsonb_array_elements_text(g->'tags')), '{}')
-- FROM "Tracker" t,
--   jsonb_array_elements(t.games) AS g
-- ON CONFLICT (player, match_num) DO NOTHING;

-- After migration you can keep Tracker as backup or leave it — the app uses
-- matches when that table exists.
