-- D-096 : musculation. Sport « strength », matériel de renforcement à la maison, bibliothèque d'exercices avec vidéo
-- (lien, ou court fichier filmé par le coach, gardé en privé et lu par les seuls membres de l'espace).
begin;

alter table public.sports drop constraint sports_code_check;
alter table public.sports add constraint sports_code_check
  check (code in ('running','trail','cycling','swimming','triathlon','duathlon','strength'));
insert into public.sports(code) values ('strength') on conflict do nothing;

alter table public.workspace_profiles drop constraint workspace_profiles_sports_check;
alter table public.workspace_profiles add constraint workspace_profiles_sports_check
  check (sports <@ array['running','trail','cycling','swimming','triathlon','duathlon','strength']);

alter table public.athlete_profiles drop constraint athlete_profiles_equipment_check;
alter table public.athlete_profiles add constraint athlete_profiles_equipment_check
  check (equipment <@ array['gps_watch','power_meter','home_trainer','road_bike','offroad_bike','treadmill','track','pool','open_water','gym',
                            'dumbbells','kettlebell','bands','pullup_bar','bench','mat']::text[]);

-- Vidéos filmées par le coach : octets à part, jamais lus directement par le client (route serveur après contrôle).
create table public.exercise_clips (
workspace_id uuid not null references public.workspaces(id),
id uuid not null default gen_random_uuid(),
owner_id uuid not null references public.users(id),
content_type text not null check (content_type in ('video/mp4','video/quicktime','video/webm')),
bytes bytea not null check (octet_length(bytes) between 1 and 26214400),
created_at timestamptz not null default now(),
primary key (workspace_id, id)
);
alter table public.exercise_clips enable row level security;
revoke all on public.exercise_clips from anon, authenticated;
grant select, insert, update, delete on public.exercise_clips to service_role;

create table public.exercises (
workspace_id uuid not null references public.workspaces(id),
id uuid not null default gen_random_uuid(),
owner_id uuid not null,
name text not null check (length(name) between 1 and 80),
instructions text check (instructions is null or length(instructions) between 1 and 1500),
muscle text not null default 'other' check (muscle in ('legs','push','pull','core','full','mobility','cardio','other')),
equipment text[] not null default '{}'
  check (equipment <@ array['bodyweight','dumbbells','kettlebell','barbell','bands','pullup_bar','bench','machine','mat']::text[]),
video_url text check (video_url is null or (length(video_url) <= 500 and video_url ~ '^https://')),
clip_id uuid,
starter boolean not null default false,
archived boolean not null default false,
revision integer not null default 1,
created_at timestamptz not null default now(),
primary key (workspace_id, id),
foreign key (workspace_id, owner_id) references public.memberships(workspace_id, user_id),
foreign key (workspace_id, clip_id) references public.exercise_clips(workspace_id, id)
);
create unique index exercises_name_idx on public.exercises (workspace_id, lower(name)) where not archived;
alter table public.exercises enable row level security;
revoke all on public.exercises from anon, authenticated;
grant select on public.exercises to authenticated;
grant select, insert, update, delete on public.exercises to service_role;
-- Lecture : le coach de l'espace et ses élèves (démonstrations, sans donnée personnelle). Écriture par commandes serveur.
create policy member on public.exercises for select to authenticated
  using (private.current_coach(workspace_id) or private.current_athlete(workspace_id));

commit;
