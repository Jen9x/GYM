-- =============================================
-- Black Bull's Advance Gym - Database Setup
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Create members table
CREATE TABLE public.members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  plan TEXT NOT NULL DEFAULT '1 Month',
  amount INTEGER NOT NULL DEFAULT 0,
  subscription_amount INTEGER NOT NULL DEFAULT 0,
  personal_training_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  personal_training_plan TEXT,
  personal_training_amount INTEGER NOT NULL DEFAULT 0,
  personal_training_start_date DATE,
  personal_training_end_date DATE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  payment_status TEXT NOT NULL DEFAULT 'paid',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Existing projects: run this migration block if your members table is already created
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

-- 2. Create payments table
CREATE TABLE public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create shared app settings table
CREATE TABLE public.app_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, setting_key)
);

-- 4. Enable Row Level Security
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for members (only authenticated user can access their own data)
CREATE POLICY "Users can view their own members"
  ON public.members FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own members"
  ON public.members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own members"
  ON public.members FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own members"
  ON public.members FOR DELETE
  USING (auth.uid() = user_id);

-- 6. RLS Policies for payments
CREATE POLICY "Users can view their own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payments"
  ON public.payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payments"
  ON public.payments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payments"
  ON public.payments FOR DELETE
  USING (auth.uid() = user_id);

-- 7. RLS Policies for app settings
CREATE POLICY "Users can view their own app settings"
  ON public.app_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own app settings"
  ON public.app_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own app settings"
  ON public.app_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own app settings"
  ON public.app_settings FOR DELETE
  USING (auth.uid() = user_id);

-- 8. Create indexes for performance
CREATE INDEX idx_members_user_id ON public.members(user_id);
CREATE INDEX idx_members_status ON public.members(status);
CREATE INDEX idx_members_end_date ON public.members(end_date);
CREATE INDEX idx_payments_member_id ON public.payments(member_id);
CREATE INDEX idx_payments_payment_date ON public.payments(payment_date);
CREATE INDEX idx_app_settings_user_key ON public.app_settings(user_id, setting_key);

-- 9. Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
