-- D-110 : où l'élève fait sa musculation (salle, maison, extérieur) ; « poids du corps » parmi le matériel de maison.
begin;
alter table public.athlete_profiles
  add column training_places text[] not null default '{}' check (training_places <@ array['gym','home','outdoor']::text[]);
alter table public.athlete_profiles drop constraint athlete_profiles_equipment_check;
alter table public.athlete_profiles add constraint athlete_profiles_equipment_check
  check (equipment <@ array['gps_watch','power_meter','home_trainer','road_bike','offroad_bike','treadmill','track','pool','open_water','gym',
                            'bodyweight','dumbbells','kettlebell','bands','pullup_bar','bench','mat']::text[]);
commit;
