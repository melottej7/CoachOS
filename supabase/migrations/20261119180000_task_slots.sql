-- D-065 (CE-H-06) : créneau de travail et durée estimée d'une tâche. L'échéance dit « pour quand » ; le créneau dit
-- « quand je m'y mets » (jour, heure facultative) ; l'horaire fixe d'un rendez-vous reste dans public.appointments.
begin;
alter table public.coach_tasks
  add column slot_on date,
  add column slot_time time,
  add column estimate_min smallint check (estimate_min is null or estimate_min between 5 and 480),
  add constraint coach_tasks_slot_time check (slot_time is null or slot_on is not null);
commit;
