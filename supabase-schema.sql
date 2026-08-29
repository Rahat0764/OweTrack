-- ============================================================
-- KHATA LEDGER — Supabase schema
-- Run this whole file once in Supabase SQL editor.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- profiles ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  pin_hash text,
  pin_set boolean default false,
  is_suspended boolean default false,
  suspend_reason text,
  created_at timestamptz default now()
);

-- ---------- contacts (the people you keep accounts with) ----------
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  phone text,
  created_at timestamptz default now()
);

-- ---------- entries (gave / took transactions against a contact) ----------
create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete cascade not null,
  type text not null check (type in ('gave','took')),
  amount numeric not null check (amount > 0),
  note text,
  entry_date date not null default current_date,
  ref_id text,
  created_at timestamptz default now()
);

create index if not exists entries_user_idx on entries(user_id);
create index if not exists entries_contact_idx on entries(contact_id);
create index if not exists contacts_user_idx on contacts(user_id);

-- ---------- user_feedback (user -> developer/admin, with admin reply) ----------
create table if not exists user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  message text not null,
  rating int,
  admin_reply text,
  reply_at timestamptz,
  reply_seen boolean default false,
  is_read boolean default false,
  created_at timestamptz default now()
);
create index if not exists user_feedback_user_idx on user_feedback(user_id);

-- ---------- feedback (admin -> a specific user, one-way message) ----------
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  message text not null,
  created_at timestamptz default now()
);

-- ---------- Row Level Security ----------
alter table profiles enable row level security;
alter table contacts enable row level security;
alter table entries enable row level security;
alter table user_feedback enable row level security;
alter table feedback enable row level security;

-- profiles: user can read/update only their own row
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);

-- contacts: full CRUD on own rows
create policy "contacts_all_own" on contacts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- entries: full CRUD on own rows
create policy "entries_all_own" on entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_feedback: a user can insert/read their own feedback (admin routes use the service role key and bypass RLS)
create policy "user_feedback_own" on user_feedback for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- feedback: a user can read messages addressed to them (only admin routes insert, via service role)
create policy "feedback_select_own" on feedback for select using (auth.uid() = user_id);

-- ---------- Storage bucket for avatars ----------
-- Create a public bucket named "avatars" from the Supabase Storage UI
-- (or run: select storage.create_bucket('avatars', true);)
-- and add a policy allowing authenticated users to upload to their own folder:
--
-- create policy "avatar uploads" on storage.objects for insert
--   to authenticated with check (bucket_id = 'avatars');
-- create policy "avatar public read" on storage.objects for select
--   using (bucket_id = 'avatars');
