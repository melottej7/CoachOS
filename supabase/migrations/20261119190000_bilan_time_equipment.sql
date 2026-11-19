-- D-066 : bilan, temps disponible en semaine, moment préféré, jour préféré pour la séance longue, matériel et
-- contraintes pratiques (texte court, sans information médicale : rappelé à l'élève à la saisie).
begin;
alter table public.athlete_profiles
  add column weekday_minutes text check (weekday_minutes in ('lt45','45to60','60to90','gt90')),
  add column preferred_time text check (preferred_time in ('morning','noon','evening','variable')),
  add column long_day smallint check (long_day between 1 and 7),
  add column equipment text[] not null default '{}'
    check (equipment <@ array['gps_watch','power_meter','home_trainer','road_bike','offroad_bike','treadmill','track','pool','open_water','gym']::text[]),
  add column practical_constraints text check (practical_constraints is null or length(practical_constraints) between 1 and 300);
commit;
