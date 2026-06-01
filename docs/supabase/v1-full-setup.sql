-- Twans Ultimate Tracker — V1 full database setup
-- Safe to re-run (idempotent). Run ONCE in Supabase → SQL Editor on a new project.
--
-- Replaces running these files individually:
--   schema.sql, auth-schema.sql, multi-game.sql, groups-schema.sql,
--   profile-customization.sql, avatar-storage.sql, sync-matches.sql
--
-- Optional (founder-only): claim-founder-uid.sql — see bottom comment block.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Legacy app_settings (unused by current app; kept for compatibility)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS app_settings (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read/write app_settings" ON app_settings;
CREATE POLICY "Allow anon read/write app_settings" ON app_settings
  FOR ALL USING (true) WITH CHECK (true);

INSERT INTO app_settings (data)
SELECT '{"goals":{}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM app_settings);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Matches (normalized — one row per game)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS matches (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  player text CHECK (player IN ('anthony', 'trystan') OR player IS NULL),
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
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matches_player ON matches (player);
CREATE INDEX IF NOT EXISTS idx_matches_played_at ON matches (played_at);
CREATE INDEX IF NOT EXISTS idx_matches_session ON matches (player, session);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Auth profiles + user_settings
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  accent_color text DEFAULT '#e65c00',
  primary_color text DEFAULT '#e65c00',
  secondary_color text DEFAULT '#4a2060',
  profile_number bigint,
  legacy_claimed text CHECK (legacy_claimed IN ('anthony', 'trystan') OR legacy_claimed IS NULL),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_settings own" ON user_settings;
CREATE POLICY "user_settings own" ON user_settings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Profile UID sequence
CREATE SEQUENCE IF NOT EXISTS profiles_profile_number_seq START 1;
UPDATE profiles SET profile_number = nextval('profiles_profile_number_seq') WHERE profile_number IS NULL;
SELECT setval(
  'profiles_profile_number_seq',
  COALESCE((SELECT MAX(profile_number) FROM profiles), 0) + 1,
  false
);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_profile_number_key ON profiles (profile_number);
ALTER TABLE profiles ALTER COLUMN profile_number SET DEFAULT nextval('profiles_profile_number_seq');

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (
    id, display_name, avatar_url, profile_number, primary_color, secondary_color, accent_color
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    nextval('profiles_profile_number_seq'),
    '#e65c00',
    '#4a2060',
    '#e65c00'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Link matches to users
ALTER TABLE matches ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id);
ALTER TABLE matches ALTER COLUMN player DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matches_user_id ON matches (user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Multi-game columns (RL + Valorant)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS game text NOT NULL DEFAULT 'rocket_league'
  CHECK (game IN ('rocket_league', 'valorant'));

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS stats jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE matches SET game = 'rocket_league' WHERE game IS NULL;

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_player_match_num_key;
DROP INDEX IF EXISTS matches_user_game_match_num_key;

CREATE UNIQUE INDEX IF NOT EXISTS matches_user_game_match_num_key
  ON matches (user_id, game, match_num)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matches_user_game_played
  ON matches (user_id, game, played_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Squads (groups) + RLS helpers (no recursion)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 8),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member', 'coach')),
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM group_members WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.shares_group_with(p_viewer uuid, p_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_viewer IS NOT NULL AND EXISTS (
    SELECT 1 FROM group_members me
    JOIN group_members them ON me.group_id = them.group_id
    WHERE me.user_id = p_viewer AND them.user_id = p_profile_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_player_stats(viewer uuid, player uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT viewer IS NOT NULL AND (
    viewer = player
    OR EXISTS (
      SELECT 1 FROM group_members v
      JOIN group_members p ON v.group_id = p.group_id
      WHERE v.user_id = viewer AND p.user_id = player
        AND (
          (v.role = 'coach' AND p.role IN ('owner', 'member'))
          OR (v.role IN ('owner', 'member') AND p.role IN ('owner', 'member'))
        )
    )
  );
$$;

DROP POLICY IF EXISTS "Allow anon read/write matches" ON matches;
DROP POLICY IF EXISTS "matches own" ON matches;
DROP POLICY IF EXISTS "matches select own or group" ON matches;
DROP POLICY IF EXISTS "matches insert own" ON matches;
DROP POLICY IF EXISTS "matches update own" ON matches;
DROP POLICY IF EXISTS "matches delete own" ON matches;

CREATE POLICY "matches select own or group" ON matches
  FOR SELECT USING (public.can_view_player_stats(auth.uid(), user_id));
CREATE POLICY "matches insert own" ON matches
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "matches update own" ON matches
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "matches delete own" ON matches
  FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "profiles read own" ON profiles;
DROP POLICY IF EXISTS "profiles read own or group" ON profiles;
DROP POLICY IF EXISTS "profiles update own" ON profiles;
DROP POLICY IF EXISTS "profiles insert own" ON profiles;

CREATE POLICY "profiles read own or group" ON profiles
  FOR SELECT USING (id = auth.uid() OR public.shares_group_with(auth.uid(), id));
CREATE POLICY "profiles update own" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles insert own" ON profiles FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "group_members own" ON group_members;
DROP POLICY IF EXISTS "group_members read shared" ON group_members;
CREATE POLICY "group_members read shared" ON group_members
  FOR SELECT USING (user_id = auth.uid() OR public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "groups member read" ON groups;
CREATE POLICY "groups member read" ON groups
  FOR SELECT USING (public.is_group_member(id, auth.uid()));

-- Squad RPCs
CREATE OR REPLACE FUNCTION public.create_grind_squad(squad_name text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); new_group groups%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF squad_name IS NULL OR length(trim(squad_name)) < 2 THEN
    RAISE EXCEPTION 'Squad name must be at least 2 characters';
  END IF;
  INSERT INTO groups (name, invite_code, created_by)
  VALUES (trim(squad_name), upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), uid)
  RETURNING * INTO new_group;
  INSERT INTO group_members (group_id, user_id, role) VALUES (new_group.id, uid, 'owner');
  RETURN json_build_object('id', new_group.id, 'name', new_group.name, 'invite_code', new_group.invite_code, 'role', 'owner');
END;
$$;

CREATE OR REPLACE FUNCTION public.join_grind_squad(p_invite_code text, p_role text DEFAULT 'member')
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); g groups%ROWTYPE; normalized text := upper(trim(p_invite_code));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF normalized IS NULL OR length(normalized) < 4 THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  IF p_role NOT IN ('member', 'coach') THEN RAISE EXCEPTION 'Role must be member or coach'; END IF;
  SELECT * INTO g FROM groups WHERE invite_code = normalized;
  IF g.id IS NULL THEN RAISE EXCEPTION 'Invite code not found'; END IF;
  IF EXISTS (SELECT 1 FROM group_members WHERE group_id = g.id AND user_id = uid) THEN
    RAISE EXCEPTION 'You are already in this squad';
  END IF;
  INSERT INTO group_members (group_id, user_id, role) VALUES (g.id, uid, p_role);
  RETURN json_build_object('id', g.id, 'name', g.name, 'invite_code', g.invite_code, 'role', p_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_grind_squad(p_group_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); my_role text; next_owner uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT role INTO my_role FROM group_members WHERE group_id = p_group_id AND user_id = uid;
  IF my_role IS NULL THEN RAISE EXCEPTION 'Not a member of this squad'; END IF;
  DELETE FROM group_members WHERE group_id = p_group_id AND user_id = uid;
  IF my_role = 'owner' THEN
    SELECT user_id INTO next_owner FROM group_members WHERE group_id = p_group_id ORDER BY joined_at ASC LIMIT 1;
    IF next_owner IS NOT NULL THEN
      UPDATE group_members SET role = 'owner' WHERE group_id = p_group_id AND user_id = next_owner;
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM group_members WHERE group_id = p_group_id) THEN
    DELETE FROM groups WHERE id = p_group_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_group_with(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_player_stats(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_grind_squad(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_grind_squad(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_grind_squad(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. Avatar storage bucket
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars upload own" ON storage.objects;
CREATE POLICY "avatars upload own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars update own" ON storage.objects;
CREATE POLICY "avatars update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars delete own" ON storage.objects;
CREATE POLICY "avatars delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Done. Enable Google + Email in Supabase Auth → Providers.
-- Add your site URL to Auth → URL Configuration → Redirect URLs.
--
-- Optional founder UID: run docs/supabase/claim-founder-uid.sql separately.
