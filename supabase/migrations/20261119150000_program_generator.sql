-- D-061 : programme généré pour un objectif validé par le coach (D-058). Le programme garde le lien avec l’objectif,
-- les paramètres utilisés et les risques signalés au coach au moment de la création. Les séances sont des brouillons
-- reliés au programme (workouts.plan_id) ; les phases (tremplin, développement, affûtage) sont des plan_blocks.
begin;
alter table public.plans
  add column goal_id uuid,
  add column generator jsonb check (generator is null or jsonb_typeof(generator) = 'object'),
  add column created_by uuid,
  add constraint plans_goal_fk foreign key (workspace_id, goal_id) references public.goals(workspace_id, id);
alter table public.plan_blocks
  add column phase text check (phase in ('tremplin','developpement','recuperation','affutage'));
commit;
