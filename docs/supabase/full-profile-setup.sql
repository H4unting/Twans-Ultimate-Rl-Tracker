-- One-time profile setup for Twans tracker
-- Run the whole file once in Supabase SQL Editor (after auth-schema.sql)

-- Colors + UID sequence
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#e65c00';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#4a2060';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_number bigint;

CREATE SEQUENCE IF NOT EXISTS profiles_profile_number_seq START 1;

UPDATE profiles
SET profile_number = nextval('profiles_profile_number_seq')
WHERE profile_number IS NULL;

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

-- Avatar uploads bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars upload own" ON storage.objects;
CREATE POLICY "avatars upload own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars update own" ON storage.objects;
CREATE POLICY "avatars update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars delete own" ON storage.objects;
CREATE POLICY "avatars delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Founder UID 1 + auto-claim on sign-in
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
