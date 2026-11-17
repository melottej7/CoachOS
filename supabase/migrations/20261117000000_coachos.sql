-- CoachOS cible, nouveau projet Supabase uniquement. Ne pas appliquer à Foulée.

begin;

create schema if not exists private;

revoke all on schema private from public;

grant usage on schema private to authenticated;

create table public.users (
id uuid primary key references auth.users(id) on delete cascade,
display_name text not null check (length(display_name) between 1 and 100),
locale text not null default 'fr' check (locale in ('fr','en')),
created_at timestamptz not null default now()
);

alter table public.users enable row level security;

revoke all on public.users from anon, authenticated;

grant select, insert, update, delete on public.users to service_role;

create table public.workspaces (
id uuid primary key default gen_random_uuid(),
name text not null check (length(name) between 1 and 120),
time_zone text not null,
status text not null default 'active' check (status in ('active','read_only','closed')),
created_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

revoke all on public.workspaces from anon, authenticated;

grant select, insert, update, delete on public.workspaces to service_role;

create table public.memberships (
workspace_id uuid not null references public.workspaces(id),
user_id uuid not null references public.users(id),
role text not null check (role in ('owner','coach')),
active boolean not null default true,
created_at timestamptz not null default now(),
primary key(workspace_id,user_id)
);

alter table public.memberships enable row level security;

revoke all on public.memberships from anon, authenticated;

grant select, insert, update, delete on public.memberships to service_role;

create index memberships_by_user_idx on public.memberships (user_id, workspace_id);

create table public.athletes (
workspace_id uuid not null references public.workspaces(id),
id uuid not null default gen_random_uuid(),
user_id uuid references public.users(id) on delete set null,
display_name text not null check(length(display_name) between 1 and 100),
time_zone text not null,
state text not null check(state in ('invited','active','archived')),
created_at timestamptz not null default now(),
primary key(workspace_id,id), unique(workspace_id,user_id)
);

alter table public.athletes enable row level security;

revoke all on public.athletes from anon, authenticated;

grant select, insert, update, delete on public.athletes to service_role;

create index athletes_by_user_idx on public.athletes (user_id, workspace_id);

create index athletes_roster_idx on public.athletes (workspace_id,state,display_name,id);

create table public.coach_assignments (
workspace_id uuid not null,
athlete_id uuid not null,
coach_id uuid not null,
starts_at timestamptz not null default now(),
ends_at timestamptz,
created_at timestamptz not null default now(),
primary key(workspace_id,athlete_id,coach_id), foreign key(workspace_id,athlete_id) references public.athletes(workspace_id,id), foreign key(workspace_id,coach_id) references public.memberships(workspace_id,user_id), check(ends_at is null or ends_at>starts_at)
);

alter table public.coach_assignments enable row level security;

revoke all on public.coach_assignments from anon, authenticated;

grant select, insert, update, delete on public.coach_assignments to service_role;

create index coach_assignments_by_coach_idx on public.coach_assignments (workspace_id,coach_id,athlete_id);

create table public.invitations (
workspace_id uuid not null,
athlete_id uuid not null,
id uuid not null default gen_random_uuid(),
secret_hash bytea not null unique,
email_hmac bytea not null,
expires_at timestamptz not null,
used_at timestamptz,
revoked_at timestamptz,
created_at timestamptz not null default now(),
primary key(workspace_id,id), foreign key(workspace_id,athlete_id) references public.athletes(workspace_id,id)
);

alter table public.invitations enable row level security;

revoke all on public.invitations from anon, authenticated;

grant select, insert, update, delete on public.invitations to service_role;

create index invitations_by_athlete_idx on public.invitations (workspace_id,athlete_id);

create table public.teams (
workspace_id uuid not null references public.workspaces(id),
id uuid not null default gen_random_uuid(),
name text not null,
created_at timestamptz not null default now(),
primary key(workspace_id,id), unique(workspace_id,name)
);

alter table public.teams enable row level security;

revoke all on public.teams from anon, authenticated;

grant select, insert, update, delete on public.teams to service_role;

create table public.team_athletes (
workspace_id uuid not null,
team_id uuid not null,
athlete_id uuid not null,
created_at timestamptz not null default now(),
primary key(workspace_id,team_id,athlete_id), foreign key(workspace_id,team_id) references public.teams(workspace_id,id), foreign key(workspace_id,athlete_id) references public.athletes(workspace_id,id)
);

alter table public.team_athletes enable row level security;

revoke all on public.team_athletes from anon, authenticated;

grant select, insert, update, delete on public.team_athletes to service_role;

create index team_athletes_by_athlete_idx on public.team_athletes (workspace_id,athlete_id);

create table public.sports (
code text primary key check(code in ('running','trail','cycling','swimming','triathlon','duathlon'))
);

alter table public.sports enable row level security;

revoke all on public.sports from anon, authenticated;

grant select, insert, update, delete on public.sports to service_role;

create table public.goals (
workspace_id uuid not null,
athlete_id uuid not null,
id uuid not null default gen_random_uuid(),
sport_code text not null references public.sports(code),
title text not null,
target_date date,
state text not null check(state in ('planned','achieved','canceled')),
created_at timestamptz not null default now(),
primary key(workspace_id,id), foreign key(workspace_id,athlete_id) references public.athletes(workspace_id,id)
);

alter table public.goals enable row level security;

revoke all on public.goals from anon, authenticated;

grant select, insert, update, delete on public.goals to service_role;

create index goals_by_athlete_idx on public.goals (workspace_id,athlete_id,target_date);

create index goals_by_sport_idx on public.goals (sport_code);

create table public.plans (
workspace_id uuid not null,
athlete_id uuid not null,
id uuid not null default gen_random_uuid(),

title text not null,
starts_on date not null,
ends_on date not null check(ends_on >= starts_on),
revision integer not null default 1 check(revision > 0),
created_at timestamptz not null default now(),
primary key(workspace_id,id), unique(workspace_id,athlete_id,id), foreign key(workspace_id,athlete_id) references public.athletes(workspace_id,id)
);

alter table public.plans enable row level security;

revoke all on public.plans from anon, authenticated;

grant select, insert, update, delete on public.plans to service_role;

create index plans_athlete_dates_idx on public.plans (workspace_id,athlete_id,starts_on);

create table public.plan_blocks (
workspace_id uuid not null,
athlete_id uuid not null,
id uuid not null default gen_random_uuid(),

plan_id uuid not null,
title text not null,
starts_on date not null,
ends_on date not null check(ends_on >= starts_on),
created_at timestamptz not null default now(),
primary key(workspace_id,id), unique(workspace_id,athlete_id,id), foreign key(workspace_id,athlete_id) references public.athletes(workspace_id,id), foreign key(workspace_id,athlete_id,plan_id) references public.plans(workspace_id,athlete_id,id)
);

alter table public.plan_blocks enable row level security;

revoke all on public.plan_blocks from anon, authenticated;

grant select, insert, update, delete on public.plan_blocks to service_role;

create index plan_blocks_by_plan_idx on public.plan_blocks (workspace_id,athlete_id,plan_id);

create table public.workouts (
workspace_id uuid not null,
athlete_id uuid not null,
id uuid not null default gen_random_uuid(),

plan_id uuid,
working_revision integer not null default 1 check(working_revision>0),
published_revision integer check(published_revision>0),
created_at timestamptz not null default now(),
primary key(workspace_id,id), unique(workspace_id,athlete_id,id), foreign key(workspace_id,athlete_id) references public.athletes(workspace_id,id), foreign key(workspace_id,athlete_id,plan_id) references public.plans(workspace_id,athlete_id,id)
);

alter table public.workouts enable row level security;

revoke all on public.workouts from anon, authenticated;

grant select, insert, update, delete on public.workouts to service_role;

create index workouts_by_plan_idx on public.workouts (workspace_id,athlete_id,plan_id);

create table public.workout_revisions (
workspace_id uuid not null,
athlete_id uuid not null,
workout_id uuid not null,
number integer not null check(number>0),
local_date date not null,
sort_order integer not null default 0 check(sort_order>=0),
time_zone text not null,
sport_code text not null references public.sports(code),
title text not null check(length(title) between 1 and 120),
instructions text not null default '' check(length(instructions)<=5000),
duration_seconds integer check(duration_seconds between 1 and 86400),
distance_m integer check(distance_m between 1 and 1000000),
intervals jsonb not null default '[]' check(jsonb_typeof(intervals)='array'),
canceled boolean not null default false,
cancellation_reason text,
created_at timestamptz not null default now(),
primary key(workspace_id,athlete_id,workout_id,number), foreign key(workspace_id,athlete_id,workout_id) references public.workouts(workspace_id,athlete_id,id), check(not canceled or cancellation_reason is not null)
);

alter table public.workout_revisions enable row level security;

revoke all on public.workout_revisions from anon, authenticated;

grant select, insert, update, delete on public.workout_revisions to service_role;

create index workout_revisions_calendar_idx on public.workout_revisions (workspace_id,athlete_id,local_date,sort_order,workout_id);

create index workout_revisions_by_sport_idx on public.workout_revisions (sport_code);

create table public.templates (
workspace_id uuid not null references public.workspaces(id),
id uuid not null default gen_random_uuid(),
owner_id uuid not null,
kind text not null check(kind in ('workout','week')),
title text not null,
payload jsonb not null check(jsonb_typeof(payload)='object'),
shared boolean not null default false,
archived boolean not null default false,
revision integer not null default 1,
created_at timestamptz not null default now(),
primary key(workspace_id,id), foreign key(workspace_id,owner_id) references public.memberships(workspace_id,user_id)
);

alter table public.templates enable row level security;

revoke all on public.templates from anon, authenticated;

grant select, insert, update, delete on public.templates to service_role;

create index templates_by_owner_idx on public.templates (workspace_id,owner_id,archived);

create table public.workout_results (
workspace_id uuid not null,
athlete_id uuid not null,
id uuid not null default gen_random_uuid(),

workout_id uuid not null,
workout_revision integer not null,
state text not null check(state in ('completed','partial','missed')),
duration_seconds integer check(duration_seconds between 1 and 86400),
distance_m integer check(distance_m between 1 and 1000000),
source text not null check(source in ('manual','authorized_direct','legacy_unknown')),
revision integer not null default 1,
created_at timestamptz not null default now(),
primary key(workspace_id,id), unique(workspace_id,athlete_id,id), foreign key(workspace_id,athlete_id) references public.athletes(workspace_id,id), foreign key(workspace_id,athlete_id,workout_id,workout_revision) references public.workout_revisions(workspace_id,athlete_id,workout_id,number), unique(workspace_id,athlete_id,workout_id)
);

alter table public.workout_results enable row level security;

revoke all on public.workout_results from anon, authenticated;

grant select, insert, update, delete on public.workout_results to service_role;

create index workout_results_by_workout_rev_idx on public.workout_results (workspace_id,athlete_id,workout_id,workout_revision);

create table public.feedbacks (
workspace_id uuid not null,
athlete_id uuid not null,
id uuid not null default gen_random_uuid(),

result_id uuid not null,
rpe smallint check(rpe between 0 and 10),
comment text check(length(comment)<=1000),
revision integer not null default 1,
reviewed_at timestamptz,
created_at timestamptz not null default now(),
primary key(workspace_id,id), unique(workspace_id,athlete_id,id), foreign key(workspace_id,athlete_id) references public.athletes(workspace_id,id), foreign key(workspace_id,athlete_id,result_id) references public.workout_results(workspace_id,athlete_id,id), unique(workspace_id,athlete_id,result_id)
);

alter table public.feedbacks enable row level security;

revoke all on public.feedbacks from anon, authenticated;

grant select, insert, update, delete on public.feedbacks to service_role;

create index feedbacks_review_idx on public.feedbacks (workspace_id,athlete_id,reviewed_at);

create table public.coach_notes (
workspace_id uuid not null,
athlete_id uuid not null,
id uuid not null default gen_random_uuid(),

author_id uuid not null,
body text not null check(length(body) between 1 and 2000),
created_at timestamptz not null default now(),
primary key(workspace_id,id), unique(workspace_id,athlete_id,id), foreign key(workspace_id,athlete_id) references public.athletes(workspace_id,id), foreign key(workspace_id,author_id) references public.memberships(workspace_id,user_id)
);

alter table public.coach_notes enable row level security;

revoke all on public.coach_notes from anon, authenticated;

grant select, insert, update, delete on public.coach_notes to service_role;

create index coach_notes_by_author_idx on public.coach_notes (workspace_id,author_id);

create table public.conversations (
workspace_id uuid not null,
athlete_id uuid not null,
id uuid not null default gen_random_uuid(),

last_activity_at timestamptz,
created_at timestamptz not null default now(),
primary key(workspace_id,id), unique(workspace_id,athlete_id,id), foreign key(workspace_id,athlete_id) references public.athletes(workspace_id,id), unique(workspace_id,athlete_id)
);

alter table public.conversations enable row level security;

revoke all on public.conversations from anon, authenticated;

grant select, insert, update, delete on public.conversations to service_role;

create index conversations_inbox_idx on public.conversations (workspace_id,last_activity_at desc,id);

create table public.messages (
workspace_id uuid not null,
athlete_id uuid not null,
id uuid not null default gen_random_uuid(),

conversation_id uuid not null,
sender_id uuid references public.users(id) on delete set null,
body text not null check(length(body) between 1 and 4000),
created_at timestamptz not null default now(),
primary key(workspace_id,id), unique(workspace_id,athlete_id,id), foreign key(workspace_id,athlete_id) references public.athletes(workspace_id,id), foreign key(workspace_id,athlete_id,conversation_id) references public.conversations(workspace_id,athlete_id,id)
);

alter table public.messages enable row level security;

revoke all on public.messages from anon, authenticated;

grant select, insert, update, delete on public.messages to service_role;

create index messages_thread_idx on public.messages (workspace_id,athlete_id,conversation_id,created_at,id);

create index messages_by_sender_idx on public.messages (sender_id);

create table public.read_receipts (
workspace_id uuid not null,
athlete_id uuid not null,
conversation_id uuid not null,
user_id uuid not null references public.users(id),
read_through_at timestamptz not null,
read_through_id uuid not null,
created_at timestamptz not null default now(),
primary key(workspace_id,conversation_id,user_id), foreign key(workspace_id,athlete_id,conversation_id) references public.conversations(workspace_id,athlete_id,id)
);

alter table public.read_receipts enable row level security;

revoke all on public.read_receipts from anon, authenticated;

grant select, insert, update, delete on public.read_receipts to service_role;

create index read_receipts_by_identity_idx on public.read_receipts (user_id,workspace_id);

create index read_receipts_by_thread_idx on public.read_receipts (workspace_id,athlete_id,conversation_id);

create table public.review_items (
workspace_id uuid not null,
athlete_id uuid not null,
id uuid not null default gen_random_uuid(),

kind text not null check(kind in ('feedback','attention','review','manual')),
state text not null check(state in ('open','snoozed','done')),
source_ref uuid not null,
due_at timestamptz,
rank smallint not null check(rank between 0 and 3),
created_at timestamptz not null default now(),
primary key(workspace_id,id), unique(workspace_id,athlete_id,id), foreign key(workspace_id,athlete_id) references public.athletes(workspace_id,id), unique(workspace_id,athlete_id,kind,source_ref)
);

alter table public.review_items enable row level security;

revoke all on public.review_items from anon, authenticated;

grant select, insert, update, delete on public.review_items to service_role;

create index review_items_queue_idx on public.review_items (workspace_id,state,rank,due_at,id);

create table public.subscriptions (
workspace_id uuid primary key references public.workspaces(id),
provider_customer_id text not null unique,
provider_subscription_id text unique,
tier text not null check(tier in ('starter','pro','elite')),
status text not null check(status in ('trialing','active','past_due','ended')),
grace_until timestamptz,
current_period_end timestamptz,
created_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

revoke all on public.subscriptions from anon, authenticated;

grant select, insert, update, delete on public.subscriptions to service_role;

create table public.invoices (
workspace_id uuid not null references public.workspaces(id),
provider_invoice_id text not null unique,
total_minor bigint not null,
currency text not null check(currency ~ '^[a-z]{3}$'),
status text not null,
created_at timestamptz not null default now(),
primary key(workspace_id,provider_invoice_id)
);

alter table public.invoices enable row level security;

revoke all on public.invoices from anon, authenticated;

grant select, insert, update, delete on public.invoices to service_role;

create table public.coach_dna (
workspace_id uuid not null,
coach_id uuid not null,
version integer not null check(version>0),
state text not null check(state in ('draft','active','retired')),
profile jsonb not null check(jsonb_typeof(profile)='object'),
policy_version text not null,
created_at timestamptz not null default now(),
primary key(workspace_id,coach_id,version), foreign key(workspace_id,coach_id) references public.memberships(workspace_id,user_id)
);

alter table public.coach_dna enable row level security;

revoke all on public.coach_dna from anon, authenticated;

grant select, insert, update, delete on public.coach_dna to service_role;

create table public.dna_candidates (
workspace_id uuid not null,
athlete_id uuid not null,
id uuid not null default gen_random_uuid(),

coach_id uuid not null,
state text not null check(state in ('proposed','accepted','rejected','invalidated')),
candidate jsonb not null check(jsonb_typeof(candidate)='object'),
created_at timestamptz not null default now(),
primary key(workspace_id,id), unique(workspace_id,athlete_id,id), foreign key(workspace_id,athlete_id) references public.athletes(workspace_id,id), foreign key(workspace_id,coach_id) references public.memberships(workspace_id,user_id)
);

alter table public.dna_candidates enable row level security;

revoke all on public.dna_candidates from anon, authenticated;

grant select, insert, update, delete on public.dna_candidates to service_role;

create index dna_candidates_by_coach_idx on public.dna_candidates (workspace_id,coach_id,state);

create table public.ai_suggestions (
workspace_id uuid not null,
athlete_id uuid not null,
id uuid not null default gen_random_uuid(),

coach_id uuid not null,
dna_version integer,
module text not null check(module in ('summary','fatigue','anomaly','adaptation','feedback','alert')),
state text not null check(state in ('ready','updated','accepted','rejected','stale','withdrawn')),
model_id text not null,
prompt_version text not null,
evidence_hash text not null,
evidence_refs jsonb not null check(jsonb_typeof(evidence_refs)='array'),
output jsonb not null check(jsonb_typeof(output)='object'),
revision integer not null default 1,
created_at timestamptz not null default now(),
primary key(workspace_id,id), unique(workspace_id,athlete_id,id), foreign key(workspace_id,athlete_id) references public.athletes(workspace_id,id), foreign key(workspace_id,coach_id) references public.memberships(workspace_id,user_id), foreign key(workspace_id,coach_id,dna_version) references public.coach_dna(workspace_id,coach_id,version)
);

alter table public.ai_suggestions enable row level security;

revoke all on public.ai_suggestions from anon, authenticated;

grant select, insert, update, delete on public.ai_suggestions to service_role;

create index ai_suggestions_by_coach_idx on public.ai_suggestions (workspace_id,coach_id,dna_version);

create index ai_suggestions_review_idx on public.ai_suggestions (workspace_id,athlete_id,state,created_at);

create table public.notifications (
workspace_id uuid not null references public.workspaces(id),
id uuid not null default gen_random_uuid(),
user_id uuid not null references public.users(id),
kind text not null,
entity_id uuid,
read_at timestamptz,
created_at timestamptz not null default now(),
primary key(workspace_id,id)
);

alter table public.notifications enable row level security;

revoke all on public.notifications from anon, authenticated;

grant select, insert, update, delete on public.notifications to service_role;

create index notifications_by_recipient_idx on public.notifications (user_id,workspace_id,created_at,id);

create table public.audit_logs (
workspace_id uuid not null references public.workspaces(id),
id bigint generated always as identity,
actor_id uuid references public.users(id) on delete set null,
action text not null,
target_id uuid,
request_id uuid not null,
created_at timestamptz not null default now(),
primary key(workspace_id,id)
);

alter table public.audit_logs enable row level security;

revoke all on public.audit_logs from anon, authenticated;

grant select, insert, update, delete on public.audit_logs to service_role;

create index audit_logs_by_actor_idx on public.audit_logs (actor_id);

create index audit_logs_by_date_idx on public.audit_logs (workspace_id,created_at);

create table public.privacy_requests (
workspace_id uuid not null references public.workspaces(id),
id uuid not null default gen_random_uuid(),
user_id uuid references public.users(id) on delete set null,
kind text not null check(kind in ('access','erase','portability','correct')),
state text not null check(state in ('open','verifying','processing','completed','denied')),
due_at timestamptz not null,
created_at timestamptz not null default now(),
primary key(workspace_id,id)
);

alter table public.privacy_requests enable row level security;

revoke all on public.privacy_requests from anon, authenticated;

grant select, insert, update, delete on public.privacy_requests to service_role;

create index privacy_requests_by_user_idx on public.privacy_requests (user_id);

create index privacy_requests_due_idx on public.privacy_requests (state,due_at);

create table public.operation_keys (
workspace_id uuid not null references public.workspaces(id),
actor_id uuid not null references public.users(id) on delete cascade,
action text not null,
request_key uuid not null,
request_hash text not null,
response jsonb,
expires_at timestamptz not null,
created_at timestamptz not null default now(),
primary key(workspace_id,actor_id,action,request_key)
);

alter table public.operation_keys enable row level security;

revoke all on public.operation_keys from anon, authenticated;

grant select, insert, update, delete on public.operation_keys to service_role;

create index operation_keys_expiry_idx on public.operation_keys (expires_at);

create index operation_keys_by_actor_idx on public.operation_keys (actor_id);

create table public.jobs (
workspace_id uuid not null references public.workspaces(id),
id uuid not null default gen_random_uuid(),
kind text not null,
logical_key text not null,
object_id uuid,
requester_id uuid references public.users(id) on delete set null,
state text not null default 'queued' check(state in ('queued','running','done','dead')),
available_at timestamptz not null default now(),
lease_until timestamptz,
lease_token uuid,
attempts smallint not null default 0,
last_error_code text,
created_at timestamptz not null default now(),
primary key(workspace_id,id), unique(workspace_id,kind,logical_key)
);

alter table public.jobs enable row level security;

revoke all on public.jobs from anon, authenticated;

grant select, insert, update, delete on public.jobs to service_role;

create index jobs_claim_idx on public.jobs (state,available_at,lease_until);

create table public.stripe_events (
event_id text primary key,
event_type text not null,
provider_object_id text not null,
state text not null default 'new' check(state in ('new','running','done','dead')),
created_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;

revoke all on public.stripe_events from anon, authenticated;

grant select, insert, update, delete on public.stripe_events to service_role;

create index stripe_events_claim_idx on public.stripe_events (state,created_at);

create table public.ai_budget (
workspace_id uuid not null references public.workspaces(id),
period_start date not null,
budget_micros bigint not null check(budget_micros>=0),
reserved_micros bigint not null default 0 check(reserved_micros>=0),
spent_micros bigint not null default 0 check(spent_micros>=0),
created_at timestamptz not null default now(),
primary key(workspace_id,period_start)
);

alter table public.ai_budget enable row level security;

revoke all on public.ai_budget from anon, authenticated;

grant select, insert, update, delete on public.ai_budget to service_role;

create table public.migration_map (
workspace_id uuid not null references public.workspaces(id),
kind text not null,
source_id text not null,
target_id uuid not null,
checksum text not null,
created_at timestamptz not null default now(),
primary key(workspace_id,kind,source_id), unique(workspace_id,kind,target_id)
);

alter table public.migration_map enable row level security;

revoke all on public.migration_map from anon, authenticated;

grant select, insert, update, delete on public.migration_map to service_role;

create table public.publications (
workspace_id uuid not null,
athlete_id uuid not null,
id uuid not null default gen_random_uuid(),
actor_id uuid references public.users(id) on delete set null,
kind text not null check(kind in ('publish','cancel')),
created_at timestamptz not null default now(),
primary key(workspace_id,athlete_id,id), foreign key(workspace_id,athlete_id) references public.athletes(workspace_id,id)
);

alter table public.publications enable row level security;

revoke all on public.publications from anon, authenticated;

grant select, insert, update, delete on public.publications to service_role;

create index publications_by_actor_idx on public.publications (actor_id);

create table public.publication_items (
workspace_id uuid not null,
athlete_id uuid not null,
publication_id uuid not null,
workout_id uuid not null,
number integer not null,
created_at timestamptz not null default now(),
primary key(workspace_id,athlete_id,publication_id,workout_id), foreign key(workspace_id,athlete_id,publication_id) references public.publications(workspace_id,athlete_id,id), foreign key(workspace_id,athlete_id,workout_id,number) references public.workout_revisions(workspace_id,athlete_id,workout_id,number)
);

alter table public.publication_items enable row level security;

revoke all on public.publication_items from anon, authenticated;

grant select, insert, update, delete on public.publication_items to service_role;

create index publication_items_by_revision_idx on public.publication_items (workspace_id,athlete_id,workout_id,number);

create table public.workspace_flags (
workspace_id uuid not null references public.workspaces(id),
flag text not null,
enabled boolean not null default false,
created_at timestamptz not null default now(),
primary key(workspace_id,flag)
);

alter table public.workspace_flags enable row level security;

revoke all on public.workspace_flags from anon, authenticated;

grant select, insert, update, delete on public.workspace_flags to service_role;

create table public.privacy_notices (
workspace_id uuid not null references public.workspaces(id),
version integer not null check(version>0),
locale text not null check(locale in ('fr','en')),
body text not null,
active boolean not null default false,
created_at timestamptz not null default now(),
primary key(workspace_id,version,locale)
);

alter table public.privacy_notices enable row level security;

revoke all on public.privacy_notices from anon, authenticated;

grant select, insert, update, delete on public.privacy_notices to service_role;

create table public.privacy_notice_views (
workspace_id uuid not null,
version integer not null,
locale text not null,
user_id uuid not null references public.users(id) on delete cascade,
created_at timestamptz not null default now(),
primary key(workspace_id,version,locale,user_id), foreign key(workspace_id,version,locale) references public.privacy_notices(workspace_id,version,locale)
);

alter table public.privacy_notice_views enable row level security;

revoke all on public.privacy_notice_views from anon, authenticated;

grant select, insert, update, delete on public.privacy_notice_views to service_role;

create index privacy_notice_views_by_user_idx on public.privacy_notice_views (user_id,workspace_id);

create table public.invitation_delivery (
workspace_id uuid not null,
invitation_id uuid not null,
encrypted_envelope bytea not null,
expires_at timestamptz not null,
created_at timestamptz not null default now(),
primary key(workspace_id,invitation_id), foreign key(workspace_id,invitation_id) references public.invitations(workspace_id,id) on delete cascade
);

alter table public.invitation_delivery enable row level security;

revoke all on public.invitation_delivery from anon, authenticated;

grant select, insert, update, delete on public.invitation_delivery to service_role;

create index invitation_delivery_by_expiry_idx on public.invitation_delivery (expires_at);

create table public.imports (
workspace_id uuid not null,
athlete_id uuid not null,
id uuid not null default gen_random_uuid(),

actor_id uuid references public.users(id) on delete set null,
origin text not null check(origin in ('manual_export','authorized_direct')),
object_key text,
preview_hash text,
state text not null check(state in ('received','previewed','applied','failed','reverted')),
expires_at timestamptz not null,
created_at timestamptz not null default now(),
primary key(workspace_id,id), unique(workspace_id,athlete_id,id), foreign key(workspace_id,athlete_id) references public.athletes(workspace_id,id)
);

alter table public.imports enable row level security;

revoke all on public.imports from anon, authenticated;

grant select, insert, update, delete on public.imports to service_role;

create index imports_by_actor_idx on public.imports (actor_id);

create index imports_expiry_idx on public.imports (expires_at);

create table public.import_rows (
workspace_id uuid not null,
athlete_id uuid not null,
import_id uuid not null,
row_no integer not null check(row_no>0),
record_ref uuid,
record_revision integer,
error_code text,
created_at timestamptz not null default now(),
primary key(workspace_id,athlete_id,import_id,row_no), foreign key(workspace_id,athlete_id,import_id) references public.imports(workspace_id,athlete_id,id)
);

alter table public.import_rows enable row level security;

revoke all on public.import_rows from anon, authenticated;

grant select, insert, update, delete on public.import_rows to service_role;

create table public.identity_operation_keys (
actor_id uuid not null references public.users(id) on delete cascade,
action text not null,
request_key uuid not null,
request_hash text not null,
response jsonb,
expires_at timestamptz not null,
created_at timestamptz not null default now(),
primary key(actor_id,action,request_key)
);

alter table public.identity_operation_keys enable row level security;

revoke all on public.identity_operation_keys from anon, authenticated;

grant select, insert, update, delete on public.identity_operation_keys to service_role;

create index identity_operation_keys_expiry_idx on public.identity_operation_keys (expires_at);


alter table public.workouts
 add foreign key(workspace_id,athlete_id,id,working_revision)
 references public.workout_revisions(workspace_id,athlete_id,workout_id,number)
 deferrable initially deferred,
 add foreign key(workspace_id,athlete_id,id,published_revision)
 references public.workout_revisions(workspace_id,athlete_id,workout_id,number)
 deferrable initially deferred;
grant usage, select on sequence public.audit_logs_id_seq to service_role;
create unique index privacy_notice_one_active_idx on public.privacy_notices(workspace_id,locale) where active;
create unique index coach_dna_one_active_idx on public.coach_dna(workspace_id,coach_id) where state='active';
create unique index memberships_one_owner_idx on public.memberships(workspace_id) where role='owner' and active;
insert into public.sports(code) values ('running'),('trail'),('cycling'),('swimming'),('triathlon'),('duathlon');

create function private.current_coach(w uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m where m.workspace_id=w and m.user_id=(select auth.uid()) and m.active)
$$;
create function private.current_owner(w uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m where m.workspace_id=w and m.user_id=(select auth.uid()) and m.active and m.role='owner')
$$;
create function private.own_athlete(w uuid,a uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.athletes x where x.workspace_id=w and x.id=a and x.user_id=(select auth.uid()))
$$;
create function private.assigned(w uuid,a uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.current_coach(w) and exists(
 select 1 from public.coach_assignments x where x.workspace_id=w and x.athlete_id=a and x.coach_id=(select auth.uid())
 and x.starts_at<=statement_timestamp() and (x.ends_at is null or x.ends_at>statement_timestamp()))
$$;
create function private.current_athlete(w uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.athletes x where x.workspace_id=w and x.user_id=(select auth.uid()))
$$;
create function private.is_published_revision(w uuid,a uuid,workout uuid,v integer) returns boolean language sql stable security definer set search_path='' as $$
 select private.own_athlete(w,a) and exists(
 select 1 from public.workouts x where x.workspace_id=w and x.athlete_id=a and x.id=workout
 and (x.published_revision=v or exists (
 select 1 from public.workout_results r where r.workspace_id=w and r.athlete_id=a and r.workout_id=workout and r.workout_revision=v)))
$$;
revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

create function private.block_mutation() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' and current_user in ('postgres','service_role')
 and current_setting('coachos.erasure_authorized',true)='on' then
   return old;
 end if;
 raise exception 'immutable record' using errcode='23514';
end;
$$;
revoke all on function private.block_mutation() from public, authenticated;
create trigger immutable_workout_revisions before update or delete on public.workout_revisions
for each row execute function private.block_mutation();
create trigger immutable_audit_logs before update or delete on public.audit_logs
for each row execute function private.block_mutation();


grant select on public.users to authenticated;

create policy self on public.users for select to authenticated using (id=(select auth.uid()));

grant select on public.workspaces to authenticated;

create policy workspace on public.workspaces for select to authenticated using (private.current_coach(id) or private.current_athlete(id));

grant select on public.memberships to authenticated;

create policy membership on public.memberships for select to authenticated using (user_id=(select auth.uid()) or private.current_owner(workspace_id));

grant select on public.athletes to authenticated;

create policy athlete on public.athletes for select to authenticated using (private.assigned(workspace_id,id) or user_id=(select auth.uid()));

grant select on public.coach_assignments to authenticated;

create policy assignment on public.coach_assignments for select to authenticated using (coach_id=(select auth.uid()) or private.current_owner(workspace_id));

grant select on public.teams to authenticated;

create policy coach_workspace on public.teams for select to authenticated using (private.current_coach(workspace_id));

grant select on public.team_athletes to authenticated;

create policy coach_only on public.team_athletes for select to authenticated using (private.assigned(workspace_id,athlete_id));

grant select on public.sports to authenticated;

create policy catalog on public.sports for select to authenticated using (true);

grant select on public.goals to authenticated;

create policy athlete_data on public.goals for select to authenticated using (private.assigned(workspace_id,athlete_id) or private.own_athlete(workspace_id,athlete_id));

grant select on public.plans to authenticated;

create policy coach_only on public.plans for select to authenticated using (private.assigned(workspace_id,athlete_id));

grant select on public.plan_blocks to authenticated;

create policy coach_only on public.plan_blocks for select to authenticated using (private.assigned(workspace_id,athlete_id));

grant select on public.workouts to authenticated;

create policy workout_parent on public.workouts for select to authenticated using (private.assigned(workspace_id,athlete_id));

grant select on public.workout_revisions to authenticated;

create policy workout_revision on public.workout_revisions for select to authenticated using (private.assigned(workspace_id,athlete_id) or private.is_published_revision(workspace_id,athlete_id,workout_id,number));

grant select on public.templates to authenticated;

create policy coach_workspace on public.templates for select to authenticated using (private.current_coach(workspace_id) and (shared or owner_id=(select auth.uid())));

grant select on public.workout_results to authenticated;

create policy athlete_data on public.workout_results for select to authenticated using (private.assigned(workspace_id,athlete_id) or private.own_athlete(workspace_id,athlete_id));

grant select on public.feedbacks to authenticated;

create policy athlete_data on public.feedbacks for select to authenticated using (private.assigned(workspace_id,athlete_id) or private.own_athlete(workspace_id,athlete_id));

grant select on public.coach_notes to authenticated;

create policy coach_only on public.coach_notes for select to authenticated using (private.assigned(workspace_id,athlete_id) and author_id=(select auth.uid()));

grant select on public.conversations to authenticated;

create policy athlete_data on public.conversations for select to authenticated using (private.assigned(workspace_id,athlete_id) or private.own_athlete(workspace_id,athlete_id));

grant select on public.messages to authenticated;

create policy athlete_data on public.messages for select to authenticated using (private.assigned(workspace_id,athlete_id) or private.own_athlete(workspace_id,athlete_id));

grant select on public.read_receipts to authenticated;

create policy self_workspace on public.read_receipts for select to authenticated using (user_id=(select auth.uid()) and (private.current_coach(workspace_id) or private.current_athlete(workspace_id)) and (private.assigned(workspace_id,athlete_id) or private.own_athlete(workspace_id,athlete_id)));

grant select on public.review_items to authenticated;

create policy coach_only on public.review_items for select to authenticated using (private.assigned(workspace_id,athlete_id));

grant select on public.subscriptions to authenticated;

create policy owner on public.subscriptions for select to authenticated using (private.current_owner(workspace_id));

grant select on public.invoices to authenticated;

create policy owner on public.invoices for select to authenticated using (private.current_owner(workspace_id));

grant select on public.coach_dna to authenticated;

create policy coach_profile on public.coach_dna for select to authenticated using (coach_id=(select auth.uid()) and private.current_coach(workspace_id));

grant select on public.dna_candidates to authenticated;

create policy coach_only on public.dna_candidates for select to authenticated using (private.assigned(workspace_id,athlete_id) and coach_id=(select auth.uid()));

grant select on public.ai_suggestions to authenticated;

create policy coach_only on public.ai_suggestions for select to authenticated using (private.assigned(workspace_id,athlete_id) and coach_id=(select auth.uid()));

grant select on public.notifications to authenticated;

create policy self_workspace on public.notifications for select to authenticated using (user_id=(select auth.uid()) and (private.current_coach(workspace_id) or private.current_athlete(workspace_id)));

commit;
