-- Self-service account deletion (run once in Supabase SQL Editor)
-- Enables Profile → Delete account in the app.

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  gid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Leave every squad (transfers ownership / removes empty groups)
  FOR gid IN SELECT group_id FROM group_members WHERE user_id = uid LOOP
    PERFORM public.leave_grind_squad(gid);
  END LOOP;

  DELETE FROM matches WHERE user_id = uid;
  DELETE FROM user_settings WHERE user_id = uid;

  -- created_by is not cleared by leave_grind_squad
  UPDATE groups SET created_by = NULL WHERE created_by = uid;

  DELETE FROM profiles WHERE id = uid;

  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
