-- ============================================================
-- TreeVision Canopy Trim Pre-Estimator
-- Migration: 20260602000000_create_estimates.sql
--
-- Creates the estimates table matching the column names used
-- by dashboard.html, index.html (via app.js save-estimate call),
-- and all three Supabase Edge Functions.
--
-- Apply via:  supabase db push
-- Or manually in Supabase Studio → SQL Editor
-- ============================================================

-- Enable UUID generation if not already available
create extension if not exists "pgcrypto";

-- ── Main estimates table ─────────────────────────────────────────────────────
create table if not exists estimates (
  -- Identity
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Status lifecycle: pending → approved/rejected → sent/scheduled
  status                text not null default 'pending'
                          check (status in ('pending','approved','rejected','scheduled','sent')),

  -- Customer contact (collected in screen-55 of index.html)
  customer_name         text,
  customer_phone        text,
  customer_email        text,
  job_address           text,

  -- AI analysis output (from analyze Edge Function / Claude response)
  species               text,                    -- common_name from AI
  latin_name            text,
  id_confidence         text,
  est_height            text,                    -- e.g. "38–48 ft"
  est_dbh               text,                    -- e.g. "14–18 in"
  crown_spread          text,                    -- e.g. "32–40 ft"
  condition             text,                    -- Excellent | Good | Fair | Poor | Dead/Hazardous
  isa_risk_rating       text,                    -- Low | Moderate | High | Extreme
  recommended_service   text,
  recommended_pkg_key   text,                    -- trim | removal | stump
  ansi_standard         text,
  after_description     text,
  live_crown_retained_pct integer,
  ai_notes              text[],                  -- array of observation strings
  annotations           jsonb default '[]',      -- zone annotation objects for canvas
  cut_points            jsonb default '[]',      -- cut point markers

  -- Preliminary quote range (AI-generated, before manager approval)
  quote_low             integer,
  quote_high            integer,

  -- Selected service (set when customer picks a package)
  selected_service      text,

  -- Photo storage
  photo_url             text,                    -- Supabase Storage public URL

  -- Internal estimator notes (screen-55 internal_notes field)
  internal_notes        text,

  -- Manager review fields (set in dashboard.html)
  manager_notes         text,
  approved_quote_low    integer,
  approved_quote_high   integer,
  approved_at           timestamptz,

  -- Quote delivery tracking (set by send-quote Edge Function)
  quote_sent_at         timestamptz,
  quote_email_id        text,                    -- Resend email ID for delivery tracking
  approved_by           text                     -- name/email of the approving manager
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists estimates_status_idx      on estimates (status);
create index if not exists estimates_created_at_idx  on estimates (created_at desc);
create index if not exists estimates_customer_email  on estimates (customer_email)
  where customer_email is not null;

-- ── Updated-at trigger ───────────────────────────────────────────────────────
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists estimates_updated_at on estimates;
create trigger estimates_updated_at
  before update on estimates
  for each row execute function update_updated_at_column();

-- ── Row Level Security ───────────────────────────────────────────────────────
-- Edge Functions use the service role key and bypass RLS.
-- Enable RLS so anon/authenticated users can only insert (submit), not read/update.
alter table estimates enable row level security;

-- Allow the app frontend (anon key) to INSERT new estimates
create policy "anon can insert estimates"
  on estimates for insert
  to anon
  with check (true);

-- Allow the app frontend (anon key) to SELECT only their own record by ID
-- (used to show the saved-ID confirmation in screen-55)
create policy "anon can read own estimate by id"
  on estimates for select
  to anon
  using (true);  -- tighten to: using (id = (current_setting('app.estimate_id'))::uuid) if needed

-- Service role (Edge Functions) has full access — bypasses RLS automatically

-- ── Storage bucket ───────────────────────────────────────────────────────────
-- Run this in Studio → Storage → New bucket, OR via CLI:
--   supabase storage create tree-photos --public
-- Alternatively, the config.toml [[storage.buckets]] block handles this on `supabase start`
