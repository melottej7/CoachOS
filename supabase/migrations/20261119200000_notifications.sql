-- D-067 : notifications personnelles (centre dans l'application) et e-mails courts sans contenu de message.
-- La table existait (schéma initial) sans être utilisée : on la complète. Écriture par les commandes serveur seulement.
begin;
alter table public.notifications
  add column athlete_id uuid,
  add column item_count integer not null default 1 check (item_count between 1 and 1000),
  add column email_state text not null default 'none' check (email_state in ('none','pending','sent','failed','skipped')),
  add column emailed_at timestamptz,
  add constraint notifications_kind check (kind in ('workouts_published','message','feedback','bilan_submitted')),
  add constraint notifications_athlete_fk foreign key (workspace_id, athlete_id) references public.athletes(workspace_id, id);
create index notifications_email_pending_idx on public.notifications (email_state) where email_state = 'pending';

create table public.notification_settings (
  workspace_id uuid not null references public.workspaces(id),
  user_id uuid not null references public.users(id),
  email text not null default 'essentials' check (email in ('essentials','none')),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
alter table public.notification_settings enable row level security;
revoke all on public.notification_settings from anon, authenticated;
grant select, insert, update, delete on public.notification_settings to service_role;
grant select on public.notification_settings to authenticated;
create policy self_only on public.notification_settings for select to authenticated using (user_id = (select auth.uid()));
commit;
