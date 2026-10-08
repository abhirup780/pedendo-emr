-- A condition tag can be linked to built-in guideline protocols (keys from the app's
-- protocol list). Empty means the app matches protocols by the tag's name.
alter table public.conditions add column if not exists protocols text[] not null default '{}';
