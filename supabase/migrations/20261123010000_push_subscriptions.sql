-- D-118 · Rappels push : un abonnement par appareil (navigateur) et par espace. Seules les clés publiques du
-- navigateur sont gardées ; l'envoi ne contient jamais le texte d'un message (comme les e-mails, D-067).
begin;
create table public.push_subscriptions (
  workspace_id uuid not null references public.workspaces(id),
  user_id uuid not null references public.users(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  endpoint text not null check (length(endpoint) between 1 and 2000),
  p256dh text not null check (length(p256dh) between 1 and 300),
  auth text not null check (length(auth) between 1 and 100),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  primary key (workspace_id, id),
  unique (workspace_id, user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;
grant select on public.push_subscriptions to authenticated;
create policy self_only on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create index push_subscriptions_by_user_idx on public.push_subscriptions (workspace_id, user_id);

alter table public.notifications
  add column push_state text not null default 'none' check (push_state in ('none','pending','sent','failed','skipped'));
create index notifications_push_pending_idx on public.notifications (push_state) where push_state = 'pending';
commit;
