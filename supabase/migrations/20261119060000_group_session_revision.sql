-- D-046 : la base commune d’une séance de groupe est modifiable ; révision pour refuser une modification concurrente.
alter table public.group_sessions add column revision integer not null default 1 check (revision >= 1);
alter table public.group_sessions add column updated_at timestamptz not null default now();
