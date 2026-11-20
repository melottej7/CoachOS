-- D-090 : chrono d’un test (« Test 5 km » du générateur, D-086), saisi par l’élève dans son retour.
begin;
alter table public.feedbacks add column test_seconds integer check (test_seconds between 60 and 86400);
commit;
