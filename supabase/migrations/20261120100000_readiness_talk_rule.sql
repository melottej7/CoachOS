-- D-089 : suivi automatique « En parler avec l’élève » quand il a répondu ne pas être à 100 % (D-088).
begin;
alter table public.auto_task_states drop constraint auto_task_states_rule_check;
alter table public.auto_task_states add constraint auto_task_states_rule_check
  check (rule in ('feedback_review','no_upcoming','invite_pending','profile_missing','level_unconfirmed','vma_missing','message_reply','onboarding_call','bilan_confirm','readiness_talk'));
alter table public.auto_rule_settings drop constraint auto_rule_settings_rule_check;
alter table public.auto_rule_settings add constraint auto_rule_settings_rule_check
  check (rule in ('feedback_review','no_upcoming','invite_pending','profile_missing','level_unconfirmed','vma_missing','message_reply','onboarding_call','bilan_confirm','readiness_talk'));
commit;
