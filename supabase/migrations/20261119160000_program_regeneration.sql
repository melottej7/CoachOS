-- D-063 : régénération partielle d’un programme. La révision écrite par le générateur est notée sur la séance :
-- si la révision de travail en diffère, le coach a retouché la séance et la régénération la protège.
begin;
alter table public.workouts
  add column generated_revision integer check (generated_revision is null or generated_revision > 0);
update public.workouts set generated_revision = 1 where plan_id is not null and generated_revision is null
  and exists (select 1 from public.plans p where p.workspace_id = workouts.workspace_id and p.id = workouts.plan_id and p.generator is not null);
commit;
