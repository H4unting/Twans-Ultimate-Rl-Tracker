-- Twans Ultimate Tracker — Squads (run AFTER auth-schema.sql)
-- Enables create/join squads, invite codes, coach + duo stat sharing

-- ── RLS helpers (SECURITY DEFINER avoids infinite recursion on group_members) ─
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.shares_group_with(p_viewer uuid, p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_viewer IS NOT NULL AND EXISTS (
    SELECT 1
    FROM group_members me
    JOIN group_members them ON me.group_id = them.group_id
    WHERE me.user_id = p_viewer AND them.user_id = p_profile_id
  );
$$;

-- ── Helper: can viewer see player's match stats? ───────────────────────────────
CREATE OR REPLACE FUNCTION public.can_view_player_stats(viewer uuid, player uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT viewer IS NOT NULL AND (
    viewer = player
    OR EXISTS (
      SELECT 1
      FROM group_members v
      JOIN group_members p ON v.group_id = p.group_id
      WHERE v.user_id = viewer
        AND p.user_id = player
        AND (
          (v.role = 'coach' AND p.role IN ('owner', 'member'))
          OR (v.role IN ('owner', 'member') AND p.role IN ('owner', 'member'))
        )
    )
  );
$$;

-- ── Matches: split ALL policy into scoped read vs own write ───────────────────
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

-- ── Profiles: squad mates can see names/avatars ───────────────────────────────
DROP POLICY IF EXISTS "profiles read own" ON profiles;
DROP POLICY IF EXISTS "profiles read own or group" ON profiles;

CREATE POLICY "profiles read own or group" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR public.shares_group_with(auth.uid(), id)
  );

-- ── Group members: see everyone in your squads ────────────────────────────────
DROP POLICY IF EXISTS "group_members own" ON group_members;
DROP POLICY IF EXISTS "group_members read shared" ON group_members;

CREATE POLICY "group_members read shared" ON group_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_group_member(group_id, auth.uid())
  );

DROP POLICY IF EXISTS "groups member read" ON groups;
CREATE POLICY "groups member read" ON groups
  FOR SELECT USING (public.is_group_member(id, auth.uid()));

-- ── RPC: create squad ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_grind_squad(squad_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_group groups%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF squad_name IS NULL OR length(trim(squad_name)) < 2 THEN
    RAISE EXCEPTION 'Squad name must be at least 2 characters';
  END IF;

  INSERT INTO groups (name, invite_code, created_by)
  VALUES (
    trim(squad_name),
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    uid
  )
  RETURNING * INTO new_group;

  INSERT INTO group_members (group_id, user_id, role)
  VALUES (new_group.id, uid, 'owner');

  RETURN json_build_object(
    'id', new_group.id,
    'name', new_group.name,
    'invite_code', new_group.invite_code,
    'role', 'owner'
  );
END;
$$;

-- ── RPC: join squad by invite code ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_grind_squad(p_invite_code text, p_role text DEFAULT 'member')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  g groups%ROWTYPE;
  normalized text := upper(trim(p_invite_code));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF normalized IS NULL OR length(normalized) < 4 THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  IF p_role NOT IN ('member', 'coach') THEN
    RAISE EXCEPTION 'Role must be member or coach';
  END IF;

  SELECT * INTO g FROM groups WHERE invite_code = normalized;
  IF g.id IS NULL THEN RAISE EXCEPTION 'Invite code not found'; END IF;

  IF EXISTS (SELECT 1 FROM group_members WHERE group_id = g.id AND user_id = uid) THEN
    RAISE EXCEPTION 'You are already in this squad';
  END IF;

  INSERT INTO group_members (group_id, user_id, role)
  VALUES (g.id, uid, p_role);

  RETURN json_build_object(
    'id', g.id,
    'name', g.name,
    'invite_code', g.invite_code,
    'role', p_role
  );
END;
$$;

-- ── RPC: leave squad ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.leave_grind_squad(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  my_role text;
  next_owner uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT role INTO my_role
  FROM group_members
  WHERE group_id = p_group_id AND user_id = uid;

  IF my_role IS NULL THEN RAISE EXCEPTION 'Not a member of this squad'; END IF;

  DELETE FROM group_members WHERE group_id = p_group_id AND user_id = uid;

  IF my_role = 'owner' THEN
    SELECT user_id INTO next_owner
    FROM group_members
    WHERE group_id = p_group_id
    ORDER BY joined_at ASC
    LIMIT 1;

    IF next_owner IS NOT NULL THEN
      UPDATE group_members SET role = 'owner'
      WHERE group_id = p_group_id AND user_id = next_owner;
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM group_members WHERE group_id = p_group_id) THEN
    DELETE FROM groups WHERE id = p_group_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_group_with(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_grind_squad(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_grind_squad(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_grind_squad(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_player_stats(uuid, uuid) TO authenticated;
