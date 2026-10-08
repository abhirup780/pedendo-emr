-- Follow-up tracking: each patient row carries the date of the last visit, the number of
-- visits, and the review date set at the latest visit. Kept up to date by a trigger so the
-- patient list can sort and filter on them. Run after 0006.

alter table public.patients
  add column last_visit_on date,
  add column next_review_on date,
  add column visit_count integer not null default 0;

create index patients_review_idx on public.patients (owner_id, next_review_on) where next_review_on is not null;
create index patients_last_visit_idx on public.patients (owner_id, last_visit_on desc nulls last);

create or replace function public.refresh_patient_visit_summary(p uuid) returns void
language sql as $$
  update public.patients set
    last_visit_on = (select max(v.visit_date) from public.visits v where v.patient_id = p),
    visit_count = (select count(*) from public.visits v where v.patient_id = p),
    -- The review date written at the most recent visit; null if that visit set none.
    next_review_on = (select v.review_date from public.visits v where v.patient_id = p order by v.visit_date desc, v.created_at desc limit 1)
  where id = p;
$$;

create or replace function public.visits_refresh_summary() returns trigger
language plpgsql as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_patient_visit_summary(old.patient_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_patient_visit_summary(new.patient_id);
  end if;
  return null;
end $$;

create trigger visits_summary after insert or update or delete on public.visits
for each row execute function public.visits_refresh_summary();

-- Fill in the summary for visits that already exist.
update public.patients p set
  last_visit_on = s.last_visit_on,
  visit_count = s.visit_count,
  next_review_on = (select v.review_date from public.visits v where v.patient_id = p.id order by v.visit_date desc, v.created_at desc limit 1)
from (select patient_id, max(visit_date) as last_visit_on, count(*) as visit_count from public.visits group by patient_id) s
where s.patient_id = p.id;
