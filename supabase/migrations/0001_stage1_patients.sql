-- Stage 1: patients, condition tags, and the link between them.
-- Run once in the Supabase SQL editor (or with the Supabase CLI).
-- Every row belongs to the signed-in doctor; row-level security hides it from anyone else.

create sequence if not exists public.patient_mrn_seq start 10001;

create table public.conditions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  color text not null default 'grey',
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mrn integer not null default nextval('public.patient_mrn_seq'),
  name text not null check (length(trim(name)) > 0),
  dob date not null,
  sex text not null check (sex in ('M', 'F')),
  phone text not null default '',
  guardian_name text not null default '',
  guardian_relation text not null default '',
  address text not null default '',
  allergies text not null default '',
  notes text not null default '',
  father_height_cm numeric(5, 1),
  mother_height_cm numeric(5, 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, mrn)
);

create index patients_owner_created_idx on public.patients (owner_id, created_at desc);
create index patients_name_idx on public.patients (owner_id, lower(name));

create table public.patient_conditions (
  patient_id uuid not null references public.patients (id) on delete cascade,
  condition_id uuid not null references public.conditions (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (patient_id, condition_id)
);

create index patient_conditions_condition_idx on public.patient_conditions (condition_id);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger patients_touch before update on public.patients
for each row execute function public.touch_updated_at();

alter table public.conditions enable row level security;
alter table public.patients enable row level security;
alter table public.patient_conditions enable row level security;

create policy conditions_owner on public.conditions
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy patients_owner on public.patients
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy patient_conditions_owner on public.patient_conditions
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant usage on sequence public.patient_mrn_seq to authenticated;
grant select, insert, update, delete on public.conditions, public.patients, public.patient_conditions to authenticated;

-- Number of patients per condition tag (respects row-level security).
create view public.condition_counts with (security_invoker = true) as
  select condition_id, count(*)::int as n
  from public.patient_conditions
  group by condition_id;

grant select on public.condition_counts to authenticated;

-- Replace a patient's tags in one transaction.
create or replace function public.set_patient_conditions(p_patient uuid, p_conditions uuid[])
returns void language plpgsql security invoker as $$
begin
  delete from public.patient_conditions where patient_id = p_patient;
  insert into public.patient_conditions (patient_id, condition_id)
  select p_patient, c from unnest(p_conditions) as c;
end $$;

grant execute on function public.set_patient_conditions(uuid, uuid[]) to authenticated;
