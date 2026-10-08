-- Stands in for the parts of Supabase the migrations rely on: the two roles, the auth schema
-- and auth.uid(), which reads the signed-in user's id from the request's token.
create role authenticated nologin;
create role anon nologin;
create role authenticator login password 'authenticator' noinherit;
grant authenticated, anon to authenticator;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;
grant usage on schema auth, public to authenticated, anon;
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
