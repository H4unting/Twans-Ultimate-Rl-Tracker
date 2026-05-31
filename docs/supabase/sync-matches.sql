-- Safe match sync requires a unique key for upsert (run once if not already applied)
-- The app uses POST .../matches?on_conflict=user_id,game,match_num with resolution=merge-duplicates

CREATE UNIQUE INDEX IF NOT EXISTS matches_user_game_match_num_key
  ON matches (user_id, game, match_num)
  WHERE user_id IS NOT NULL;
