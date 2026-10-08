-- Stage 3: the doctor's investigation list and panels, investigations advised at a visit,
-- and results entered when reports come back. Run after 0003.

-- Names of the investigations advised at this visit, in the order chosen.
alter table public.visits
  add column investigations jsonb not null default '[]'::jsonb check (jsonb_typeof(investigations) = 'array');

create table public.investigations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text not null default 'General',
  unit text not null default '',
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.investigation_panels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  -- Array of investigation names.
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.results (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  test text not null check (length(trim(test)) > 0),
  -- Text, so "<0.1", "Positive" or "7y 6m" can be recorded as reported.
  value text not null check (length(trim(value)) > 0),
  unit text not null default '',
  result_date date not null default current_date,
  flag text not null default '' check (flag in ('', 'low', 'high')),
  created_at timestamptz not null default now()
);

create index results_patient_idx on public.results (patient_id, result_date desc, created_at desc);

alter table public.investigations enable row level security;
alter table public.investigation_panels enable row level security;
alter table public.results enable row level security;

create policy investigations_owner on public.investigations
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy investigation_panels_owner on public.investigation_panels
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy results_owner on public.results
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from public.patients p where p.id = patient_id));

grant select, insert, update, delete
  on public.investigations, public.investigation_panels, public.results to authenticated;
