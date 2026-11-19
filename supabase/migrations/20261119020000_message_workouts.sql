-- Messages à propos d’une séance (D-036) : un message peut citer la séance dont il parle.
-- La séance appartient au même élève (clé étrangère) ; l’élève ne peut citer qu’une séance publiée (commande).

begin;

alter table public.messages
  add column workout_id uuid,
  add constraint messages_workout_fk foreign key (workspace_id, athlete_id, workout_id) references public.workouts(workspace_id, athlete_id, id);

create index messages_by_workout_idx on public.messages (workspace_id, athlete_id, workout_id) where workout_id is not null;

commit;
