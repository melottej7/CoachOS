-- D-096 (M4) : séries et charges réalisées dans le retour d'une séance de musculation (exercice par exercice).
-- Forme vérifiée par le serveur (schéma du domaine) ; la base garantit un tableau de taille raisonnable.
begin;
alter table public.feedbacks
  add column strength_log jsonb not null default '[]'::jsonb
    check (jsonb_typeof(strength_log) = 'array' and jsonb_array_length(strength_log) <= 40);
commit;
