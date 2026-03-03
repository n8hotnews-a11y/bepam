-- Enable RLS
ALTER TABLE public.mealplans ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own meal plans
CREATE POLICY "Users can view their own meal plans" ON public.mealplans
  FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own meal plans
CREATE POLICY "Users can insert their own meal plans" ON public.mealplans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own meal plans
CREATE POLICY "Users can delete their own meal plans" ON public.mealplans
  FOR DELETE USING (auth.uid() = user_id);

-- Optional: Allow update if needed later
CREATE POLICY "Users can update their own meal plans" ON public.mealplans
  FOR UPDATE USING (auth.uid() = user_id);
