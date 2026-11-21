-- D-104 : modèles de relance propres à chaque coach (un par situation), à la place de ceux de CoachOS.
begin;
create table public.relance_templates (
workspace_id uuid not null references public.workspaces(id),
coach_id uuid not null,
kind text not null check (kind in ('silent','readiness','missed','no_feedback','bravo')),
body text not null check (length(body) between 1 and 1000),
updated_at timestamptz not null default now(),
primary key (workspace_id, coach_id, kind),
foreign key (workspace_id, coach_id) references public.memberships(workspace_id, user_id)
);
alter table public.relance_templates enable row level security;
revoke all on public.relance_templates from anon, authenticated;
grant select on public.relance_templates to authenticated;
grant select, insert, update, delete on public.relance_templates to service_role;
-- Chaque coach ne lit que ses modèles ; écriture par commande serveur.
create policy own on public.relance_templates for select to authenticated
  using (coach_id = (select auth.uid()) and private.current_coach(workspace_id));
commit;
