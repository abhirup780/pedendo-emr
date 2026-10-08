-- A one-tap investigation panel can be tied to condition tags: it is then offered on visits
-- of patients who carry one of those tags. An empty list means "offer it for every patient".
-- Tag ids that no longer exist are simply ignored by the app.
alter table public.investigation_panels add column if not exists condition_ids uuid[] not null default '{}';
