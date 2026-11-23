import { openPrivacyRequestSchema, parseWith, PRIVACY_REQUEST_DAYS, type PrivacyRequestKind, type PrivacyRequestState } from '@coachos/domain';
import { commandAs, readAs, type Tx } from '../db/client';
import { invalid, notVisible } from '../errors';
import { PRIVACY_VERSION, privacySummary } from '../privacy/notice';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { requireOwner } from './invitations';

/**
 * D-115 · Données personnelles (contrat : privacy_requests, routes /privacy/*).
 * - accès et portabilité : export immédiat, lu sous les droits de la personne (RLS) ;
 * - effacement et rectification : demande consignée avec échéance à 30 jours, tâche pour le propriétaire de l’espace ;
 * - effacement d’un élève par le propriétaire : tout le dossier, puis le compte s’il n’est lié à aucun autre espace.
 */

interface Meta {
  actorId: string;
  idempotencyKey: string;
  requestId: string;
  workspaceId: string;
}

interface Membership {
  coach: boolean;
  owner: boolean;
  athleteId: string | null;
}

interface RequestRow {
  id: string;
  kind: PrivacyRequestKind;
  state: PrivacyRequestState;
  created_at: Date | string;
  due_at: Date | string;
}

export interface PrivacyRequestView {
  id: string;
  kind: PrivacyRequestKind;
  state: PrivacyRequestState;
  createdAt: string;
  dueAt: string;
}

const OPEN_STATES = `('open','verifying','processing')`;
const iso = (v: Date | string) => new Date(v).toISOString();
const toView = (r: RequestRow): PrivacyRequestView => ({ id: r.id, kind: r.kind, state: r.state, createdAt: iso(r.created_at), dueAt: iso(r.due_at) });

/** Rôle de l’acteur dans l’espace : coach (propriétaire ou non) et/ou élève dont le dossier est lié au compte. */
async function membership(tx: Tx, wid: string): Promise<Membership> {
  const r = await tx.query<{ coach: boolean; owner: boolean; athlete_id: string | null }>(
    `select private.current_coach($1) as coach, private.current_owner($1) as owner,
            (select id from public.athletes where workspace_id = $1 and user_id = auth.uid() limit 1) as athlete_id`,
    [wid],
  );
  const row = r.rows[0];
  return { coach: Boolean(row?.coach), owner: Boolean(row?.owner), athleteId: row?.athlete_id ?? null };
}

/** readNotice · CA : version et résumé de la politique, pour les membres de l’espace. */
export async function readNotice(userId: string, wid: string): Promise<{ version: string; body: string } | null> {
  return commandAs(userId, async (tx) => {
    const m = await membership(tx, wid);
    if (!m.coach && !m.athleteId) return null;
    return { version: PRIVACY_VERSION, body: privacySummary() };
  });
}

/** Demandes déposées par la personne connectée dans cet espace (les plus récentes d’abord). */
export async function listMyPrivacyRequests(userId: string, wid: string): Promise<PrivacyRequestView[]> {
  return commandAs(userId, async (tx) => {
    const r = await tx.query<RequestRow>(
      `select id, kind, state, created_at, due_at from public.privacy_requests
       where workspace_id = $1 and user_id = auth.uid() order by created_at desc limit 20`,
      [wid],
    );
    return r.rows.map(toView);
  });
}

/** Tâche pour le propriétaire : la demande apparaît dans son Planning avec l’échéance et le lien vers la fiche. */
async function taskForOwner(tx: Tx, wid: string, m: Membership, kind: PrivacyRequestKind, dueOn: string) {
  const owner = await tx.query<{ user_id: string }>(`select user_id from public.memberships where workspace_id = $1 and role = 'owner' and active limit 1`, [wid]);
  const to = owner.rows[0]?.user_id;
  if (!to) return;
  const who = m.athleteId
    ? (await tx.query<{ display_name: string }>('select display_name from public.athletes where workspace_id = $1 and id = $2', [wid, m.athleteId])).rows[0]?.display_name ?? 'un élève'
    : 'un coach de l’espace';
  const title = `${kind === 'erase' ? 'Demande d’effacement' : 'Demande de rectification'} · ${who}`.slice(0, 200);
  const link = m.athleteId ? `/coach/${wid}/athletes/${m.athleteId}#donnees` : `/coach/${wid}/settings#donnees`;
  const notes = kind === 'erase'
    ? 'Demande déposée depuis « Mes données ». À traiter sous 30 jours : ouvre la fiche, section « Données », puis « Effacer définitivement ».'
    : 'Demande déposée depuis « Mes données ». Contacte la personne pour corriger ce qui doit l’être, puis termine la tâche.';
  await tx.query(
    `insert into public.coach_tasks(workspace_id, athlete_id, team_id, assignee_id, created_by, title, kind, due_on, priority, link, notes)
     values ($1, $2, null, $3, $3, $4, 'other', $5::date, 2, $6, $7)`,
    [wid, m.athleteId, to, title, dueOn, link, notes],
  );
}

/** openPrivacyRequest · CA : accès et portabilité sont servis tout de suite ; effacement et rectification ouvrent une demande. */
export async function openPrivacyRequest(meta: Meta, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(openPrivacyRequestSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const { kind } = parsed.value;
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    const m = await membership(tx, wid);
    if (!m.coach && !m.athleteId) throw notVisible();
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'privacy.request', key: meta.idempotencyKey, body }, async () => {
      const immediate = kind === 'access' || kind === 'portability';
      if (!immediate) {
        const open = await tx.query<RequestRow>(
          `select id, kind, state, created_at, due_at from public.privacy_requests
           where workspace_id = $1 and user_id = auth.uid() and kind = $2 and state in ${OPEN_STATES} limit 1`,
          [wid, kind],
        );
        const existing = open.rows[0];
        if (existing) return { status: 200, body: { id: existing.id, state: existing.state, dueAt: iso(existing.due_at) } };
      }
      const r = await tx.query<RequestRow>(
        `insert into public.privacy_requests(workspace_id, user_id, kind, state, due_at)
         values ($1, auth.uid(), $2, $3, now() + ($4::int * interval '1 day'))
         returning id, kind, state, created_at, due_at`,
        [wid, kind, immediate ? 'completed' : 'open', PRIVACY_REQUEST_DAYS],
      );
      const row = r.rows[0]!;
      // Le propriétaire est le responsable : sa propre demande est traitée par l’opérateur, sans tâche.
      if (!immediate && !m.owner) await taskForOwner(tx, wid, m, kind, iso(row.due_at).slice(0, 10));
      await audit(tx, wid, meta.actorId, `privacy.${kind}`, row.id, meta.requestId);
      return { status: 200, body: { id: row.id, state: row.state, dueAt: iso(row.due_at) } };
    });
  });
}

/** readPrivacyRequest · CA : état d’une demande de la personne ; chemin de téléchargement pour un export servi. */
export async function readPrivacyRequest(userId: string, wid: string, qid: string): Promise<{ id: string; state: PrivacyRequestState; downloadPath: string | null } | null> {
  return commandAs(userId, async (tx) => {
    const r = await tx.query<RequestRow>(
      'select id, kind, state, created_at, due_at from public.privacy_requests where workspace_id = $1 and id = $2 and user_id = auth.uid()',
      [wid, qid],
    );
    const row = r.rows[0];
    if (!row) return null;
    const downloadable = (row.kind === 'access' || row.kind === 'portability') && row.state === 'completed';
    return { id: row.id, state: row.state, downloadPath: downloadable ? `/api/v1/workspaces/${wid}/privacy/requests/${row.id}/download` : null };
  });
}

// ---------- Export ----------

/** Jamais dans un export : contenus binaires (vocaux, vidéos) et empreintes de sécurité. */
function clean(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Uint8Array) continue;
    if (/_hash$|_hmac$|^secret|envelope$/.test(k)) continue;
    out[k] = v;
  }
  return out;
}

/** Lecture d’une table sous les droits de la personne ; une table sans droit de lecture est simplement absente. */
async function tableRows(tx: Tx, table: string, where: string, params: unknown[]): Promise<Record<string, unknown>[] | undefined> {
  await tx.exec('savepoint export_table');
  try {
    const r = await tx.query<Record<string, unknown>>(`select * from public.${table} where ${where}`, params);
    await tx.exec('release savepoint export_table');
    return r.rows.map(clean);
  } catch {
    await tx.exec('rollback to savepoint export_table');
    return undefined;
  }
}

const ATHLETE_TABLES = [
  'athlete_profiles', 'athlete_profile_versions', 'athlete_profile_drafts', 'athlete_sport_levels', 'athlete_references', 'athlete_performances',
  'goals', 'goal_decisions', 'workouts', 'workout_revisions', 'workout_results', 'feedbacks', 'workout_activities', 'review_items',
  'plans', 'plan_blocks', 'publications', 'publication_items', 'conversations', 'messages', 'read_receipts', 'appointments', 'team_athletes', 'imports',
] as const;

const COACH_TABLES: readonly [table: string, column: string][] = [
  ['memberships', 'user_id'], ['templates', 'owner_id'], ['coach_dna', 'coach_id'], ['coach_notes', 'author_id'], ['relance_templates', 'coach_id'],
  ['exercises', 'owner_id'], ['exercise_clips', 'owner_id'], ['coach_tasks', 'assignee_id'], ['appointments', 'coach_id'], ['auto_rule_settings', 'coach_id'],
  ['auto_task_states', 'coach_id'], ['ai_suggestions', 'coach_id'], ['dna_candidates', 'coach_id'], ['messages', 'sender_id'],
];

const PERSON_TABLES: readonly [table: string, column: string][] = [
  ['notifications', 'user_id'], ['notification_settings', 'user_id'], ['team_messages', 'sender_id'], ['team_reads', 'user_id'], ['voice_clips', 'sender_id'],
];

/**
 * exportMyData : tout ce que la personne peut lire sur elle dans l’espace (accès et portabilité). Les règles RLS décident
 * ligne par ligne ; les notes privées d’un autre coach, par exemple, n’y figurent jamais.
 */
export async function exportMyData(userId: string, wid: string): Promise<Record<string, unknown> | null> {
  const m = await commandAs(userId, (tx) => membership(tx, wid));
  if (!m.coach && !m.athleteId) return null;
  return readAs(userId, async (tx) => {
    const account = (await tx.query<Record<string, unknown>>('select id, display_name, locale, created_at from public.users where id = auth.uid()')).rows[0] ?? null;
    const workspace = (await tx.query<Record<string, unknown>>('select id, name, time_zone, created_at from public.workspaces where id = $1', [wid])).rows[0] ?? null;
    const out: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      noticeVersion: PRIVACY_VERSION,
      account,
      workspace,
      roles: { coach: m.coach, owner: m.owner, athlete: Boolean(m.athleteId) },
    };
    if (m.athleteId) {
      const athlete: Record<string, unknown> = {};
      athlete.file = (await tableRows(tx, 'athletes', 'workspace_id = $1 and id = $2', [wid, m.athleteId]))?.[0] ?? null;
      for (const t of ATHLETE_TABLES) {
        const rows = await tableRows(tx, t, 'workspace_id = $1 and athlete_id = $2', [wid, m.athleteId]);
        if (rows) athlete[t] = rows;
      }
      out.athlete = athlete;
    }
    if (m.coach) {
      const coach: Record<string, unknown> = {};
      for (const [t, col] of COACH_TABLES) {
        const rows = await tableRows(tx, t, `workspace_id = $1 and ${col} = auth.uid()`, [wid]);
        if (rows) coach[t] = rows;
      }
      out.coach = coach;
    }
    const person: Record<string, unknown> = {};
    for (const [t, col] of PERSON_TABLES) {
      const rows = await tableRows(tx, t, `workspace_id = $1 and ${col} = auth.uid()`, [wid]);
      if (rows) person[t] = rows;
    }
    out.person = person;
    return out;
  });
}

// ---------- Effacement ----------

/** Demande d’effacement ouverte pour un élève (vue du propriétaire sur la fiche). */
export async function pendingErasure(userId: string, wid: string, aid: string): Promise<{ id: string; createdAt: string; dueAt: string } | null> {
  return commandAs(userId, async (tx) => {
    const m = await membership(tx, wid);
    if (!m.owner) return null;
    const r = await tx.query<RequestRow>(
      `select p.id, p.kind, p.state, p.created_at, p.due_at from public.privacy_requests p
       join public.athletes a on a.workspace_id = p.workspace_id and a.user_id = p.user_id
       where p.workspace_id = $1 and a.id = $2 and p.kind = 'erase' and p.state in ${OPEN_STATES}
       order by p.created_at limit 1`,
      [wid, aid],
    );
    const row = r.rows[0];
    return row ? { id: row.id, createdAt: iso(row.created_at), dueAt: iso(row.due_at) } : null;
  });
}

/** Ordre de suppression du dossier d’un élève : les tables qui en référencent d’autres passent en premier. */
const ATHLETE_ERASE_ORDER = [
  'publication_items', 'publications', 'import_rows', 'imports', 'review_items', 'feedbacks', 'workout_results', 'workout_activities',
  'dna_candidates', 'ai_suggestions', 'goal_decisions', 'goals', 'athlete_profile_versions', 'athlete_profile_drafts', 'athlete_profiles',
  'athlete_references', 'athlete_performances', 'athlete_sport_levels', 'coach_notes', 'coach_tasks', 'appointments',
  'read_receipts', 'messages', 'conversations', 'plan_blocks', 'plans', 'workout_revisions', 'workouts', 'team_athletes', 'invitations', 'coach_assignments',
] as const;

/** Lignes propres à la personne dans l’espace (hors dossier d’élève). */
const PERSON_ERASE: readonly [table: string, column: string][] = [
  ['team_messages', 'sender_id'], ['voice_clips', 'sender_id'], ['team_reads', 'user_id'], ['read_receipts', 'user_id'],
  ['notifications', 'user_id'], ['notification_settings', 'user_id'],
];

/** Tables du dossier d’après le catalogue (workspace_id + athlete_id) : une table ajoutée plus tard n’est jamais oubliée. */
let catalogTables: string[] | null = null;
async function dossierTables(tx: Tx): Promise<string[]> {
  if (catalogTables) return catalogTables;
  const r = await tx.query<{ table_name: string }>(
    `select c.table_name from information_schema.columns c
     join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
     where c.table_schema = 'public' and c.column_name = 'athlete_id'
       and exists (select 1 from information_schema.columns w where w.table_schema = 'public' and w.table_name = c.table_name and w.column_name = 'workspace_id')`,
  );
  catalogTables = r.rows.map((x) => x.table_name).filter((t) => t !== 'athletes');
  return catalogTables;
}

export type DeleteAuthUser = (userId: string) => Promise<void>;

/**
 * eraseAthleteData · O : efface tout le dossier d’un élève dans l’espace. Si son compte n’est lié à aucun autre espace
 * (ni élève, ni coach), le compte est supprimé aussi : d’abord la ligne users (dans la transaction), puis le compte Auth.
 */
export async function eraseAthleteData(meta: Meta & { athleteId: string }, deleteAuthUser: DeleteAuthUser): Promise<StoredResponse> {
  const wid = meta.workspaceId;
  const aid = meta.athleteId;
  let toDelete: string | null = null;
  const result = await commandAs(meta.actorId, async (tx) => {
    await requireOwner(tx, wid);
    // Le contrat SQL n’autorise la suppression des enregistrements immuables (révisions, journal) que dans une transaction
    // d’effacement déclarée. Le réglage meurt avec la transaction.
    await tx.exec("set local coachos.erasure_authorized = 'on'");
    // La même intention rejouée (réseau coupé, double clic) retrouve la réponse enregistrée : l’élève n’existe plus.
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'athlete.erase', key: meta.idempotencyKey, body: { athleteId: aid } }, async () => {
      const a = await tx.query<{ user_id: string | null }>('select user_id from public.athletes where workspace_id = $1 and id = $2 for update', [wid, aid]);
      if (!a.rows[0]) throw notVisible();
      const userId = a.rows[0].user_id;
      await audit(tx, wid, meta.actorId, 'athlete.erase', aid, meta.requestId);
      // D’abord les tables hors liste (feuilles : notifications…), puis l’ordre connu qui respecte les clés étrangères.
      const known = new Set<string>(ATHLETE_ERASE_ORDER);
      const extra = (await dossierTables(tx)).filter((t) => !known.has(t));
      for (const t of [...extra, ...ATHLETE_ERASE_ORDER]) await tx.query(`delete from public.${t} where workspace_id = $1 and athlete_id = $2`, [wid, aid]);
      if (userId) {
        for (const [t, col] of PERSON_ERASE) await tx.query(`delete from public.${t} where workspace_id = $1 and ${col} = $2`, [wid, userId]);
        await tx.query(`update public.privacy_requests set state = 'completed' where workspace_id = $1 and user_id = $2 and kind = 'erase' and state in ${OPEN_STATES}`, [wid, userId]);
      }
      await tx.query('delete from public.athletes where workspace_id = $1 and id = $2', [wid, aid]);
      let accountDeleted = false;
      if (userId) {
        const elsewhere = await tx.query<{ n: number }>(
          `select (select count(*) from public.athletes where user_id = $1) + (select count(*) from public.memberships where user_id = $1) as n`,
          [userId],
        );
        if (Number(elsewhere.rows[0]?.n ?? 0) === 0) {
          await tx.query('delete from public.users where id = $1', [userId]);
          accountDeleted = true;
          toDelete = userId;
        }
      }
      return { status: 200, body: { erased: true, accountDeleted } };
    });
  });
  if (toDelete) {
    try {
      await deleteAuthUser(toDelete);
    } catch (error) {
      // Le dossier est effacé ; le compte Auth orphelin ne peut plus rien ouvrir. À nettoyer à la main (journal).
      console.error(JSON.stringify({ module: 'privacy', code: 'AUTH_DELETE_FAILED', error: (error as Error)?.name }));
    }
  }
  return result;
}
