-- ============================================================
-- OweTrack Migration — Entry Editing & Statement Support
-- Run this in Supabase SQL Editor (safe to run multiple times)
-- ============================================================

-- 1. Ensure `reason` and `updated_at` columns exist on `entries`
alter table public.entries
  add column if not exists reason text;

alter table public.entries
  add column if not exists updated_at timestamptz default now();

-- Backfill `updated_at` for existing rows
update public.entries
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

-- 2. Automatically update `updated_at` whenever an entry is edited
create or replace function public.set_entries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_entries_updated_at on public.entries;
create trigger trg_entries_updated_at
  before update on public.entries
  for each row
  execute function public.set_entries_updated_at();

-- 3. Ensure RLS policy allows full CRUD (including UPDATE & DELETE) on own entries
alter table public.entries enable row level security;

drop policy if exists "entries_all_own" on public.entries;
create policy "entries_all_own" on public.entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
