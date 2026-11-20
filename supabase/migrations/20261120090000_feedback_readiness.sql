-- D-088 : « Peux-tu faire tes séances à 100 % en ce moment ? » (instruction du fondateur, version sans le corps).
-- Trois réponses fermées, aucune cause demandée ni enregistrée : ce n’est pas une donnée de santé (D-084).
begin;
alter table public.feedbacks
  add column readiness text check (readiness in ('full','not_quite','no'));
commit;
