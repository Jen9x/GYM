-- Personal trainer add-on migration
-- Run this in Supabase SQL Editor for an existing project

ALTER TABLE public.members ADD COLUMN IF NOT EXISTS subscription_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS personal_training_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS personal_training_plan TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS personal_training_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS personal_training_start_date DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS personal_training_end_date DATE;

UPDATE public.members
SET
  subscription_amount = CASE
    WHEN COALESCE(subscription_amount, 0) = 0 AND COALESCE(amount, 0) > 0 THEN amount
    ELSE COALESCE(subscription_amount, 0)
  END,
  personal_training_enabled = COALESCE(personal_training_enabled, FALSE),
  personal_training_amount = COALESCE(personal_training_amount, 0);
