-- D-048 (CE-X-02) : provenance des mesures d’un retour. null = saisies à la main ; sinon, lues dans un fichier
-- d’activité (lu dans le navigateur de l’élève, jamais envoyé ni conservé). Seules durée et distance en sont tirées.
alter table public.workout_results
  add column measure_file text check (measure_file in ('fit', 'tcx', 'gpx'));
