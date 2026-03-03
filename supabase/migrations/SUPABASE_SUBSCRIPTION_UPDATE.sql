-- 1. Add subscription columns to profiles table
-- Note: 'profiles' is usually a view or table linked to auth.users. 
-- If you are using a separate 'users' table, apply this there.
-- Assuming 'users' table based on previous context, but checking schema it might be 'profiles' in standard Supabase setup.
-- Previous queries referenced "public.users". I will use "public.users" to be safe based on "references users (id)" seen in mealplans schema.

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free', -- 'free', 'monthly', 'yearly'
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT FALSE;

-- 2. Create Payments History Table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'VND',
    provider TEXT DEFAULT 'mock', -- 'momo', 'apple', 'mock'
    status TEXT DEFAULT 'pending', -- 'pending', 'success', 'failed'
    package_type TEXT, -- 'monthly', 'yearly'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS for payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for payments
-- Users can view their own payment history
CREATE POLICY "Users can view their own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert (for mock flow we might need this, or backend function)
CREATE POLICY "Users can insert their own payments" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
