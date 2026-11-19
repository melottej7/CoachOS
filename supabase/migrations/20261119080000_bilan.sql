-- D-054 (CE-B-04, CE-B-05) : bilan d’arrivée. Questions inspirées de Foulée (pratique réelle, arrêt, reprise),
-- brouillon sur le serveur, confirmation par le coach, provenance de chaque réponse (déclaré ou entretien).
-- Aucune donnée de santé (D11). Migration additive : les profils existants restent valides (statut « envoyé »).

begin;

alter table public.athlete_profiles
  add column practice_status text check (practice_status in ('regular','resumed','stopped','beginner')),
  add column break_length text check (break_length in ('lt1m','1to3m','3to6m','6to12m','1to3y','gt3y')),
  add column resumed_since text check (resumed_since in ('lt1m','1to3m','gt3m')),
  add column longest_recent text check (longest_recent in ('lt20','20to30','30to45','45to60','60to90','90to120','gt120')),
  add column status text not null default 'submitted' check (status in ('submitted','confirmed')),
  add column confirmed_at timestamptz,
  add column confirmed_by uuid,
  add column sources jsonb not null default '{}'::jsonb check (jsonb_typeof(sources) = 'object');

-- Brouillon du bilan : une ligne par dossier, écrit par l’élève, lisible par lui et par le coach affecté (complétude).
create table public.athlete_profile_drafts (
  workspace_id uuid not null,
  athlete_id uuid not null,
  step text not null check (length(step) between 1 and 20),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, athlete_id),
  foreign key (workspace_id, athlete_id) references public.athletes(workspace_id, id)
);

alter table public.athlete_profile_drafts enable row level security;
revoke all on public.athlete_profile_drafts from anon, authenticated;
grant select, insert, update, delete on public.athlete_profile_drafts to service_role;
grant select on public.athlete_profile_drafts to authenticated;
create policy athlete_data on public.athlete_profile_drafts for select to authenticated
using (private.assigned(workspace_id, athlete_id) or private.own_athlete(workspace_id, athlete_id));

commit;
