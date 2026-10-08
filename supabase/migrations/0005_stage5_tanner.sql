-- Stage 5: Tanner staging recorded at a visit. Run after 0004.
-- {g, b, p: 1-5 or null; testis_r, testis_l: mL or null; signs: [text]}; null when not staged.
alter table public.visits
  add column tanner jsonb check (tanner is null or jsonb_typeof(tanner) = 'object');
