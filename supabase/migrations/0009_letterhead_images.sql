-- Optional clinic logo and doctor's signature for the printed prescription, stored as small
-- images (data URLs, shrunk in the browser to well under 100 KB each). Run after 0008.
alter table public.clinic_settings
  add column logo text not null default '' check (length(logo) < 400000),
  add column signature text not null default '' check (length(signature) < 400000);
