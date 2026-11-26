-- IA-1 (D-189) : dicter ou écrire une séance avec l'IA. Le brouillon est tracé dans ai_suggestions, module « dictation ».
-- IA-2 (D-190) : proposition de méthode depuis la bibliothèque, module « method » (sans élève).
-- IA-3 (D-191) : programme rédigé par l'agent, module « program » (élève, ou groupe : sans élève).
-- IA-5 (D-193) : photo ou PDF recopié (« import ») et consignes d'exercice (« exercise »), sans élève.
-- Additif : une dictée peut viser une séance sans élève (modèle de la bibliothèque, séance de groupe) et une méthode
-- ne vise aucun élève, d'où un élève facultatif ; la liste des modules s'élargit. Les lignes existantes ne changent pas ; l'ancien code reste valable.
begin;

alter table public.ai_suggestions alter column athlete_id drop not null;

alter table public.ai_suggestions drop constraint if exists ai_suggestions_module_check;
alter table public.ai_suggestions add constraint ai_suggestions_module_check
  check (module in ('summary','fatigue','anomaly','adaptation','feedback','alert','dictation','method','program','import','exercise'));

comment on column public.ai_suggestions.athlete_id is 'Élève visé ; null pour une dictée sans élève (modèle, séance de groupe) (D-189).';

commit;
