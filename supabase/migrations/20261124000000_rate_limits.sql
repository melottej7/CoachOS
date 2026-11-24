-- D-162 · Limitation des abus sur les routes publiques (connexion, inscription, mot de passe oublié, invitation).
-- Compteurs par fenêtre fixe. Sur Vercel, c'est le serveur qui appelle Supabase Auth : ses propres limites voient la
-- même adresse pour tout le monde. Ces compteurs, eux, distinguent chaque visiteur.
-- Additive : une table dans le schéma private (jamais exposé par l'API de Supabase), aucun droit pour anon ni
-- authenticated. La clé est une empreinte (HMAC), jamais une adresse IP ni un e-mail en clair ; les lignes de plus
-- de deux jours sont purgées par le serveur.
begin;
create table private.rate_hits (
  bucket text not null check (length(bucket) between 1 and 40),
  key_hash text not null check (length(key_hash) between 16 and 64),
  window_start timestamptz not null,
  hits integer not null default 1 check (hits > 0),
  primary key (bucket, key_hash, window_start)
);
revoke all on private.rate_hits from public, anon, authenticated;
create index rate_hits_window_idx on private.rate_hits (window_start);
commit;
