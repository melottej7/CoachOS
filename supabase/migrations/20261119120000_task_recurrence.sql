-- D-059 (CE-H-06) : tâches récurrentes. À la clôture (« faite »), l’occurrence suivante est créée avec l’échéance décalée.
alter table public.coach_tasks
  add column recurrence text check (recurrence in ('weekly','biweekly','monthly')),
  add constraint coach_tasks_recurrence_due check (recurrence is null or due_on is not null);
