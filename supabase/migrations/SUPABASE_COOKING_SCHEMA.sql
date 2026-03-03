-- Create cooking_history table
CREATE TABLE IF NOT EXISTS public.cooking_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    meal_plan_id UUID REFERENCES public.mealplans(id) ON DELETE SET NULL,
    recipe_id TEXT, -- Can be local ID or Spoonacular ID
    recipe_title TEXT NOT NULL,
    cooked_at TIMESTAMPTZ DEFAULT NOW(),
    ingredients_used JSONB, -- Store what was actually used
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.cooking_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own cooking history" 
    ON public.cooking_history FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cooking history" 
    ON public.cooking_history FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cooking history" 
    ON public.cooking_history FOR DELETE 
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cooking_history_user_id ON public.cooking_history (user_id);
CREATE INDEX IF NOT EXISTS idx_cooking_history_recipe_id ON public.cooking_history (recipe_id);
