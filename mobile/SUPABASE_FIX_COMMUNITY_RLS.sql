-- FIX RLS FOR GROUPS & LISTINGS

-- 1. Policies for GROUPS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Allow users to create groups
DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
CREATE POLICY "Users can create groups" 
ON public.groups FOR INSERT 
WITH CHECK (auth.uid() = created_by);

-- Allow creators to update their groups
DROP POLICY IF EXISTS "Creators can update their groups" ON public.groups;
CREATE POLICY "Creators can update their groups" 
ON public.groups FOR UPDATE 
USING (auth.uid() = created_by);


-- 2. Policies for GROUP_MEMBERS
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Allow users to see who is in a group
DROP POLICY IF EXISTS "Group members are viewable by everyone" ON public.group_members;
CREATE POLICY "Group members are viewable by everyone" 
ON public.group_members FOR SELECT 
USING (true);

-- Allow users to join groups (insert themselves)
DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;
CREATE POLICY "Users can join groups" 
ON public.group_members FOR INSERT 
WITH CHECK (auth.uid() = user_id);


-- 3. Policies for COMMUNITY_LISTINGS
ALTER TABLE public.community_listings ENABLE ROW LEVEL SECURITY;

-- Everyone can view listings
DROP POLICY IF EXISTS "Listings are viewable by everyone" ON public.community_listings;
CREATE POLICY "Listings are viewable by everyone" 
ON public.community_listings FOR SELECT 
USING (true);

-- Authenticated users can create listings
DROP POLICY IF EXISTS "Users can create listings" ON public.community_listings;
CREATE POLICY "Users can create listings" 
ON public.community_listings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Owners can update their listings
DROP POLICY IF EXISTS "Owners can update their listings" ON public.community_listings;
CREATE POLICY "Owners can update their listings" 
ON public.community_listings FOR UPDATE 
USING (auth.uid() = user_id);
