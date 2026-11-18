-- Messagerie coach élève (CE-H-07, CE-E-02, CE-H-09, D-033). Migration additive.
-- Fil privé : tables du schéma de référence (conversations, messages, read_receipts).
-- Ajouts : fils de groupe, messages vocaux (stockage privé), règle de suivi « répondre au message ».
-- Écriture par commandes serveur uniquement ; lecture sous RLS.

begin;

-- Suivi automatique « répondre au message ».
alter table public.auto_task_states drop constraint auto_task_states_rule_check;
alter table public.auto_task_states add constraint auto_task_states_rule_check
  check (rule in ('feedback_review','no_upcoming','invite_pending','profile_missing','level_unconfirmed','vma_missing','message_reply'));

-- L’élève membre d’un groupe (fiche active liée à son compte). Les droits restent ceux des affectations :
-- appartenir à un groupe donne seulement accès au fil de ce groupe.
create function private.team_member(w uuid, t uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(
   select 1 from public.team_athletes ta join public.athletes a on a.workspace_id = ta.workspace_id and a.id = ta.athlete_id
   join public.teams tm on tm.workspace_id = ta.workspace_id and tm.id = ta.team_id
   where ta.workspace_id = w and ta.team_id = t and a.user_id = (select auth.uid()) and a.state = 'active' and tm.archived_at is null)
$$;
revoke all on function private.team_member(uuid, uuid) from public;
grant execute on function private.team_member(uuid, uuid) to authenticated;

-- Un élève voit le nom des groupes dont il est membre.
create policy member on public.teams for select to authenticated using (private.team_member(workspace_id, id));

-- Vocaux : octets stockés à part, jamais lus directement par le client (route serveur après contrôle du message).
create table public.voice_clips (
workspace_id uuid not null references public.workspaces(id),
id uuid not null default gen_random_uuid(),
sender_id uuid not null references public.users(id),
content_type text not null check (content_type in ('audio/webm','audio/ogg','audio/mp4')),
bytes bytea not null check (octet_length(bytes) between 1 and 3145728),
duration_s smallint not null check (duration_s between 1 and 180),
created_at timestamptz not null default now(),
primary key (workspace_id, id)
);
alter table public.voice_clips enable row level security;
revoke all on public.voice_clips from anon, authenticated;
grant select, insert, update, delete on public.voice_clips to service_role;

-- Message privé : texte ou vocal.
alter table public.messages
  add column voice_id uuid,
  add column voice_duration_s smallint check (voice_duration_s between 1 and 180),
  add constraint messages_voice_fk foreign key (workspace_id, voice_id) references public.voice_clips(workspace_id, id);

-- Fil de groupe.
create table public.team_messages (
workspace_id uuid not null,
id uuid not null default gen_random_uuid(),
team_id uuid not null,
sender_id uuid references public.users(id) on delete set null,
sender_name text not null check (length(sender_name) between 1 and 100),
sender_role text not null check (sender_role in ('coach','athlete')),
body text not null check (length(body) between 1 and 4000),
voice_id uuid,
voice_duration_s smallint check (voice_duration_s between 1 and 180),
created_at timestamptz not null default now(),
primary key (workspace_id, id),
foreign key (workspace_id, team_id) references public.teams(workspace_id, id),
foreign key (workspace_id, voice_id) references public.voice_clips(workspace_id, id)
);
create index team_messages_thread_idx on public.team_messages (workspace_id, team_id, created_at, id);
alter table public.team_messages enable row level security;
revoke all on public.team_messages from anon, authenticated;
grant select, insert, update, delete on public.team_messages to service_role;
grant select on public.team_messages to authenticated;
create policy team_thread on public.team_messages for select to authenticated
using (private.current_coach(workspace_id) or private.team_member(workspace_id, team_id));

create table public.team_reads (
workspace_id uuid not null,
team_id uuid not null,
user_id uuid not null references public.users(id),
read_through_at timestamptz not null,
primary key (workspace_id, team_id, user_id),
foreign key (workspace_id, team_id) references public.teams(workspace_id, id)
);
alter table public.team_reads enable row level security;
revoke all on public.team_reads from anon, authenticated;
grant select, insert, update, delete on public.team_reads to service_role;
grant select on public.team_reads to authenticated;
create policy self on public.team_reads for select to authenticated using (user_id = (select auth.uid()));

commit;
