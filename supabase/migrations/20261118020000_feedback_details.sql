-- Retour enrichi (CE-C-02, D-025) : état « reporté », ressenti général 1 à 5, difficultés par catégorie.
-- Catégories fermées, non médicales (D11) : aucune saisie libre de santé dans ces champs.

begin;

alter table public.workout_results drop constraint workout_results_state_check;
alter table public.workout_results add constraint workout_results_state_check
  check (state in ('completed','partial','missed','postponed'));

alter table public.feedbacks
  add column overall_feeling smallint check (overall_feeling between 1 and 5),
  add column difficulties text[] not null default '{}'
    check (difficulties <@ array['fatigue','weather','terrain','gear','time','motivation','other']);

commit;
