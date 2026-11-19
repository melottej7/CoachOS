-- D-058 : décision du coach sur un objectif. La faisabilité calculée n’est qu’une indication ; le coach décide,
-- avec sa justification (passif de l’élève, connaissance du terrain). Les paramètres validés (distance, date, chrono,
-- séances, temps) deviennent la contrainte que le futur générateur de programme (lot P) devra respecter pour atteindre l’objectif.
-- Table réservée aux coachs affectés : l’élève ne la lit jamais (la note peut contenir l’avis du coach).

begin;

create table public.goal_decisions (
  workspace_id uuid not null,
  goal_id uuid not null,
  athlete_id uuid not null,
  decided_by uuid not null,
  decided_at timestamptz not null default now(),
  status_at_decision text not null check (status_at_decision in ('realistic','ambitious','risky','unrealistic')),
  params jsonb not null check (jsonb_typeof(params) = 'object'),
  note text check (length(note) <= 1000),
  revision integer not null default 1 check (revision > 0),
  primary key (workspace_id, goal_id),
  foreign key (workspace_id, goal_id) references public.goals(workspace_id, id),
  foreign key (workspace_id, athlete_id) references public.athletes(workspace_id, id)
);

alter table public.goal_decisions enable row level security;
revoke all on public.goal_decisions from anon, authenticated;
grant select, insert, update, delete on public.goal_decisions to service_role;
grant select on public.goal_decisions to authenticated;
create policy coach_only on public.goal_decisions for select to authenticated using (private.assigned(workspace_id, athlete_id));

commit;
