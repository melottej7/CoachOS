-- D-074 : blocs réutilisables (échauffement type, série type…) dans la bibliothèque du coach.
-- Même table que les séances et semaines types : templates, kind = 'block', payload { sport, blocks }.
begin;
alter table public.templates drop constraint templates_kind_check;
alter table public.templates add constraint templates_kind_check check (kind in ('workout','week','block'));
commit;
