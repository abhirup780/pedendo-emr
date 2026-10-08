-- Stage 2: visits with prescription, the doctor's medicine list, prescription templates,
-- and the clinic details printed on the prescription. Run after 0001.

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  visit_date date not null default current_date,
  height_cm numeric(5, 1) check (height_cm is null or (height_cm >= 20 and height_cm <= 230)),
  weight_kg numeric(5, 2) check (weight_kg is null or (weight_kg >= 0.3 and weight_kg <= 300)),
  bp text not null default '',
  complaint text not null default '',
  history text not null default '',
  assessment text not null default '',
  plan text not null default '',
  advice text not null default '',
  review_date date,
  -- Array of {name, dose, frequency, route, duration, instructions}, in printed order.
  medicines jsonb not null default '[]'::jsonb check (jsonb_typeof(medicines) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index visits_patient_date_idx on public.visits (patient_id, visit_date desc, created_at desc);

create trigger visits_touch before update on public.visits
for each row execute function public.touch_updated_at();

create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  dose text not null default '',
  frequency text not null default '',
  route text not null default '',
  duration text not null default '',
  instructions text not null default '',
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.rx_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  medicines jsonb not null default '[]'::jsonb check (jsonb_typeof(medicines) = 'array'),
  advice text not null default '',
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.clinic_settings (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  doctor_name text not null default '',
  qualifications text not null default '',
  reg_no text not null default '',
  clinic_name text not null default '',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  updated_at timestamptz not null default now()
);

create trigger clinic_settings_touch before update on public.clinic_settings
for each row execute function public.touch_updated_at();

alter table public.visits enable row level security;
alter table public.medicines enable row level security;
alter table public.rx_templates enable row level security;
alter table public.clinic_settings enable row level security;

-- A visit must also point at one of the doctor's own patients.
create policy visits_owner on public.visits
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from public.patients p where p.id = patient_id));
create policy medicines_owner on public.medicines
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy rx_templates_owner on public.rx_templates
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy clinic_settings_owner on public.clinic_settings
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete
  on public.visits, public.medicines, public.rx_templates, public.clinic_settings to authenticated;

-- Tighten the stage 1 tag links the same way: both ends must be the doctor's own rows.
drop policy patient_conditions_owner on public.patient_conditions;
create policy patient_conditions_owner on public.patient_conditions
  for all to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.patients p where p.id = patient_id)
    and exists (select 1 from public.conditions c where c.id = condition_id)
  );
