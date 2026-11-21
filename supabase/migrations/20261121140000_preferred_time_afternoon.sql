-- D-109 : « L'après-midi » parmi les moments préférés pour s'entraîner.
begin;
alter table public.athlete_profiles drop constraint athlete_profiles_preferred_time_check;
alter table public.athlete_profiles add constraint athlete_profiles_preferred_time_check
  check (preferred_time in ('morning','noon','afternoon','evening','variable'));
commit;
