-- D-064 (CE-X-03) : activités de la montre rattachées à une séance. Une séance peut en avoir plusieurs (échauffement
-- et course enregistrés à part, montre coupée en route). Seul le résumé est conservé : format, sport, début, durée,
-- distance. Le fichier reste sur l'appareil de l'élève ; aucune fréquence cardiaque, puissance ou position.
-- Une activité n'est rattachée qu'à une seule séance (empreinte unique par élève) : aucun double comptage.
begin;
create table public.workout_activities (
  workspace_id uuid not null,
  athlete_id uuid not null,
  id uuid not null default gen_random_uuid(),
  workout_id uuid not null,
  format text not null check (format in ('fit', 'tcx', 'gpx')),
  sport_code text,
  started_at timestamptz,
  duration_seconds integer check (duration_seconds between 1 and 86400),
  distance_m integer check (distance_m between 1 and 1000000),
  fingerprint text not null check (length(fingerprint) between 5 and 200),
  created_at timestamptz not null default now(),
  primary key (workspace_id, id),
  unique (workspace_id, athlete_id, fingerprint),
  foreign key (workspace_id, athlete_id) references public.athletes(workspace_id, id),
  foreign key (workspace_id, athlete_id, workout_id) references public.workouts(workspace_id, athlete_id, id),
  check (duration_seconds is not null or distance_m is not null)
);
create index workout_activities_by_workout_idx on public.workout_activities (workspace_id, athlete_id, workout_id);
alter table public.workout_activities enable row level security;
revoke all on public.workout_activities from anon, authenticated;
grant select, insert, update, delete on public.workout_activities to service_role;
grant select on public.workout_activities to authenticated;
create policy athlete_data on public.workout_activities for select to authenticated
  using (private.assigned(workspace_id, athlete_id) or private.own_athlete(workspace_id, athlete_id));
commit;
