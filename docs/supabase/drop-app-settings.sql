-- P0 SECURITY — Remove legacy app_settings (world-writable via anon RLS)
--
-- Background:
--   Pre-auth app stored goals in public.app_settings with USING (true).
--   Current app uses user_settings (per-user, auth.uid() RLS) — see js/supabase.js.
--   No application code references app_settings.
--
-- Run in Supabase Dashboard → SQL Editor (production project).
-- Safe to re-run (idempotent).

-- ── 1. Verify table exists (inspect result in output) ───────────────────────
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'app_settings'
) AS app_settings_exists;

-- ── 2. Inspect policies before drop (optional audit trail) ───────────────────
SELECT polname, polcmd, polroles::regrole[], pg_get_expr(polqual, polrelid) AS using_expr
FROM pg_policy
JOIN pg_class ON pg_class.oid = pg_policy.polrelid
WHERE relname = 'app_settings';

-- ── 3. Drop open policy and table ───────────────────────────────────────────
DROP POLICY IF EXISTS "Allow anon read/write app_settings" ON public.app_settings;

DROP TABLE IF EXISTS public.app_settings;

-- ── 4. Confirm removal ──────────────────────────────────────────────────────
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'app_settings'
) AS app_settings_still_exists;
-- Expected: app_settings_still_exists = false

-- ── 5. Confirm user_settings RLS (replacement table) ───────────────────────
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS with_check_expr
FROM pg_policy
JOIN pg_class ON pg_class.oid = pg_policy.polrelid
WHERE relname = 'user_settings';
