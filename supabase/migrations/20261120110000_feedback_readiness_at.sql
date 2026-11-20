-- D-089 : moment de la réponse « à 100 % ? » (une correction du retour peut la changer plus tard).
begin;
alter table public.feedbacks add column readiness_at timestamptz;
update public.feedbacks set readiness_at = created_at where readiness is not null and readiness_at is null;
commit;
