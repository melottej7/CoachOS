-- D-173 : vidéos filmées par le coach dans le stockage de fichiers Supabase (compartiment privé « exercise-videos »).
-- Le téléphone du coach envoie la vidéo directement au stockage (plus de limite de 4,5 Mo imposée par Vercel) ;
-- l'élève la lit par un lien signé de courte durée, délivré par CoachOS après contrôle de ses droits.
-- Les vidéos déjà enregistrées en base restent lues telles quelles. Additif : l'ancien code écrit toujours des octets.
begin;

alter table public.exercise_clips alter column bytes drop not null;
alter table public.exercise_clips
  add column object_path text,
  add column size_bytes integer check (size_bytes is null or size_bytes between 1 and 52428800),
  -- Le fichier est soit en base (octets), soit dans le stockage, à l'adresse « espace/vidéo » et nulle part ailleurs.
  add constraint exercise_clips_one_source check ((bytes is null) <> (object_path is null)),
  add constraint exercise_clips_object_path check (object_path is null or object_path = workspace_id::text || '/' || id::text);

-- Compartiment privé : aucune règle d'accès pour les clients ; seul le serveur (clé de service) signe les envois et les lectures.
-- Absent des bases de test (PGlite), qui gardent les vidéos en base.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('exercise-videos', 'exercise-videos', false, 52428800, array['video/mp4', 'video/quicktime', 'video/webm'])
    on conflict (id) do nothing;
  end if;
end $$;

commit;
