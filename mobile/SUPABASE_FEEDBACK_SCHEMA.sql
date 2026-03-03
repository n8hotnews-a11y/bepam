-- Create feedbacks table
CREATE TABLE IF NOT EXISTS public.feedbacks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'suggestion', -- 'suggestion', 'bug', 'other'
    status TEXT DEFAULT 'new', -- 'new', 'read', 'resolved'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert their own feedbacks" 
    ON public.feedbacks FOR INSERT 
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Only admins/service role handles viewing usually, but let's allow users to see their own
CREATE POLICY "Users can view their own feedbacks" 
    ON public.feedbacks FOR SELECT 
    USING (auth.uid() = user_id);
