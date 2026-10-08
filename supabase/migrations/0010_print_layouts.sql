-- Print layouts: how a prescription is laid out for a particular paper or pre-printed pad.
-- The doctor can keep several, one per clinic, and mark one as the default. Run after 0009.

create table public.print_layouts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  -- Paper size, margins, type, sections and their order; the app fills in anything missing.
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

-- At most one default per account.
create unique index print_layouts_one_default on public.print_layouts (owner_id) where is_default;

alter table public.print_layouts enable row level security;

create policy print_layouts_owner on public.print_layouts
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete on public.print_layouts to authenticated;
