-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 1. Create 'households' table
create table if not exists households (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  created_by uuid references auth.users(id) not null,
  invite_code text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create 'household_members' table
create table if not exists household_members (
  id uuid default uuid_generate_v4() primary key,
  household_id uuid references households(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  role text check (role in ('admin', 'member')) default 'member',
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(household_id, user_id)
);

-- 3. Add 'household_id' to existing tables (Optional migration for existing data)
-- We strictly don't enforce foreign key immediately if we want to allow NULL (personal usage)
alter table shoppinglist add column if not exists household_id uuid references households(id) on delete set null;
alter table inventories add column if not exists household_id uuid references households(id) on delete set null;
alter table mealplans add column if not exists household_id uuid references households(id) on delete set null;

-- 4. Enable Row Level Security (RLS)
alter table households enable row level security;
alter table household_members enable row level security;

-- 5. RLS Policies

-- Clear existing policies to avoid conflicts
drop policy if exists "Users can view their own households" on households;
drop policy if exists "Users can create households" on households;
drop policy if exists "Admins can update their households" on households;
drop policy if exists "Users can view household memberships" on household_members;
drop policy if exists "Users can view members of their household" on household_members;
drop policy if exists "Users can join households (insert themselves)" on household_members;
drop policy if exists "Admins can remove members" on household_members;

-- Policies for households
create policy "Users can view their own households"
  on households for select
  using (
    exists (
      select 1 from household_members 
      where household_id = households.id and user_id = auth.uid()
    )
  );

create policy "Users can create households"
  on households for insert
  with check (auth.uid() = created_by);

create policy "Admins can update their households"
  on households for update
  using (
    exists (
      select 1 from household_members 
      where household_id = households.id and user_id = auth.uid() and role = 'admin'
    )
  );

-- Policies for household_members
create policy "Users can view household memberships"
  on household_members for select
  to authenticated
  using (true);

create policy "Users can join households (insert themselves)"
  on household_members for insert
  with check (auth.uid() = user_id);

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


-- 6. Helper Function to generate invite code
create or replace function generate_invite_code()
returns text
language plpgsql
as $$
declare
  chars text[] := '{A,B,C,D,E,F,G,H,J,K,L,M,N,P,Q,R,S,T,U,V,W,X,Y,Z,2,3,4,5,6,7,8,9}';
  result text := '';
  i integer := 0;
begin
  for i in 1..6 loop
    result := result || chars[1+random()*(array_length(chars, 1)-1)];
  end loop;
  return result;
end;
$$;
