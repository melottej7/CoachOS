-- Équivalent local minimal de ce que Supabase fournit avant nos migrations.
-- Appliqué uniquement sur PGlite (développement et tests). Jamais sur un projet Supabase.
-- auth.uid() lit le même réglage que Supabase : request.jwt.claim.sub.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;

create table auth.users (
  id uuid primary key,
  email text unique,
  created_at timestamptz not null default now()
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  name text not null,
  applied_at timestamptz not null default now()
);
