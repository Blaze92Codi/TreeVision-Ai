import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('migration is repeatable; anon and arbitrary accounts cannot access estimates/photos; only allowlisted staff can manage them', async () => {
  const db = new PGlite();
  const staff = '11111111-1111-4111-8111-111111111111';
  const outsider = '22222222-2222-4222-8222-222222222222';
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid; $$;
    grant usage on schema auth, storage to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant all on storage.objects to anon, authenticated;
    create policy legacy_public on storage.objects for all to public using(true) with check(true);
    insert into auth.users values('${staff}', '{}'), ('${outsider}', '{"role":"staff"}');
  `);
  const base = (await readFile('../supabase/migrations/20260602000000_create_estimates.sql','utf8'))
    .replace('create extension if not exists "pgcrypto";', '');
  await db.exec(base);
  // Simulate exactly the deployed vulnerable policy, plus an unknown permissive policy.
  await db.exec(`grant all on estimates to anon, authenticated;
    create policy legacy_anon_read on estimates for select to anon using(true);
    create policy arbitrary_accounts on estimates for all to authenticated using(true) with check(true);
    alter table estimates add column client_name text;
    insert into estimates(client_name) values('Legacy customer');
    create table clients(id uuid, name text); alter table clients enable row level security;
    grant all on clients to anon,authenticated; create policy open_clients on clients for all to public using(true) with check(true);
    insert into clients values(gen_random_uuid(),'Private client');
    insert into storage.objects(bucket_id,name) values('tree-photos','private.jpg');`);
  const migration = await readFile('../supabase/migrations/20261003000000_security_boundaries.sql','utf8');
  await db.exec(migration);
  await db.exec(`insert into staff_members(user_id) values('${staff}');`);
  await db.exec(migration);
  const asRole = async (role, user, sql) => {
    await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${user}', false);`);
    try { return await db.query(sql); } finally { await db.exec('reset role'); }
  };
  await assert.rejects(asRole('anon','','select * from estimates'), /permission denied/);
  await assert.rejects(asRole('anon','','insert into estimates(customer_name) values(\'intruder\')'), /permission denied/);
  assert.equal((await asRole('anon','','select * from storage.objects')).rows.length, 0);
  assert.equal((await asRole('authenticated',outsider,'select * from estimates')).rows.length, 0);
  assert.equal((await asRole('authenticated',outsider,'select * from storage.objects')).rows.length, 0);
  assert.equal((await asRole('authenticated',outsider,"update estimates set manager_notes='hacked' returning id")).rows.length, 0);
  await assert.rejects(asRole('authenticated',outsider,`insert into staff_members(user_id) values('${outsider}')`), /permission denied/);
  await assert.rejects(asRole('authenticated',outsider,"select consume_intake_budget('analyze')"), /permission denied/);
  assert.equal((await asRole('authenticated',staff,'select * from estimates')).rows[0].customer_name, 'Legacy customer');
  await assert.rejects(asRole('anon','','select * from clients'), /permission denied/);
  assert.equal((await asRole('authenticated',outsider,'select * from clients')).rows.length,0);
  assert.equal((await asRole('authenticated',staff,'select * from clients')).rows.length,1);
  assert.equal((await asRole('authenticated',staff,'select * from storage.objects')).rows.length, 1);
  assert.equal((await asRole('authenticated',staff,"update estimates set manager_notes='approved' returning id")).rows.length, 1);
  await assert.rejects(asRole('authenticated',staff,"insert into storage.objects(bucket_id,name) values('tree-photos','bypass.jpg')"), /row-level security/);
  assert.equal((await db.query("select public from storage.buckets where id='tree-photos'")).rows[0].public, false);
  await db.exec(`delete from staff_members where user_id='${staff}'`);
  assert.equal((await asRole('authenticated',staff,'select * from estimates')).rows.length, 0);
  await db.close();
});

test('global intake budget atomically caps requests and denies client execution', async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select null::uuid; $$;
    create table estimates(id uuid);
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text);`);
  await db.exec(await readFile('../supabase/migrations/20261003000000_security_boundaries.sql','utf8'));
  await db.exec('set role service_role');
  const results = await Promise.all(Array.from({length:40}, () => db.query("select consume_intake_budget('analyze') as allowed")));
  assert.equal(results.filter(r => r.rows[0].allowed).length,20);
  assert.equal((await db.query("select consume_intake_budget('unknown') as allowed")).rows[0].allowed,false);
  await db.close();
});
