-- Prevent duplicate member names per user
-- Run this in Supabase SQL Editor for an existing project

DO $$
DECLARE
  duplicate_names TEXT;
BEGIN
  SELECT string_agg(format('%s (%s records)', sample_name, duplicate_count), ', ')
    INTO duplicate_names
  FROM (
    SELECT
      MIN(name) AS sample_name,
      COUNT(*) AS duplicate_count
    FROM public.members
    GROUP BY
      user_id,
      lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_names IS NOT NULL THEN
    RAISE EXCEPTION
      'Duplicate member names already exist. Rename or remove these first, then run this migration again: %',
      duplicate_names;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_user_name_unique_normalized
  ON public.members(user_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));
