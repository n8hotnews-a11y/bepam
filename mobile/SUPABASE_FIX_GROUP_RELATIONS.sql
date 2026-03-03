-- FIX FOREIGN KEY RELATIONSHIPS FOR GROUPS

-- 1. Drop existing constraints if they exist (need to know the name or drop and recreate columns)
-- It's safer to just drop the table and recreate or alter the constraint.
-- Let's try to alter the constraint.

-- For group_members
ALTER TABLE IF EXISTS public.group_members 
DROP CONSTRAINT IF EXISTS group_members_user_id_fkey;

ALTER TABLE IF EXISTS public.group_members
ADD CONSTRAINT group_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- For group_posts
ALTER TABLE IF EXISTS public.group_posts 
DROP CONSTRAINT IF EXISTS group_posts_user_id_fkey;

ALTER TABLE IF EXISTS public.group_posts
ADD CONSTRAINT group_posts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- For group_comments
ALTER TABLE IF EXISTS public.group_comments 
DROP CONSTRAINT IF EXISTS group_comments_user_id_fkey;

ALTER TABLE IF EXISTS public.group_comments
ADD CONSTRAINT group_comments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- For groups (created_by)
ALTER TABLE IF EXISTS public.groups 
DROP CONSTRAINT IF EXISTS groups_created_by_fkey;

ALTER TABLE IF EXISTS public.groups
ADD CONSTRAINT groups_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
