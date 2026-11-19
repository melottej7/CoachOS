-- CE-H-04 (D-045) : réglage des suivis automatiques par coach : activé ou non, délai en jours.
-- Absence de ligne = réglage par défaut. Les suivis restent calculés depuis l’état réel.
create table public.auto_rule_settings (
  workspace_id uuid not null,
  coach_id uuid not null,
  rule text not null check (rule in ('feedback_review','no_upcoming','invite_pending','profile_missing','level_unconfirmed','vma_missing','message_reply','onboarding_call')),
  enabled boolean not null default true,
  delay_days smallint check (delay_days between 0 and 30),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, coach_id, rule),
  foreign key (workspace_id, coach_id) references public.memberships(workspace_id, user_id)
);

alter table public.auto_rule_settings enable row level security;
revoke all on public.auto_rule_settings from anon, authenticated;
grant select, insert, update, delete on public.auto_rule_settings to service_role;
grant select on public.auto_rule_settings to authenticated;
create policy own_rule_settings on public.auto_rule_settings for select to authenticated
using (private.current_coach(workspace_id) and coach_id = (select auth.uid()));
