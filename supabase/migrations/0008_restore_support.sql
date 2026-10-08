-- Restoring a backup inserts patients with their original MRNs. Afterwards the MRN counter
-- must move past the highest one, or the next new patient would collide. Run after 0007.

create or replace function public.sync_patient_mrn_sequence() returns void
language sql security definer set search_path = public as $$
  -- Only ever moves the counter forward.
  select setval(
    'public.patient_mrn_seq',
    greatest((select coalesce(max(mrn), 10000) from public.patients), (select last_value from public.patient_mrn_seq))
  );
$$;

revoke all on function public.sync_patient_mrn_sequence() from public;
grant execute on function public.sync_patient_mrn_sequence() to authenticated;
