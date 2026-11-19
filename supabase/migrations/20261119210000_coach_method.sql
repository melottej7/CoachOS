-- D-072 : méthode du coach (Coach DNA). La table coach_dna existait (schéma initial) sans être utilisée :
-- chaque enregistrement crée une version immuable ; la précédente passe « retired » (index unique déjà présent). On note pourquoi.
begin;
alter table public.coach_dna
  add column reason text check (reason is null or length(reason) between 1 and 120),
  add column created_by uuid;
commit;
