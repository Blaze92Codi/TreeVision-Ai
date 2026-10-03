-- Idempotent remediation for existing databases. No existing account is
-- automatically trusted. Provision staff_members explicitly as an operator.
create table if not exists public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.staff_members enable row level security;
revoke all on public.staff_members from public, anon, authenticated;
grant all on public.staff_members to service_role;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff_members where user_id = auth.uid());
$$;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to anon, authenticated, service_role;

-- Reconcile the repository schema with legacy client_* deployments using
-- additive columns/backfill. Existing columns, records and photos are retained.
alter table public.estimates add column if not exists status text default 'pending';
alter table public.estimates add column if not exists customer_name text;
alter table public.estimates add column if not exists customer_email text;
alter table public.estimates add column if not exists customer_phone text;
alter table public.estimates add column if not exists job_address text;
alter table public.estimates add column if not exists selected_service text;
alter table public.estimates add column if not exists internal_notes text;
alter table public.estimates add column if not exists species text;
alter table public.estimates add column if not exists latin_name text;
alter table public.estimates add column if not exists condition text;
alter table public.estimates add column if not exists isa_risk_rating text;
alter table public.estimates add column if not exists est_height text;
alter table public.estimates add column if not exists est_dbh text;
alter table public.estimates add column if not exists crown_spread text;
alter table public.estimates add column if not exists recommended_service text;
alter table public.estimates add column if not exists recommended_pkg_key text;
alter table public.estimates add column if not exists after_description text;
alter table public.estimates add column if not exists ansi_standard text;
alter table public.estimates add column if not exists quote_low integer;
alter table public.estimates add column if not exists quote_high integer;
alter table public.estimates add column if not exists annotations jsonb default '[]';
alter table public.estimates add column if not exists cut_points jsonb default '[]';
alter table public.estimates add column if not exists ai_notes text[];
alter table public.estimates add column if not exists photo_url text;
alter table public.estimates add column if not exists manager_notes text;
alter table public.estimates add column if not exists approved_quote_low integer;
alter table public.estimates add column if not exists approved_quote_high integer;
alter table public.estimates add column if not exists approved_at timestamptz;
alter table public.estimates add column if not exists approved_by text;
alter table public.estimates add column if not exists quote_sent_at timestamptz;
alter table public.estimates add column if not exists quote_email_id text;
alter table public.estimates add column if not exists created_at timestamptz default now();
alter table public.estimates add column if not exists updated_at timestamptz default now();
alter table public.estimates alter column status set default 'pending';
do $$ declare c record; pair text[]; begin
  -- Replace only single-column status checks; retain all unrelated constraints.
  for c in select conname from pg_constraint
    where conrelid = 'public.estimates'::regclass and contype = 'c'
    and conkey = array[(select attnum from pg_attribute
      where attrelid = 'public.estimates'::regclass and attname = 'status')]::smallint[]
  loop execute format('alter table public.estimates drop constraint %I', c.conname); end loop;
  foreach pair slice 1 in array array[
    ['client_name','customer_name'],['client_email','customer_email'],
    ['client_address','job_address'],['client_phone','customer_phone'],
    ['tree_species','species'],['health_summary','condition']
  ] loop
    if exists(select 1 from information_schema.columns where table_schema='public'
        and table_name='estimates' and column_name=pair[1]) then
      execute format('update public.estimates set %I = %I where %I is null',pair[2],pair[1],pair[2]);
    end if;
  end loop;
  -- NOT VALID preserves any unknown historical status; new writes are checked.
  alter table public.estimates add constraint estimates_security_status_check
    check (status in ('pending','draft','approved','rejected','declined','expired','scheduled','sent')) not valid;
end $$;

alter table public.estimates enable row level security;
-- Permissive policies OR together, so remove every legacy policy on this table.
do $$ declare p record; begin
  for p in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'estimates'
  loop execute format('drop policy %I on public.estimates', p.policyname); end loop;
end $$;
revoke all on public.estimates from public, anon, authenticated;
grant select, update on public.estimates to authenticated;
grant all on public.estimates to service_role;
create policy staff_read on public.estimates for select to authenticated
  using (public.is_staff());
create policy staff_update on public.estimates for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
-- The CRM also uses these legacy tables if present; protect customer PII.
do $$ declare t text; begin
  foreach t in array array['clients','jobs'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from public, anon, authenticated', t);
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
      execute format('drop policy if exists staff_boundary on public.%I', t);
      execute format('create policy staff_boundary on public.%I as restrictive for all to public using (public.is_staff()) with check (public.is_staff())', t);
      execute format('drop policy if exists staff_manage on public.%I', t);
      execute format('create policy staff_manage on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
    end if;
  end loop;
end $$;
-- Public submission is intentionally available ONLY via save-estimate.
-- No anon INSERT, SELECT, UPDATE, DELETE or direct storage upload grants.

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('tree-photos', 'tree-photos', false, 8388608,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- Restrictive guards cannot be overridden by unknown legacy permissive policies.
drop policy if exists tree_photos_boundary on storage.objects;
create policy tree_photos_boundary on storage.objects as restrictive for all to public
  using (bucket_id <> 'tree-photos' or public.is_staff())
  with check (bucket_id <> 'tree-photos' or public.is_staff());
drop policy if exists staff_tree_photos_read on storage.objects;
create policy staff_tree_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'tree-photos' and public.is_staff());
-- All writes to this bucket pass through the bounded server-side handler.
drop policy if exists tree_photos_write_boundary on storage.objects;
create policy tree_photos_write_boundary on storage.objects as restrictive for insert to public
  with check (bucket_id <> 'tree-photos');

-- Durable GLOBAL daily budgets (across isolates, IPs and concurrent requests).
-- IP headers are deliberately not trusted as an authorization/cost boundary.
create table if not exists public.intake_budgets (
  action text not null, day date not null, used integer not null,
  primary key(action, day)
);
alter table public.intake_budgets enable row level security;
revoke all on public.intake_budgets from public, anon, authenticated;
grant all on public.intake_budgets to service_role;
create or replace function public.consume_intake_budget(action_name text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare daily_limit integer; updated_count integer;
begin
  daily_limit := case action_name when 'analyze' then 20 when 'save-estimate' then 100
                 when 'send-quote' then 100 else 0 end;
  if daily_limit = 0 then return false; end if;
  insert into public.intake_budgets as b(action, day, used)
    values(action_name, (now() at time zone 'UTC')::date, 1)
    on conflict(action, day) do update set used = b.used + 1
      where b.used < daily_limit
    returning used into updated_count;
  delete from public.intake_budgets where day < (now() at time zone 'UTC')::date - 2;
  return updated_count is not null;
end $$;
revoke all on function public.consume_intake_budget(text) from public, anon, authenticated;
grant execute on function public.consume_intake_budget(text) to service_role;
