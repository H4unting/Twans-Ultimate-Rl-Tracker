-- Post-audit hardening (idempotent)
-- 1. Drop legacy pre-auth JSON table (app uses matches + user_settings)
-- 2. Revoke anon EXECUTE on SECURITY DEFINER RPCs (authenticated only)

DROP TABLE IF EXISTS public."Tracker";

-- Revoke default PUBLIC execute (Supabase grants RPCs to PUBLIC by default)
REVOKE EXECUTE ON FUNCTION public.can_view_player_stats(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.shares_group_with(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_grind_squad(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.join_grind_squad(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.leave_grind_squad(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_founder_uid() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_view_player_stats(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_group_with(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_grind_squad(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_grind_squad(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_grind_squad(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_founder_uid() TO authenticated;
