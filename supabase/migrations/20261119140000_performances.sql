-- D-060 : résultats de référence de l’élève (courses, tests, séances de référence). Saisis par le coach affecté,
-- lus par l’élève. Servent à juger un chrono visé (faisabilité), au passif et aux équivalences de distance.
-- Aucune donnée de santé (ni fréquence cardiaque, ni sensation physique).
begin;
create table public.athlete_performances (
  workspace_id uuid not null,
  id uuid not null default gen_random_uuid(),
  athlete_id uuid not null,
  sport_code text not null references public.sports(code),
  kind text not null check (kind in ('race','test','training')),
  name text check (name is null or length(name) between 1 and 120),
  distance_m integer not null check (distance_m between 50 and 1000000),
  duration_s integer not null check (duration_s between 10 and 7 * 86400),
  done_on date not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, athlete_id) references public.athletes(workspace_id, id)
);
create index athlete_performances_by_athlete on public.athlete_performances (workspace_id, athlete_id, done_on desc);
alter table public.athlete_performances enable row level security;
revoke all on public.athlete_performances from anon, authenticated;
grant select, insert, update, delete on public.athlete_performances to service_role;
grant select on public.athlete_performances to authenticated;
create policy athlete_data on public.athlete_performances for select to authenticated
using (private.assigned(workspace_id, athlete_id) or private.own_athlete(workspace_id, athlete_id));
commit;
