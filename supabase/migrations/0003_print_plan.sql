-- The plan prints on the prescription unless the doctor unticks it for that visit.
alter table public.visits add column print_plan boolean not null default true;
