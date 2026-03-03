-- Add mealType column to mealplans table
ALTER TABLE public.mealplans ADD COLUMN IF NOT EXISTS "mealType" text DEFAULT 'lunch';

-- Ensure it's indexed for performance if queried often
CREATE INDEX IF NOT EXISTS idx_mealplans_mealtype ON public.mealplans ("mealType");
-- Add status and cooked_at columns to mealplans table
ALTER TABLE public.mealplans ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'planned';
ALTER TABLE public.mealplans ADD COLUMN IF NOT EXISTS cooked_at TIMESTAMPTZ;

-- Ensure it's indexed for performance
CREATE INDEX IF NOT EXISTS idx_mealplans_status ON public.mealplans (status);
