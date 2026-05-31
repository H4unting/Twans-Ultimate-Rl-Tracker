-- Twans Ultimate Tracker — Fix RLS infinite recursion (run if dashboard shows "Could not load your data")
-- Safe to re-run

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

-- group_members policy was self-referential → infinite recursion
DROP POLICY IF EXISTS "group_members read shared" ON group_members;
DROP POLICY IF EXISTS "group_members own" ON group_members;

CREATE POLICY "group_members read shared" ON group_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_group_member(group_id, auth.uid())
  );

-- profiles policy queried group_members → hit recursion above
DROP POLICY IF EXISTS "profiles read own or group" ON profiles;
DROP POLICY IF EXISTS "profiles read own" ON profiles;

CREATE POLICY "profiles read own or group" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR public.shares_group_with(auth.uid(), id)
  );

-- groups policy also queried group_members directly
DROP POLICY IF EXISTS "groups member read" ON groups;

CREATE POLICY "groups member read" ON groups
  FOR SELECT USING (public.is_group_member(id, auth.uid()));

GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_group_with(uuid, uuid) TO authenticated;
