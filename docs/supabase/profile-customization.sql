-- Profile colors + signup number (url#1, url#2, …)
-- Run once in Supabase SQL Editor after auth-schema.sql

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

-- New sign-ups get the next url# automatically
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
