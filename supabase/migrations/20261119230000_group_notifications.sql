-- D-076 : notifications des fils de groupe (complète D-067). Le groupe concerné est noté ; type « group_message ».
begin;
alter table public.notifications
  add column team_id uuid,
  add constraint notifications_team_fk foreign key (workspace_id, team_id) references public.teams(workspace_id, id),
  drop constraint notifications_kind,
  add constraint notifications_kind check (kind in ('workouts_published','message','feedback','bilan_submitted','group_message'));
commit;
