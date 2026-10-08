-- Prepares a bare Postgres to look like a Supabase project before anything else runs.
--
-- Sign-in is NOT a stand-in: scripts/test-db.sh runs Supabase's own auth server against this
-- database, and that server creates the real `auth` schema (users, auth.uid(), auth.jwt(),
-- mfa_factors). This file only makes the roles and the empty schema it expects to find.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login password 'authenticator' noinherit;
grant anon, authenticated, service_role to authenticator;

create role supabase_auth_admin login password 'auth' noinherit createrole;
create schema auth authorization supabase_auth_admin;
alter role supabase_auth_admin set search_path = auth;
grant usage on schema auth, public to anon, authenticated, service_role;

-- File storage IS a stand-in: only the tables and the helper that migration 0013 touches,
-- copied in shape from Supabase Storage's own migrations (github.com/supabase/storage,
-- migrations/tenant). The storage server itself is not run here, so uploads and downloads are
-- not exercised against the real thing; the rules on who may touch which file are.
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner_id text
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata jsonb,
  owner_id text,
  unique (bucket_id, name)
);
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
create function storage.foldername(name text) returns text[] language plpgsql as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end $$;
