-- ============================================================
-- TreeVision Canopy Trim Pre-Estimator
-- Migration: 20260603000000_lock_down_estimates_anon_select.sql
--
-- Removes the legacy anon SELECT policy that exposed all estimate rows.
-- Estimates contain customer PII, photos, internal notes, and pricing data,
-- so public clients may submit estimates but must not read them directly.
-- ============================================================

alter table estimates enable row level security;

drop policy if exists "anon can read own estimate by id" on estimates;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'estimates'
      and policyname = 'authenticated staff can read estimates'
  ) then
    create policy "authenticated staff can read estimates"
      on estimates for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'estimates'
      and policyname = 'authenticated staff can update estimates'
  ) then
    create policy "authenticated staff can update estimates"
      on estimates for update
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;
