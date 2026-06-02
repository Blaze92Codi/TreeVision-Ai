-- ============================================================
-- Migration: harden estimates RLS + lock down public surface
-- Date: 2026-06-02
--
-- Fixes verified against the LIVE project:
--   1. CRITICAL — anon could read ALL customer PII (USING (true) SELECT policy).
--   2. HIGH     — anon could INSERT rows pre-marked 'approved' (status injection),
--                 which unauthenticated send-quote would then email out.
--   3. MED/LOW  — SECURITY DEFINER functions callable by anon via RPC;
--                 public storage bucket allowed anonymous listing;
--                 mutable search_path on the updated-at trigger function.
--
-- Apply with:  supabase db push      (or paste into Studio → SQL Editor)
-- ============================================================

-- ── 1) CRITICAL: remove the anon SELECT policy that exposed all customer PII ──
-- The policy was named "...own estimate by id" but its body was USING (true),
-- so any holder of the public anon key (embedded in page source) could read
-- every row: customer_name, customer_email, customer_phone, job_address,
-- internal_notes, photo_base64, etc.
--
-- Staff keep read access via the existing "staff read estimates" policy
-- (authenticated owner/crew_manager). Edge Functions use the service-role key
-- and bypass RLS, so customer submission and quote sending are unaffected.
drop policy if exists "anon can read own estimate by id" on public.estimates;

-- ── 2) Tighten anon INSERT: keep public submission, block status injection ────
-- Remove the duplicate/over-permissive insert policies and replace with one
-- that pins new rows to a clean 'pending' state. A stranger can still submit a
-- lead, but can no longer plant an 'approved' row with attacker-controlled
-- recipient/body for send-quote to email out.
drop policy if exists "anon can insert estimates" on public.estimates;
drop policy if exists "clients submit estimates"  on public.estimates;

create policy "anon submit pending estimates"
  on public.estimates for insert
  to anon
  with check (
        status              = 'pending'
    and approved_quote_low  is null
    and approved_quote_high is null
    and approved_at         is null
    and approved_by         is null
    and manager_notes       is null
    and quote_sent_at       is null
  );

-- ── 3) Lock down SECURITY DEFINER functions exposed via PostgREST RPC ─────────
-- handle_new_user() is an auth trigger function; nothing should call it directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- current_user_role() is referenced by the staff RLS policies, so the
-- 'authenticated' role MUST keep EXECUTE; 'anon' does not need it.
revoke execute on function public.current_user_role() from public, anon;
grant  execute on function public.current_user_role() to authenticated;

-- ── 4) Pin search_path on the updated-at trigger function ─────────────────────
alter function public.update_updated_at_column() set search_path = '';

-- ── 5) Stop anonymous LISTING of the public photo bucket ──────────────────────
-- Public buckets still serve individual object URLs without this policy; the
-- broad SELECT policy only enabled enumerating every uploaded photo.
drop policy if exists "anon read tree photos" on storage.objects;

-- NOTE (manual, not expressible in SQL here):
--   • Auth → enable "Leaked password protection" (HaveIBeenPwned).
--   • Consider disabling public sign-ups and inviting staff instead
--     (Auth → Providers → Email → "Allow new users to sign up").
