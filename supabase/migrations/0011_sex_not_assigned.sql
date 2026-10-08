-- A newborn with a difference of sex development may have no sex assigned yet.
-- 'U' = not yet assigned; the doctor changes it to 'M' or 'F' on the patient form later.
alter table public.patients drop constraint if exists patients_sex_check;
alter table public.patients add constraint patients_sex_check check (sex in ('M', 'F', 'U'));
