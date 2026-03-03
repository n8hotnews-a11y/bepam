-- Create favorite_recipes table
CREATE TABLE IF NOT EXISTS public.favorite_recipes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipe_id TEXT NOT NULL, -- Can be local ID or Spoonacular ID
    recipe_title TEXT NOT NULL,
    recipe_image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, recipe_id)
);

-- Enable RLS
ALTER TABLE public.favorite_recipes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own favorites" 
    ON public.favorite_recipes FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites" 
    ON public.favorite_recipes FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites" 
    ON public.favorite_recipes FOR DELETE 
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_favorite_recipes_user_id ON public.favorite_recipes (user_id);
