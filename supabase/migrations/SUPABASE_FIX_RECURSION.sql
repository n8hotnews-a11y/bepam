-- FIX FOR INFINITE RECURSION IN HOUSEHOLD POLICIES
-- Run this in Supabase SQL Editor

-- 1. Create a security definer function to check membership without triggering RLS
create or replace function public.check_is_household_member(h_id uuid)
returns boolean
language sql security definer
set search_path = public
as $$
  select exists (
    select 1 from household_members
    where household_id = h_id
    and user_id = auth.uid()
  );
$$;

-- 2. Update 'households' policies
drop policy if exists "Users can view their own households" on households;
create policy "Users can view their own households"
  on households for select
  using (check_is_household_member(id));

drop policy if exists "Admins can update their households" on households;
create policy "Admins can update their households"
  on households for update
  using (
    exists (
      select 1 from household_members 
      where household_id = id 
      and user_id = auth.uid() 
      and role = 'admin'
    )
  );

-- 3. Update 'household_members' policies
drop policy if exists "Users can view household memberships" on household_members;
drop policy if exists "Users can view members of their household" on household_members;

create policy "Users can view members of their household"
  on household_members for select
  using (check_is_household_member(household_id));

-- Fix potential recursion in delete policy as well
drop policy if exists "Admins can remove members" on household_members;
create policy "Admins can remove members"
  on household_members for delete
  using (
    exists (
      select 1 from household_members 
      where household_id = household_members.household_id 
      and user_id = auth.uid() 
      and role = 'admin'
    )
  );
