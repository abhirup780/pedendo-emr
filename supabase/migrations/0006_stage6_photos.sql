-- Stage 6: optional clinical photographs. The image files live in the doctor's Google Drive;
-- the database keeps only the Drive file ID and a few details. Run after 0005.

alter table public.patients
  add column photo_consent_on date,
  add column photo_consent_by text not null default '';

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  taken_on date not null default current_date,
  view text not null default 'Other',
  note text not null default '',
  -- Google Drive file ID.
  file_id text not null check (length(file_id) > 0),
  width integer not null default 0,
  height integer not null default 0,
  bytes integer not null default 0,
  created_at timestamptz not null default now()
);

create index photos_patient_idx on public.photos (patient_id, taken_on desc, created_at desc);

alter table public.photos enable row level security;

create policy photos_owner on public.photos
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from public.patients p where p.id = patient_id));

grant select, insert, update, delete on public.photos to authenticated;
