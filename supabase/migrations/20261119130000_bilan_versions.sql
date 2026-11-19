-- D-059 : historique du bilan. Chaque enregistrement (élève ou entretien) garde une version immuable des réponses.
begin;
create table public.athlete_profile_versions (
  workspace_id uuid not null,
  athlete_id uuid not null,
  revision integer not null check (revision > 0),
  source text not null check (source in ('athlete','interview')),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  saved_by uuid not null,
  saved_at timestamptz not null default now(),
  primary key (workspace_id, athlete_id, revision),
  foreign key (workspace_id, athlete_id) references public.athletes(workspace_id, id)
);
alter table public.athlete_profile_versions enable row level security;
revoke all on public.athlete_profile_versions from anon, authenticated;
grant select, insert, update, delete on public.athlete_profile_versions to service_role;
grant select on public.athlete_profile_versions to authenticated;
create policy athlete_data on public.athlete_profile_versions for select to authenticated
using (private.assigned(workspace_id, athlete_id) or private.own_athlete(workspace_id, athlete_id));
commit;
