-- D-188 : abonnement Stripe en mode test, derrière l'interrupteur COACHOS_BILLING (éteint en production).
-- L'état du paiement d'un espace vit à part, lisible et modifiable par le seul serveur : ni le coach ni ses élèves ne le
-- lisent par l'API publique (identifiants Stripe compris). Le journal des événements Stripe évite de traiter deux fois
-- le même événement (Stripe renvoie un événement tant qu'il n'a pas eu de réponse). Additif.
begin;

create table public.workspace_billing (
workspace_id uuid primary key references public.workspaces(id),
stripe_customer_id text unique check (stripe_customer_id is null or stripe_customer_id ~ '^cus_[A-Za-z0-9]{1,250}$'),
subscription_id text unique check (subscription_id is null or subscription_id ~ '^sub_[A-Za-z0-9]{1,250}$'),
status text check (status is null or status in ('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused')),
current_period_end timestamptz,
-- Premier paiement refusé : début des 14 jours de grâce (docs/13) ; vidé quand le paiement passe.
past_due_since timestamptz,
updated_at timestamptz not null default now()
);
alter table public.workspace_billing enable row level security;
revoke all on public.workspace_billing from anon, authenticated;
grant select, insert, update, delete on public.workspace_billing to service_role;

create table public.billing_events (
id text primary key check (id ~ '^evt_[A-Za-z0-9]{1,250}$'),
type text not null check (length(type) between 1 and 80),
workspace_id uuid references public.workspaces(id),
received_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;
revoke all on public.billing_events from anon, authenticated;
grant select, insert, update, delete on public.billing_events to service_role;

commit;
