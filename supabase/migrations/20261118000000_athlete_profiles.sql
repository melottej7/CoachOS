-- Profil sportif déclaré par l’athlète (D-021). Une ligne par relation (espace + dossier) :
-- un athlète présent dans deux espaces remplit deux profils indépendants (C03-10).
-- Aucune donnée de santé : ni blessure, ni antécédent, ni poids (D11, docs/07_ARCHITECTURE.md).

begin;

create table public.athlete_profiles (
workspace_id uuid not null,
athlete_id uuid not null,
sport_code text not null references public.sports(code),
level text not null check (level in ('beginner','intermediate','advanced','competitive')),
experience text not null check (experience in ('lt1','1to3','3to5','gt5')),
weekly_sessions text not null check (weekly_sessions in ('0to1','2to3','4to5','6plus')),
weekly_hours text check (weekly_hours in ('lt2','2to4','4to6','6to10','gt10')),
available_days smallint[] not null default '{}' check (available_days <@ array[1,2,3,4,5,6,7]::smallint[]),
main_goal text check (length(main_goal) between 1 and 300),
next_event_name text check (length(next_event_name) between 1 and 120),
next_event_date date,
revision integer not null default 1 check (revision > 0),
updated_at timestamptz not null default now(),
primary key (workspace_id, athlete_id),
foreign key (workspace_id, athlete_id) references public.athletes(workspace_id, id)
);

alter table public.athlete_profiles enable row level security;

revoke all on public.athlete_profiles from anon, authenticated;

grant select, insert, update, delete on public.athlete_profiles to service_role;

grant select on public.athlete_profiles to authenticated;

-- Lecture : coach affecté ou athlète du dossier. Écriture : commande serveur uniquement.
create policy athlete_data on public.athlete_profiles for select to authenticated
using (private.assigned(workspace_id, athlete_id) or private.own_athlete(workspace_id, athlete_id));

commit;
