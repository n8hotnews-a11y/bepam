-- Create the food_warnings_read table to sync read status across devices
CREATE TABLE IF NOT EXISTS public.food_warnings_read (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    warning_type TEXT NOT NULL, -- 'expired' or 'expiring_soon'
    read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, inventory_item_id, warning_type)
);

-- Enable Row Level Security
ALTER TABLE public.food_warnings_read ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can view their own warning read status" 
    ON public.food_warnings_read FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own warning read status" 
    ON public.food_warnings_read FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own warning read status" 
    ON public.food_warnings_read FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own warning read status" 
    ON public.food_warnings_read FOR DELETE 
    USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_food_warnings_read_user_id ON public.food_warnings_read (user_id);
CREATE INDEX IF NOT EXISTS idx_food_warnings_read_item_id ON public.food_warnings_read (inventory_item_id);
