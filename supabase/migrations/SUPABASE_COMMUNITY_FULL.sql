-- Enable extensions in a specific schema (standard in Supabase)
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;

-- Set search path so we don't need to prefix every type/function
SET search_path TO public, extensions;

-- 1. GROUPS & COMMUNITY
create table if not exists groups (
  id uuid default uuid_generate_v4() primary key,
  residence_id uuid references residences(id) on delete set null,
  name text not null,
  description text,
  type text check (type in ('official', 'interest', 'buy_sell')) default 'interest',
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references auth.users(id)
);

create table if not exists group_members (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references groups(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  role text check (role in ('admin', 'member')) default 'member',
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(group_id, user_id)
);

create table if not exists group_posts (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references groups(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  content text,
  images text[], -- Array of image URLs
  likes_count int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists group_comments (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references group_posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. STORES & SUPERMARKETS
create table if not exists stores (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  address text,
  location geography(Point, 4326), -- Geospatial type for distance calc
  type text check (type in ('supermarket', 'convenience', 'market')) default 'supermarket',
  image_url text,
  phone text,
  opening_hours jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists store_products (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references stores(id) on delete cascade not null,
  name text not null,
  price decimal(10, 2),
  image_url text,
  in_stock boolean default true,
  category text
);

-- 3. RLS POLICIES
alter table groups enable row level security;
alter table group_members enable row level security;
alter table group_posts enable row level security;
alter table group_comments enable row level security;
alter table stores enable row level security;

-- Public read access for groups and stores
create policy "Groups are viewable by everyone" on groups for select using (true);
create policy "Stores are viewable by everyone" on stores for select using (true);
create policy "Posts are viewable by group members" on group_posts for select using (
    exists (select 1 from group_members where group_id = group_posts.group_id and user_id = auth.uid())
);

-- Members can post
create policy "Members can create posts" on group_posts for insert with check (
    auth.uid() = user_id and
    exists (select 1 from group_members where group_id = group_posts.group_id and user_id = auth.uid())
);

-- 4. SPATIAL INDEX
create index if not exists stores_geo_index on stores using GIST (location);
