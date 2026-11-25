-- D-175 : offre et essai gratuit de chaque espace (« De quoi vendre », D-120).
-- Additif : deux colonnes facultatives. Un espace sans essai ni offre est en phase pilote : gratuit, sans limite d'élèves.
-- L'essai n'est posé qu'à la création d'un espace quand l'interrupteur commercial (COACHOS_BILLING) est allumé ;
-- l'offre sera posée par l'abonnement (tranche suivante) ou, d'ici là, à la main par le fondateur.
begin;

alter table public.workspaces
  add column if not exists plan text check (plan is null or plan in ('starter', 'pro', 'elite')),
  add column if not exists trial_ends_at timestamptz;

comment on column public.workspaces.plan is 'Offre payée (docs/13) ; null : essai ou phase pilote (D-175).';
comment on column public.workspaces.trial_ends_at is 'Fin de l''essai gratuit ; null : pas d''essai (phase pilote) (D-175).';

commit;
