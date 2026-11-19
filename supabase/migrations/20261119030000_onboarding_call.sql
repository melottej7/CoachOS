-- D-038 : suivi automatique « Planifier l’appel de bienvenue » une fois le questionnaire reçu.
-- Seule la mise en attente est stockée ; le suivi se calcule depuis l’état réel (profil rempli, aucun rendez-vous).
alter table public.auto_task_states drop constraint auto_task_states_rule_check;
alter table public.auto_task_states add constraint auto_task_states_rule_check
  check (rule in ('feedback_review','no_upcoming','invite_pending','profile_missing','level_unconfirmed','vma_missing','message_reply','onboarding_call'));
