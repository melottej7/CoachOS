-- D-108 : bilan multisport (autres sports que le principal) et ce que l'élève veut travailler en musculation.
begin;
alter table public.athlete_profiles
  add column other_sports text[] not null default '{}'
    check (other_sports <@ array['running','trail','cycling','swimming','triathlon','duathlon','strength']::text[]),
  add column strength_focus text[] not null default '{}'
    check (strength_focus <@ array['general','strength','muscle','sport_prep','mobility','fitness']::text[]);
commit;
