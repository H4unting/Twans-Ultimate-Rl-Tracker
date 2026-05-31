-- Multi-game support: Rocket League + Valorant on one account
-- Run once in Supabase SQL Editor

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS game text NOT NULL DEFAULT 'rocket_league'
  CHECK (game IN ('rocket_league', 'valorant'));

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS stats jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE matches SET game = 'rocket_league' WHERE game IS NULL;

-- Per-user, per-game match numbering (RL #12 and Val #12 can coexist)
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_player_match_num_key;
DROP INDEX IF EXISTS matches_user_game_match_num_key;

CREATE UNIQUE INDEX IF NOT EXISTS matches_user_game_match_num_key
  ON matches (user_id, game, match_num)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matches_user_game_played
  ON matches (user_id, game, played_at DESC);

-- user_settings.data can store:
--   activeGame: 'rocket_league' | 'valorant'
--   goals: { rocket_league: {...}, valorant: {...} }
--   riotId, riotRegion (for Valorant bridge — optional)
