-- 1. Ensure the residence_id column exists on the users table
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS residence_id uuid REFERENCES public.residences(id);

-- 2. Enable RLS on users table if not already enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Create Policy to allow users to see their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" 
ON public.users FOR SELECT 
USING (auth.uid() = id);

-- 4. Create Policy to allow users to update their own residence_id
DROP POLICY IF EXISTS "Users can update their own residence" ON public.users;
CREATE POLICY "Users can update their own residence" 
ON public.users FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 5. Give public read access to residences table if not already there
ALTER TABLE public.residences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Residences are viewable by everyone" ON public.residences;
CREATE POLICY "Residences are viewable by everyone" 
ON public.residences FOR SELECT 
USING (true);
