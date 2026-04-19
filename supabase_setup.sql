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
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  payment_status TEXT NOT NULL DEFAULT 'paid',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- 3. Enable Row Level Security
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for members (only authenticated user can access their own data)
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

-- 5. RLS Policies for payments
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

-- 6. Create indexes for performance
CREATE INDEX idx_members_user_id ON public.members(user_id);
CREATE INDEX idx_members_status ON public.members(status);
CREATE INDEX idx_members_end_date ON public.members(end_date);
CREATE INDEX idx_payments_member_id ON public.payments(member_id);
CREATE INDEX idx_payments_payment_date ON public.payments(payment_date);

-- 7. Auto-update updated_at timestamp
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
