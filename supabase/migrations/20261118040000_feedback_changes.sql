-- Séance faite autrement (CE-E-05, D-031) : ce qui a changé, sport réellement pratiqué,
-- répétitions faites par série. Catégories fermées, non médicales (D11). Migration additive.

begin;

alter table public.feedbacks
  add column changes text[] not null default '{}'
    check (changes <@ array['shorter','fewer_reps','easier','harder','other_route','other_sport','stopped']),
  add column actual_sport text references public.sports(code),
  add column repeats_done smallint[] not null default '{}'
    check (cardinality(repeats_done) <= 30 and 0 <= all(repeats_done) and 50 >= all(repeats_done));

commit;
