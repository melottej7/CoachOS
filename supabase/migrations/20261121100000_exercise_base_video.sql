-- D-099 : vidéo de base CoachOS quand le coach n'a pas mis la sienne. Clé stable de l'exercice de départ d'origine
-- (le coach peut le renommer) et choix du coach, exercice par exercice. Rien n'est retiré.
begin;
alter table public.exercises
  add column starter_key text check (starter_key is null or starter_key ~ '^[a-z0-9-]{1,80}$'),
  add column use_base_video boolean not null default true;
update public.exercises e set starter_key = k.key
from (values
  ('Squat','squat'),
  ('Squat goblet','squat-goblet'),
  ('Fentes avant','fentes-avant'),
  ('Fentes arrière','fentes-arriere'),
  ('Fente bulgare','fente-bulgare'),
  ('Pont fessier','pont-fessier'),
  ('Hip thrust','hip-thrust'),
  ('Soulevé de terre jambes tendues','souleve-de-terre-jambes-tendues'),
  ('Montées de mollets','montees-de-mollets'),
  ('Step-up sur banc','step-up-sur-banc'),
  ('Pompes','pompes'),
  ('Développé couché haltères','developpe-couche-halteres'),
  ('Développé militaire','developpe-militaire'),
  ('Dips sur banc','dips-sur-banc'),
  ('Élévations latérales','elevations-laterales'),
  ('Tractions','tractions'),
  ('Rowing haltère un bras','rowing-haltere-un-bras'),
  ('Rowing élastique','rowing-elastique'),
  ('Tirage face pull','tirage-face-pull'),
  ('Curl biceps','curl-biceps'),
  ('Planche','planche'),
  ('Planche latérale','planche-laterale'),
  ('Dead bug','dead-bug'),
  ('Bird dog','bird-dog'),
  ('Mountain climbers','mountain-climbers'),
  ('Crunch','crunch'),
  ('Kettlebell swing','kettlebell-swing'),
  ('Burpees','burpees'),
  ('Thruster','thruster'),
  ('Corde à sauter','corde-a-sauter'),
  ('Jumping jacks','jumping-jacks'),
  ('Mobilité des hanches 90/90','mobilite-des-hanches-90-90'),
  ('Étirement des fléchisseurs de hanche','etirement-des-flechisseurs-de-hanche'),
  ('Chat-vache','chat-vache')
) as k(name, key)
where e.starter and e.starter_key is null and lower(e.name) = lower(k.name);
commit;
