import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, readAs, setDb, type Db, type Tx } from './db/client';
import { ATHLETES, USERS, WORKSPACE_A, WORKSPACE_B } from './db/fixtures';

// D-161 · Droits en base, au comportement : chaque table lisible, chaque profil.
// D-127 prouve que chaque lecture accordée est filtrée par une politique ; ici on prouve ce que chaque politique laisse voir.
// Une ligne fictive par table pour Camille et Noah (espace A) et pour Léa (espace B), puis, pour sept profils,
// deux contrôles : tout ce qu’il voit lui est permis, et tout ce qui lui est permis, il le voit (sinon le test ne prouverait rien).
// Une table lisible ajoutée plus tard sans règle ici fait échouer le test.

const A = WORKSPACE_A;
const B = WORKSPACE_B;
const ZOE = '00000000-0000-4000-8000-000000000011'; // coach de l’espace A, ni propriétaire ni affectée (son affectation à Noah est terminée)
const YANN = '00000000-0000-4000-8000-000000000012'; // coach retiré de l’espace A, mais son affectation à Camille court encore
const TEAM_A = '30000000-0000-4000-8000-00000000000a'; // groupe de Camille (Noah n’en fait pas partie)
const TEAM_B = '30000000-0000-4000-8000-00000000000b'; // groupe de Léa
const W = { camille: '40000000-0000-4000-8000-000000000001', noah: '40000000-0000-4000-8000-000000000002', lea: '40000000-0000-4000-8000-000000000003' };

const NAMES: Record<string, string> = {
  [A]: 'A', [B]: 'B', [USERS.marine]: 'Marine', [USERS.camille]: 'Camille', [USERS.noah]: 'Noah', [USERS.hugo]: 'Hugo', [USERS.lea]: 'Léa',
  [ZOE]: 'Zoé', [YANN]: 'Yann', [ATHLETES.camille]: 'Camille', [ATHLETES.noah]: 'Noah', [ATHLETES.ines]: 'Inès', [ATHLETES.lea]: 'Léa',
  [TEAM_A]: 'groupe A', [TEAM_B]: 'groupe B',
};

// ---------- Profils ----------

interface Who { id: string; name: string; coach: string[]; owner: string[]; assigned: string[]; own: string[]; teams: string[] }
const k = (w: string, x: string) => `${w}:${x}`;
const WHO: Who[] = [
  { id: USERS.marine, name: 'Marine (propriétaire de A)', coach: [A], owner: [A], assigned: [k(A, ATHLETES.camille), k(A, ATHLETES.noah), k(A, ATHLETES.ines)], own: [], teams: [] },
  { id: ZOE, name: 'Zoé (coach de A sans élève)', coach: [A], owner: [], assigned: [], own: [], teams: [] },
  { id: YANN, name: 'Yann (coach retiré de A)', coach: [], owner: [], assigned: [], own: [], teams: [] },
  { id: USERS.camille, name: 'Camille (élève de A)', coach: [], owner: [], assigned: [], own: [k(A, ATHLETES.camille)], teams: [k(A, TEAM_A)] },
  { id: USERS.noah, name: 'Noah (élève de A)', coach: [], owner: [], assigned: [], own: [k(A, ATHLETES.noah)], teams: [] },
  { id: USERS.hugo, name: 'Hugo (propriétaire de B)', coach: [B], owner: [B], assigned: [k(B, ATHLETES.lea)], own: [], teams: [] },
  { id: USERS.lea, name: 'Léa (élève de B)', coach: [], owner: [], assigned: [], own: [k(B, ATHLETES.lea)], teams: [k(B, TEAM_B)] },
];

// ---------- Règles attendues, en mots du produit ----------

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? '' : String(v));
const coachOf = (who: Who, r: Row) => who.coach.includes(s(r.workspace_id));
const ownerOf = (who: Who, r: Row) => who.owner.includes(s(r.workspace_id));
const athleteIn = (who: Who, w: string) => who.own.some((x) => x.startsWith(`${w}:`));
const suivi = (who: Who, r: Row) => who.assigned.includes(k(s(r.workspace_id), s(r.athlete_id)));
const sien = (who: Who, r: Row) => who.own.includes(k(s(r.workspace_id), s(r.athlete_id)));
const dossier = (who: Who, r: Row) => suivi(who, r) || sien(who, r);
const membre = (who: Who, r: Row) => coachOf(who, r) || athleteIn(who, s(r.workspace_id));
const soi = (who: Who, r: Row) => s(r.user_id) === who.id;
let published = new Set<string>();

const RULES: Record<string, (who: Who, r: Row) => boolean> = {
  // Dossier de l’élève : son coach affecté et lui-même.
  athlete_performances: dossier, athlete_profile_drafts: dossier, athlete_profile_versions: dossier, athlete_profiles: dossier,
  athlete_references: dossier, athlete_sport_levels: dossier, conversations: dossier, feedbacks: dossier, goals: dossier,
  messages: dossier, workout_activities: dossier, workout_results: dossier,
  // Travail du coach sur un élève : son coach affecté seulement, jamais l’élève.
  appointments: suivi, goal_decisions: suivi, plan_blocks: suivi, plans: suivi, review_items: suivi, team_athletes: suivi, workouts: suivi,
  // Notes et propositions personnelles du coach affecté.
  ai_suggestions: (w, r) => suivi(w, r) && s(r.coach_id) === w.id,
  coach_notes: (w, r) => suivi(w, r) && s(r.author_id) === w.id,
  dna_candidates: (w, r) => suivi(w, r) && s(r.coach_id) === w.id,
  // Réglages personnels d’un coach actif.
  auto_rule_settings: (w, r) => coachOf(w, r) && s(r.coach_id) === w.id,
  auto_task_states: (w, r) => coachOf(w, r) && s(r.coach_id) === w.id,
  coach_dna: (w, r) => coachOf(w, r) && s(r.coach_id) === w.id,
  relance_templates: (w, r) => coachOf(w, r) && s(r.coach_id) === w.id,
  coach_tasks: (w, r) => coachOf(w, r) && (s(r.assignee_id) === w.id || s(r.created_by) === w.id) && (r.athlete_id == null || suivi(w, r)),
  // Bibliothèque : les coachs de l’espace ; une séance type privée reste à son auteur.
  templates: (w, r) => coachOf(w, r) && (r.shared === true || s(r.owner_id) === w.id),
  group_sessions: coachOf,
  // Contenu commun de l’espace, lisible par ses coachs et ses élèves.
  exercises: membre, workspace_profiles: membre,
  workspaces: (w, r) => membre(w, { workspace_id: r.id }),
  // Groupes : les coachs de l’espace et les membres du groupe.
  teams: (w, r) => coachOf(w, r) || w.teams.includes(k(s(r.workspace_id), s(r.id))),
  team_messages: (w, r) => coachOf(w, r) || w.teams.includes(k(s(r.workspace_id), s(r.team_id))),
  // Équipe et facturation : le propriétaire.
  coach_assignments: (w, r) => s(r.coach_id) === w.id || ownerOf(w, r),
  memberships: (w, r) => soi(w, r) || ownerOf(w, r),
  invoices: ownerOf, subscriptions: ownerOf,
  athletes: (w, r) => w.assigned.includes(k(s(r.workspace_id), s(r.id))) || s(r.user_id) === w.id,
  // Personnel.
  users: (w, r) => s(r.id) === w.id,
  notification_settings: soi, push_subscriptions: soi, team_reads: soi,
  notifications: (w, r) => soi(w, r) && membre(w, r),
  read_receipts: (w, r) => soi(w, r) && membre(w, r) && dossier(w, r),
  // Séance : le coach affecté voit tout ; l’élève, seulement les versions publiées ou celles auxquelles il a répondu.
  workout_revisions: (w, r) => suivi(w, r) || (sien(w, r) && published.has(`${s(r.workout_id)}:${s(r.number)}`)),
  // Catalogue.
  sports: () => true,
};

// ---------- Lignes fictives ----------

const ATH = [
  { w: A, a: ATHLETES.camille, user: USERS.camille, coach: USERS.marine, team: TEAM_A, workout: W.camille },
  { w: A, a: ATHLETES.noah, user: USERS.noah, coach: USERS.marine, team: TEAM_A, workout: W.noah },
  { w: B, a: ATHLETES.lea, user: USERS.lea, coach: USERS.hugo, team: TEAM_B, workout: W.lea },
];
const COACHES = [{ w: A, coach: USERS.marine }, { w: A, coach: ZOE }, { w: B, coach: USERS.hugo }];
const SPACES = [{ w: A, coach: USERS.marine, team: TEAM_A }, { w: B, coach: USERS.hugo, team: TEAM_B }];
const PEOPLE = [
  { w: A, user: USERS.marine }, { w: A, user: ZOE }, { w: A, user: USERS.camille }, { w: A, user: USERS.noah },
  { w: B, user: USERS.hugo }, { w: B, user: USERS.lea },
];
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

function plan(): Record<string, Row[]> {
  const byAthlete = (extra: (f: (typeof ATH)[number]) => Row = () => ({})) => ATH.map((f) => ({
    workspace_id: f.w, athlete_id: f.a, coach_id: f.coach, author_id: f.coach, created_by: f.coach, assignee_id: f.coach,
    decided_by: f.coach, confirmed_by: f.coach, saved_by: f.coach, updated_by: f.coach, ...extra(f),
  }));
  const p: Record<string, Row[]> = {};
  for (const t of ['ai_suggestions', 'appointments', 'athlete_performances', 'athlete_profile_drafts', 'athlete_profile_versions',
    'athlete_profiles', 'athlete_references', 'athlete_sport_levels', 'coach_notes', 'conversations', 'dna_candidates', 'feedbacks',
    'goal_decisions', 'goals', 'messages', 'plan_blocks', 'plans', 'review_items', 'workout_activities', 'workout_results']) p[t] = byAthlete();
  p.workout_activities = byAthlete(() => ({ duration_seconds: 600 }));
  p.coach_tasks = [...byAthlete(), { workspace_id: A, athlete_id: null, assignee_id: ZOE, created_by: ZOE }];
  p.team_athletes = [{ workspace_id: A, team_id: TEAM_A, athlete_id: ATHLETES.camille }, { workspace_id: B, team_id: TEAM_B, athlete_id: ATHLETES.lea }];
  p.workouts = ATH.map((f) => ({ workspace_id: f.w, athlete_id: f.a, id: f.workout, published_revision: 1, working_revision: 2 }));
  p.workout_revisions = ATH.flatMap((f) => [1, 2].map((n) => ({ workspace_id: f.w, athlete_id: f.a, workout_id: f.workout, number: n })));
  p.read_receipts = [...ATH.map((f) => ({ workspace_id: f.w, athlete_id: f.a, user_id: f.user })), { workspace_id: A, athlete_id: ATHLETES.camille, user_id: USERS.marine }];
  for (const t of ['auto_rule_settings', 'auto_task_states', 'coach_dna', 'relance_templates']) p[t] = COACHES.map((c) => ({ workspace_id: c.w, coach_id: c.coach }));
  p.exercises = COACHES.map((c) => ({ workspace_id: c.w, owner_id: c.coach, name: `Exercice de ${NAMES[c.coach]}` }));
  p.templates = [
    { workspace_id: A, owner_id: USERS.marine, shared: false }, { workspace_id: A, owner_id: ZOE, shared: true },
    { workspace_id: A, owner_id: ZOE, shared: false }, { workspace_id: B, owner_id: USERS.hugo, shared: true },
  ].map((x, i) => ({ ...x, title: `Séance type ${i + 1}` }));
  for (const t of ['notification_settings', 'notifications', 'push_subscriptions']) p[t] = PEOPLE.map((x) => ({ workspace_id: x.w, user_id: x.user }));
  p.team_reads = [{ workspace_id: A, team_id: TEAM_A, user_id: USERS.camille }, { workspace_id: A, team_id: TEAM_A, user_id: USERS.marine }, { workspace_id: B, team_id: TEAM_B, user_id: USERS.lea }];
  for (const t of ['invoices', 'subscriptions', 'workspace_profiles']) p[t] = SPACES.map((x) => ({ workspace_id: x.w }));
  p.teams = SPACES.map((x) => ({ workspace_id: x.w, id: x.team, name: `Groupe ${NAMES[x.w]}` }));
  p.team_messages = SPACES.map((x) => ({ workspace_id: x.w, team_id: x.team }));
  p.group_sessions = SPACES.map((x) => ({ workspace_id: x.w, team_id: x.team, created_by: x.coach }));
  p.users = [{ id: ZOE, display_name: 'Zoé' }, { id: YANN, display_name: 'Yann' }];
  p.memberships = [{ workspace_id: A, user_id: ZOE, role: 'coach', active: true }, { workspace_id: A, user_id: YANN, role: 'coach', active: false }];
  p.coach_assignments = [
    { workspace_id: A, athlete_id: ATHLETES.camille, coach_id: YANN, starts_at: day(-30) },
    { workspace_id: A, athlete_id: ATHLETES.noah, coach_id: ZOE, starts_at: day(-30), ends_at: day(-1) },
  ];
  return p;
}

// ---------- Remplissage générique : colonnes obligatoires d’après le schéma et ses contraintes ----------

interface Col { c: string; u: string; required: boolean }
const lit = (v: unknown, u: string) =>
  v === null ? 'null' : typeof v === 'boolean' || typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'::${u}`;
const BY_NAME: Record<string, string> = { currency: "'eur'", fingerprint: "'empreinte-test'", time_zone: "'Europe/Brussels'", endpoint: "'https://push.test/x'" };

function fallback(col: Col, checks: string[]): string {
  const name = `(?<![a-z_])${col.c}(?![a-z_])`;
  if (BY_NAME[col.c]) return BY_NAME[col.c]!;
  const mine = checks.filter((x) => new RegExp(name).test(x));
  const listed = mine.map((x) => new RegExp(`${name}\\)?(?:::text)? = ANY \\(ARRAY\\['([^']+)'`).exec(x)?.[1]).find(Boolean);
  switch (col.u) {
    case 'uuid': return 'gen_random_uuid()';
    case 'text': case 'varchar': return listed ? `'${listed}'` : "('t' || substr(md5(random()::text), 1, 11))";
    case 'int2': case 'int4': case 'int8': case 'numeric': case 'float8': {
      const min = mine.map((x) => new RegExp(`${name}\\)? >= \\(?(\\d+)`).exec(x)?.[1]).find(Boolean);
      return min ? min : '1';
    }
    case 'bool': return 'false';
    case 'date': return 'current_date';
    case 'timestamptz': case 'timestamp': return 'now()';
    case 'jsonb': case 'json': return mine.some((x) => x.includes(`jsonb_typeof(${col.c}) = 'array'`)) ? "'[]'::jsonb" : "'{}'::jsonb";
    case 'time': return "'08:00'";
    default: return col.u.startsWith('_') ? "'{}'" : "'x'";
  }
}

async function fill(tx: Tx, table: string, rows: Row[]) {
  const cols = (await tx.query<{ c: string; u: string; n: string; d: string | null; g: string }>(
    `select column_name as c, udt_name as u, is_nullable as n, column_default as d, is_generated as g
     from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position`, [table],
  )).rows.map((x) => ({ c: x.c, u: x.u, required: x.n === 'NO' && !x.d && x.g !== 'ALWAYS' }));
  const checks = (await tx.query<{ s: string }>(
    `select pg_get_constraintdef(oid) as s from pg_constraint where contype = 'c' and conrelid = ('public.' || $1)::regclass`, [table],
  )).rows.map((x) => x.s);
  for (const row of rows) {
    const names: string[] = [];
    const values: string[] = [];
    for (const col of cols) {
      if (col.c in row) { names.push(col.c); values.push(lit(row[col.c], col.u)); }
      else if (col.required) { names.push(col.c); values.push(fallback(col, checks)); }
    }
    const sql = `insert into public.${table} (${names.join(', ')}) values (${values.join(', ')})`;
    await tx.exec(sql).catch((e: unknown) => { throw new Error(`${table} : ${(e as Error).message}\n${sql}`); });
  }
}

// ---------- Lecture sous chaque profil ----------

const TAGS = ['id', 'workspace_id', 'athlete_id', 'user_id', 'coach_id', 'author_id', 'created_by', 'assignee_id', 'owner_id', 'team_id', 'shared', 'workout_id', 'number'];
let db: Db;
let tables: string[] = [];
let inserted: Record<string, Row[]> = {};
const seen = new Map<string, Map<string, Row[]>>();

const describeRow = (t: string, r: Row) =>
  `${t}(${['workspace_id', 'athlete_id', 'user_id', 'coach_id', 'owner_id', 'team_id', 'id', 'number', 'shared']
    .filter((c) => r[c] != null && (NAMES[s(r[c])] || c === 'number' || c === 'shared'))
    .map((c) => `${c}=${NAMES[s(r[c])] ?? s(r[c])}`).join(', ')})`;

beforeAll(async () => {
  db = await openDatabase();
  setDb(db);
  tables = (await db.query<{ t: string }>(
    `select c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('authenticated', c.oid, 'SELECT') order by 1`,
  )).rows.map((x) => x.t);
  inserted = plan();
  // Lignes posées hors des commandes, contraintes de clés et déclencheurs suspendus le temps du remplissage (base en mémoire, jetée à la fin).
  await db.transaction(async (tx) => {
    await tx.exec('set local session_replication_role = replica');
    for (const [t, rows] of Object.entries(inserted)) await fill(tx, t, rows);
  });
  published = new Set((await db.query<{ v: string }>(
    `select r.workout_id::text || ':' || r.number as v from public.workout_revisions r
     join public.workouts w on w.workspace_id = r.workspace_id and w.athlete_id = r.athlete_id and w.id = r.workout_id
     where w.published_revision = r.number or exists (select 1 from public.workout_results x where x.workspace_id = r.workspace_id
       and x.athlete_id = r.athlete_id and x.workout_id = r.workout_id and x.workout_revision = r.number)`,
  )).rows.map((x) => x.v));
  for (const who of WHO) {
    const mine = new Map<string, Row[]>();
    for (const t of tables) {
      const cols = (await db.query<{ c: string }>(
        `select a.attname as c from pg_attribute a where a.attrelid = ('public.' || $1)::regclass and a.attnum > 0
         and not a.attisdropped and a.attname = any($2::text[]) and has_column_privilege('authenticated', a.attrelid, a.attnum, 'SELECT')
         order by a.attnum`,
        [t, TAGS],
      )).rows.map((x) => x.c);
      mine.set(t, await readAs(who.id, async (tx) => (await tx.query<Row>(`select ${cols.length ? cols.join(', ') : '1 as one'} from public.${t}`)).rows));
    }
    seen.set(who.id, mine);
  }
}, 120_000);

const visible = (who: Who, t: string) => seen.get(who.id)!.get(t)!;
const matches = (want: Row, got: Row) => Object.keys(want).filter((c) => TAGS.includes(c) && c in got).every((c) => s(want[c]) === s(got[c]));

describe('droits en base, au comportement : chaque table, chaque profil (D-161)', () => {
  it('chaque table lisible a sa règle et des lignes fictives dans les deux espaces', () => {
    expect(Object.keys(RULES).sort()).toEqual([...tables].sort());
    // Les comptes, espaces, élèves, équipes et affectations des deux espaces viennent déjà des données fictives.
    const seeded = ['sports', 'users', 'workspaces', 'athletes', 'memberships', 'coach_assignments'];
    const missing = tables.filter((t) => !seeded.includes(t))
      .filter((t) => !(inserted[t] ?? []).some((r) => r.workspace_id === A) || !(inserted[t] ?? []).some((r) => r.workspace_id === B));
    expect(missing).toEqual([]);
  });

  it('chacun ne voit que ce qui lui est permis', () => {
    const leaks: string[] = [];
    for (const who of WHO) for (const t of tables) {
      for (const r of visible(who, t)) if (!RULES[t]!(who, r)) leaks.push(`${who.name} voit ${describeRow(t, r)}`);
    }
    expect(leaks).toEqual([]);
  });

  it('chacun voit tout ce qui lui est permis (sans quoi le contrôle précédent ne prouverait rien)', () => {
    const hidden: string[] = [];
    let positives = 0;
    for (const who of WHO) for (const [t, rows] of Object.entries(inserted)) {
      for (const want of rows) {
        if (!RULES[t]!(who, want)) continue;
        positives += 1;
        if (!visible(who, t).some((got) => matches(want, got))) hidden.push(`${who.name} ne voit pas ${describeRow(t, want)}`);
      }
    }
    expect(hidden).toEqual([]);
    expect(positives).toBeGreaterThan(80);
  });

  it('un élève ne voit rien d’un autre élève, dans aucune table', () => {
    const camille = WHO.find((x) => x.id === USERS.camille)!;
    const noah = WHO.find((x) => x.id === USERS.noah)!;
    const crossed = tables.flatMap((t) => [
      ...visible(camille, t).filter((r) => s(r.athlete_id) === ATHLETES.noah || s(r.user_id) === USERS.noah).map((r) => `Camille voit ${describeRow(t, r)}`),
      ...visible(noah, t).filter((r) => s(r.athlete_id) === ATHLETES.camille || s(r.user_id) === USERS.camille).map((r) => `Noah voit ${describeRow(t, r)}`),
    ]);
    expect(crossed).toEqual([]);
  });

  it('rien ne traverse deux espaces, dans aucune table', () => {
    const crossed: string[] = [];
    for (const who of WHO) {
      const mine = new Set([...who.coach, ...who.own.map((x) => x.split(':')[0]!)]);
      const other = mine.has(A) ? B : mine.has(B) ? A : null;
      if (!other) continue;
      for (const t of tables) for (const r of visible(who, t)) {
        if (s(r.workspace_id) === other || (t === 'workspaces' && s(r.id) === other)) crossed.push(`${who.name} voit ${describeRow(t, r)}`);
      }
    }
    expect(crossed).toEqual([]);
  });

  it('un coach sans affectation, à l’affectation terminée ou retiré de l’espace ne voit aucun dossier d’élève', () => {
    const files: string[] = [];
    for (const who of WHO.filter((x) => x.id === ZOE || x.id === YANN)) {
      for (const t of tables) for (const r of visible(who, t)) {
        // Accepté (D-161) : sa propre ligne d’affectation, identifiants et dates seulement, sans nom ni donnée de l’élève.
        if (t === 'coach_assignments' && s(r.coach_id) === who.id) continue;
        if (r.athlete_id != null || t === 'athletes') files.push(`${who.name} voit ${describeRow(t, r)}`);
      }
    }
    expect(files).toEqual([]);
    const yann = WHO.find((x) => x.id === YANN)!;
    const anything = tables.filter((t) => !['sports', 'users', 'memberships', 'coach_assignments'].includes(t) && visible(yann, t).length > 0);
    expect(anything).toEqual([]);
  });

  it('un élève ne voit jamais une version de séance non publiée', () => {
    for (const [who, workout] of [[USERS.camille, W.camille], [USERS.noah, W.noah], [USERS.lea, W.lea]] as const) {
      const revs = visible(WHO.find((x) => x.id === who)!, 'workout_revisions').filter((r) => s(r.workout_id) === workout).map((r) => Number(r.number));
      expect(revs).toEqual([1]);
    }
    const marine = visible(WHO.find((x) => x.id === USERS.marine)!, 'workout_revisions').filter((r) => s(r.workout_id) === W.camille).map((r) => Number(r.number)).sort();
    expect(marine).toEqual([1, 2]);
  });

  it('le travail du coach reste invisible à l’élève : notes, plans, décisions, propositions, file des retours, rendez-vous', () => {
    const coachOnly = ['ai_suggestions', 'appointments', 'coach_notes', 'dna_candidates', 'goal_decisions', 'plan_blocks', 'plans',
      'review_items', 'coach_tasks', 'coach_dna', 'auto_rule_settings', 'auto_task_states', 'relance_templates', 'templates',
      'group_sessions', 'invoices', 'subscriptions', 'coach_assignments', 'workouts', 'team_athletes'];
    for (const who of WHO.filter((x) => x.own.length)) {
      expect(coachOnly.filter((t) => visible(who, t).length > 0)).toEqual([]);
    }
  });
});
