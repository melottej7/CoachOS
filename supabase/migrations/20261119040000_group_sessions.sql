-- D-042 · Lot G2 : séance préparée pour un groupe. Une base commune crée un brouillon indépendant par élève choisi ;
-- chaque brouillon s’adapte puis se publie explicitement. La base ne donne aucun droit : les séances restent celles de
-- chaque dossier (RLS des workouts inchangée).
begin;

create table public.group_sessions (
  workspace_id uuid not null,
  id uuid not null default gen_random_uuid(),
  team_id uuid not null,
  created_by uuid not null,
  local_date date not null,
  title text not null check (length(title) between 1 and 120),
  base jsonb not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, team_id) references public.teams(workspace_id, id),
  foreign key (workspace_id, created_by) references public.memberships(workspace_id, user_id)
);
create index group_sessions_by_team_idx on public.group_sessions (workspace_id, team_id, local_date desc);

alter table public.group_sessions enable row level security;
revoke all on public.group_sessions from anon, authenticated;
grant select, insert, update, delete on public.group_sessions to service_role;
grant select on public.group_sessions to authenticated;
-- Coachs actifs de l’espace seulement (jamais les élèves).
create policy coach_read on public.group_sessions for select to authenticated using (private.current_coach(workspace_id));

alter table public.workouts add column group_session_id uuid;
alter table public.workouts add constraint workouts_group_session_fk
  foreign key (workspace_id, group_session_id) references public.group_sessions(workspace_id, id);
create index workouts_by_group_session_idx on public.workouts (workspace_id, group_session_id) where group_session_id is not null;

commit;
