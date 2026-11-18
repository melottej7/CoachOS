-- Lots G et H (D-032) : groupes ordonnés et archivables, niveau par sport confirmé par le coach,
-- tâches du coach, état des suivis automatiques, rendez-vous. Migration additive.
-- Lecture sous RLS ; écriture par commandes serveur uniquement (service_role), comme le reste du schéma.

begin;

-- CE-G-01 : ordre et archivage des groupes (le nom reste unique dans l’espace).
alter table public.teams
  add column sort_order integer not null default 0,
  add column archived_at timestamptz,
  add constraint teams_name_length check (length(name) between 1 and 60);

-- CE-G-05 : niveau par sport confirmé par le coach. Le niveau déclaré (athlete_profiles) reste une proposition.
create table public.athlete_sport_levels (
workspace_id uuid not null,
athlete_id uuid not null,
sport_code text not null references public.sports(code),
level text not null check (level in ('beginner','intermediate','advanced','competitive')),
confirmed_by uuid not null,
confirmed_at timestamptz not null default now(),
primary key (workspace_id, athlete_id, sport_code),
foreign key (workspace_id, athlete_id) references public.athletes(workspace_id, id),
foreign key (workspace_id, confirmed_by) references public.memberships(workspace_id, user_id)
);

alter table public.athlete_sport_levels enable row level security;
revoke all on public.athlete_sport_levels from anon, authenticated;
grant select, insert, update, delete on public.athlete_sport_levels to service_role;
grant select on public.athlete_sport_levels to authenticated;
create policy athlete_data on public.athlete_sport_levels for select to authenticated
using (private.assigned(workspace_id, athlete_id) or private.own_athlete(workspace_id, athlete_id));

-- CE-H-02 : tâches humaines du coach.
create table public.coach_tasks (
workspace_id uuid not null references public.workspaces(id),
id uuid not null default gen_random_uuid(),
athlete_id uuid,
team_id uuid,
assignee_id uuid not null,
created_by uuid not null,
title text not null check (length(title) between 1 and 200),
kind text not null check (kind in ('message','review','program','questionnaire','call','check','other')),
due_on date,
priority smallint not null default 1 check (priority between 0 and 3),
status text not null default 'todo' check (status in ('todo','in_progress','waiting','done','postponed','canceled')),
link text check (link is null or (link like '/coach/%' and length(link) <= 300)),
notes text check (notes is null or length(notes) <= 2000),
revision integer not null default 1 check (revision > 0),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
closed_at timestamptz,
primary key (workspace_id, id),
foreign key (workspace_id, athlete_id) references public.athletes(workspace_id, id),
foreign key (workspace_id, team_id) references public.teams(workspace_id, id),
foreign key (workspace_id, assignee_id) references public.memberships(workspace_id, user_id),
foreign key (workspace_id, created_by) references public.memberships(workspace_id, user_id)
);

create index coach_tasks_by_assignee_idx on public.coach_tasks (workspace_id, assignee_id, status, due_on);
create index coach_tasks_by_athlete_idx on public.coach_tasks (workspace_id, athlete_id);

alter table public.coach_tasks enable row level security;
revoke all on public.coach_tasks from anon, authenticated;
grant select, insert, update, delete on public.coach_tasks to service_role;
grant select on public.coach_tasks to authenticated;
-- Visible par son responsable ou son auteur, et seulement si l’élève lié reste affecté.
create policy own_tasks on public.coach_tasks for select to authenticated
using (
  private.current_coach(workspace_id)
  and (assignee_id = (select auth.uid()) or created_by = (select auth.uid()))
  and (athlete_id is null or private.assigned(workspace_id, athlete_id))
);

-- CE-H-03 : suivis automatiques calculés depuis l’état réel (donc dédoublonnés et clos quand l’objet est résolu).
-- Seul le report (« plus tard ») est conservé, par coach, règle et objet.
create table public.auto_task_states (
workspace_id uuid not null,
coach_id uuid not null,
rule text not null check (rule in ('feedback_review','no_upcoming','invite_pending','profile_missing','level_unconfirmed','vma_missing')),
source_ref uuid not null,
snoozed_until date,
updated_at timestamptz not null default now(),
primary key (workspace_id, coach_id, rule, source_ref),
foreign key (workspace_id, coach_id) references public.memberships(workspace_id, user_id)
);

alter table public.auto_task_states enable row level security;
revoke all on public.auto_task_states from anon, authenticated;
grant select, insert, update, delete on public.auto_task_states to service_role;
grant select on public.auto_task_states to authenticated;
create policy own_states on public.auto_task_states for select to authenticated
using (private.current_coach(workspace_id) and coach_id = (select auth.uid()));

-- CE-H-05 : rendez-vous (appel, visioconférence, rencontre), reliés à la fiche élève.
create table public.appointments (
workspace_id uuid not null,
id uuid not null default gen_random_uuid(),
athlete_id uuid not null,
coach_id uuid not null,
title text not null check (length(title) between 1 and 120),
kind text not null check (kind in ('video','call','in_person')),
starts_at timestamptz not null,
duration_min smallint not null check (duration_min between 5 and 480),
time_zone text not null,
video_url text check (video_url is null or (video_url like 'https://%' and length(video_url) <= 500)),
prep_notes text check (prep_notes is null or length(prep_notes) <= 4000),
report text check (report is null or length(report) <= 8000),
status text not null default 'planned' check (status in ('planned','done','canceled')),
revision integer not null default 1 check (revision > 0),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
primary key (workspace_id, id),
foreign key (workspace_id, athlete_id) references public.athletes(workspace_id, id),
foreign key (workspace_id, coach_id) references public.memberships(workspace_id, user_id)
);

create index appointments_by_coach_idx on public.appointments (workspace_id, coach_id, starts_at);
create index appointments_by_athlete_idx on public.appointments (workspace_id, athlete_id, starts_at);

alter table public.appointments enable row level security;
revoke all on public.appointments from anon, authenticated;
grant select, insert, update, delete on public.appointments to service_role;
grant select on public.appointments to authenticated;
-- Coach affecté seulement : la préparation et le compte rendu sont des notes de coach.
create policy coach_only on public.appointments for select to authenticated
using (private.assigned(workspace_id, athlete_id));

commit;
