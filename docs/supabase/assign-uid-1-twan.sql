-- Give twan (anthonyinf354332@gmail.com) UID 1 — run once in Supabase SQL Editor
-- Requires profile-customization.sql (profile_number column + sequence)

DO $$
DECLARE
  twan_id uuid;
BEGIN
  SELECT id INTO twan_id FROM auth.users WHERE email = 'anthonyinf354332@gmail.com' LIMIT 1;
  IF twan_id IS NULL THEN
    RAISE EXCEPTION 'User anthonyinf354332@gmail.com not found — sign in once first';
  END IF;

  UPDATE profiles SET profile_number = NULL WHERE profile_number = 1 AND id <> twan_id;
  UPDATE profiles SET profile_number = 1 WHERE id = twan_id;

  PERFORM setval(
    'profiles_profile_number_seq',
    GREATEST(COALESCE((SELECT MAX(profile_number) FROM profiles), 0), 1),
    true
  );
END $$;
