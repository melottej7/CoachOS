-- D-055 (CE-B-03) : seuils de l’élève pour le vélo (FTP, watts) et la natation (CSS, secondes pour 100 m).
-- Fixés par le coach affecté, lus par l’élève. Migration additive. Pas de fréquence cardiaque (décision santé en attente, D11).
alter table public.athlete_references
  add column ftp_w smallint check (ftp_w between 50 and 600),
  add column css_sec_per_100 smallint check (css_sec_per_100 between 50 and 300);
