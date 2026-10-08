-- Photographs move from Google Drive to Supabase Storage, and sign-in becomes email and
-- password with an optional authenticator-app code. Run after 0012.

-- 1. A private place for photograph files. Nothing in it has a public address.
--    Each file is at most 2 MB (the app shrinks photographs to about 300 KB) and must be a JPEG.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

-- Files are stored as <doctor's account id>/<patient id>/<file name>. An account can add, read
-- and remove only what is under its own id.
-- (Each rule is dropped first only so that this file can be run again if a first try stopped
-- half-way; on a first run there is nothing to drop.)
drop policy if exists photos_files_read on storage.objects;
drop policy if exists photos_files_add on storage.objects;
drop policy if exists photos_files_remove on storage.objects;
drop policy if exists photos_files_second_step on storage.objects;
create policy photos_files_read on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy photos_files_add on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy photos_files_remove on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 2. The second sign-in step. Once the doctor has set up an authenticator app, the password
--    alone must not open the records: the database itself then insists on a sign-in that
--    included the code. An account without an authenticator app is unaffected.
create or replace function public.second_step_required() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.mfa_factors f
    where f.user_id = (select auth.uid()) and f.status = 'verified'
  );
$$;

create or replace function public.second_step_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
      or not public.second_step_required();
$$;

revoke all on function public.second_step_required() from public;
revoke all on function public.second_step_ok() from public;
grant execute on function public.second_step_required() to authenticated;
grant execute on function public.second_step_ok() to authenticated;

-- "Restrictive" means this is checked as well as each table's own owner rule, never instead.
do $$
declare
  t text;
begin
  foreach t in array array[
    'conditions', 'patients', 'patient_conditions', 'visits', 'medicines', 'rx_templates',
    'clinic_settings', 'investigations', 'investigation_panels', 'results', 'photos', 'print_layouts'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_second_step', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated '
      'using ((select public.second_step_ok())) with check ((select public.second_step_ok()))',
      t || '_second_step', t
    );
  end loop;
end $$;

create policy photos_files_second_step on storage.objects
  as restrictive for all to authenticated
  using (bucket_id <> 'photos' or (select public.second_step_ok()))
  with check (bucket_id <> 'photos' or (select public.second_step_ok()));
