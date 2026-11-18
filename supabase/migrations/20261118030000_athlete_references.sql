-- Repères d’entraînement de l’athlète, fixés par le coach affecté (CE-B-03, D-029).
-- Première brique : VMA (course) pour estimer allures et distances par zone. Les autres seuils
-- (FTP, CSS, FC seuil) viendront par migration additive. Aucune donnée de santé.

begin;

create table public.athlete_references (
workspace_id uuid not null,
athlete_id uuid not null,
vma_kmh numeric(3,1) check (vma_kmh between 6 and 30),
revision integer not null default 1 check (revision > 0),
updated_by uuid not null,
updated_at timestamptz not null default now(),
primary key (workspace_id, athlete_id),
foreign key (workspace_id, athlete_id) references public.athletes(workspace_id, id)
);

alter table public.athlete_references enable row level security;

revoke all on public.athlete_references from anon, authenticated;

grant select, insert, update, delete on public.athlete_references to service_role;

grant select on public.athlete_references to authenticated;

-- Lecture : coach affecté ou athlète du dossier. Écriture : commande serveur du coach affecté.
create policy athlete_data on public.athlete_references for select to authenticated
using (private.assigned(workspace_id, athlete_id) or private.own_athlete(workspace_id, athlete_id));

commit;
