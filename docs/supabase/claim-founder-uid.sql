-- Founder UID: twan (anthonyinf354332@gmail.com) gets UID 1
-- Run once in Supabase SQL Editor (after profile-customization.sql)

CREATE OR REPLACE FUNCTION public.claim_founder_uid()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned bigint;
  user_email text;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  IF lower(user_email) IS DISTINCT FROM 'anthonyinf354332@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE profiles SET profile_number = NULL WHERE profile_number = 1 AND id <> auth.uid();
  UPDATE profiles SET profile_number = 1 WHERE id = auth.uid()
    RETURNING profile_number INTO assigned;

  PERFORM setval(
    'profiles_profile_number_seq',
    GREATEST(COALESCE((SELECT MAX(profile_number) FROM profiles), 0), 1),
    true
  );

  RETURN assigned;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_founder_uid() TO authenticated;

-- One-shot fix (same as assign-uid-1-twan.sql)
DO $$
DECLARE
  twan_id uuid;
BEGIN
  SELECT id INTO twan_id FROM auth.users WHERE lower(email) = 'anthonyinf354332@gmail.com' LIMIT 1;
  IF twan_id IS NULL THEN RETURN; END IF;
  UPDATE profiles SET profile_number = NULL WHERE profile_number = 1 AND id <> twan_id;
  UPDATE profiles SET profile_number = 1 WHERE id = twan_id;
  PERFORM setval(
    'profiles_profile_number_seq',
    GREATEST(COALESCE((SELECT MAX(profile_number) FROM profiles), 0), 1),
    true
  );
END $$;
