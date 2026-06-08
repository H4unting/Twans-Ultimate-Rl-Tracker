-- Twans Ultimate Tracker — Auth + personal accounts (run AFTER schema.sql)
-- Also enable Google provider in Supabase Dashboard → Authentication → Providers

-- ── Profiles (one per Google account) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  accent_color text DEFAULT '#e65c00',
  legacy_claimed text CHECK (legacy_claimed IN ('anthony', 'trystan') OR legacy_claimed IS NULL),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles read own" ON profiles;
DROP POLICY IF EXISTS "profiles update own" ON profiles;
DROP POLICY IF EXISTS "profiles insert own" ON profiles;
CREATE POLICY "profiles read own" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles update own" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles insert own" ON profiles FOR INSERT WITH CHECK (id = auth.uid());

-- Auto-create profile on Google sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Personal settings (goals per user) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_settings own" ON user_settings;
CREATE POLICY "user_settings own" ON user_settings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── Link matches to users ───────────────────────────────────────────────────────
ALTER TABLE matches ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id);
ALTER TABLE matches ALTER COLUMN player DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matches_user_id ON matches (user_id);

DROP POLICY IF EXISTS "Allow anon read/write matches" ON matches;
DROP POLICY IF EXISTS "matches own" ON matches;
CREATE POLICY "matches own" ON matches
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── Groups (Phase 2 — duo / coach squads) ─────────────────────────────────────
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

DROP POLICY IF EXISTS "groups member read" ON groups;
DROP POLICY IF EXISTS "group_members own" ON group_members;
CREATE POLICY "groups member read" ON groups FOR SELECT
  USING (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = id AND gm.user_id = auth.uid()));
CREATE POLICY "group_members own" ON group_members FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid()
  ));
