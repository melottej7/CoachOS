-- Rendez-vous annoncés dans la conversation (D-034) : un message peut porter une carte de rendez-vous.
-- L’élève voit la carte (date, heure, durée, lien, état) par son message ; la préparation et le compte rendu
-- restent réservés au coach. Migration additive.

begin;

alter table public.messages
  add column appointment_id uuid,
  add constraint messages_appointment_fk foreign key (workspace_id, appointment_id) references public.appointments(workspace_id, id);

create index messages_by_appointment_idx on public.messages (workspace_id, appointment_id) where appointment_id is not null;

commit;
