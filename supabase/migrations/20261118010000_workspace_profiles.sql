-- Présentation de l’espace coach (D-022) : visible par les coachs et athlètes de l’espace,
-- et par une personne invitée (aperçu par jeton, côté serveur). Aucune donnée d’athlète.

begin;

create table public.workspace_profiles (
workspace_id uuid primary key references public.workspaces(id),
tagline text check (length(tagline) between 1 and 120),
bio text check (length(bio) between 1 and 1500),
approach text check (length(approach) between 1 and 1000),
experience_years smallint check (experience_years between 0 and 60),
certifications text[] not null default '{}' check (cardinality(certifications) <= 10),
sports text[] not null default '{}' check (sports <@ array['running','trail','cycling','swimming','triathlon','duathlon']),
audiences text[] not null default '{}' check (audiences <@ array['beginner','intermediate','advanced','competitive']),
goals text[] not null default '{}' check (goals <@ array['5k10k','half','marathon','trail','ultra','tri_short','tri_long','bike','swim','comeback']),
city text check (length(city) between 1 and 80),
languages text[] not null default '{}' check (languages <@ array['fr','en','nl','de','es','it']),
website_url text check (length(website_url) <= 200 and website_url like 'https://%'),
social_url text check (length(social_url) <= 200 and social_url like 'https://%'),
contact_email text check (length(contact_email) <= 254),
accent text not null default 'emerald' check (accent in ('emerald','ocean','sunset','berry','slate','forest')),
revision integer not null default 1 check (revision > 0),
updated_at timestamptz not null default now()
);

alter table public.workspace_profiles enable row level security;
revoke all on public.workspace_profiles from anon, authenticated;
grant select, insert, update, delete on public.workspace_profiles to service_role;
grant select on public.workspace_profiles to authenticated;
create policy workspace_members on public.workspace_profiles for select to authenticated
using (private.current_coach(workspace_id) or private.current_athlete(workspace_id));

-- Logo ou photo du coach : petite image (PNG, JPEG ou WebP, 512 Kio au plus), servie par le serveur.
create table public.workspace_logos (
workspace_id uuid primary key references public.workspaces(id),
content_type text not null check (content_type in ('image/png','image/jpeg','image/webp')),
bytes bytea not null check (octet_length(bytes) between 1 and 524288),
updated_at timestamptz not null default now()
);

alter table public.workspace_logos enable row level security;
revoke all on public.workspace_logos from anon, authenticated;
grant select, insert, update, delete on public.workspace_logos to service_role;

commit;
