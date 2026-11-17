import { addDays, todayIn } from '@coachos/domain';
import type { Db, Tx } from './driver';
import { ATHLETES, PEOPLE, TIME_ZONE, USERS, WORKSPACE_A, WORKSPACE_B } from './fixtures';

type Q = Tx;

/** Crée les comptes d’authentification fictifs (auth.users) avant les données métier. */
export type EnsureAuthUsers = (people: typeof PEOPLE) => Promise<void>;

/** PGlite : auth.users est une table locale (shim). Supabase : voir scripts/supabase-seed.ts. */
export const pgliteAuthUsers = (db: Db): EnsureAuthUsers => async (people) => {
  for (const p of people) {
    await db.query('insert into auth.users(id, email) values ($1, $2) on conflict (id) do nothing', [p.id, p.email]);
  }
};

interface SeedWorkout {
  id: string;
  workspace: string;
  athlete: string;
  offset: number; // jours par rapport à aujourd’hui
  sport: string;
  title: string;
  minutes: number;
  instructions: string;
  published: boolean;
}

const W = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const SEED_WORKOUTS = {
  camilleYesterday: W(1),
  camilleToday: W(2),
  camilleDraft: W(3),
  camilleLong: W(4),
  noahToday: W(5),
  leaToday: W(6),
} as const;

const workouts: SeedWorkout[] = [
  { id: SEED_WORKOUTS.camilleYesterday, workspace: WORKSPACE_A, athlete: ATHLETES.camille, offset: -1, sport: 'running', title: 'Endurance fondamentale', minutes: 40, instructions: '40 min à une allure qui permet de parler en phrases complètes.', published: true },
  { id: SEED_WORKOUTS.camilleToday, workspace: WORKSPACE_A, athlete: ATHLETES.camille, offset: 0, sport: 'running', title: 'Footing facile', minutes: 35, instructions: '10 min très faciles, 20 min à une allure de conversation, puis 5 min de retour au calme.', published: true },
  { id: SEED_WORKOUTS.camilleDraft, workspace: WORKSPACE_A, athlete: ATHLETES.camille, offset: 2, sport: 'trail', title: 'Montées régulières', minutes: 45, instructions: 'Après l’échauffement, faire 6 montées de 45 s à effort régulier, récupération en descente.', published: false },
  { id: SEED_WORKOUTS.camilleLong, workspace: WORKSPACE_A, athlete: ATHLETES.camille, offset: 5, sport: 'running', title: 'Sortie longue', minutes: 65, instructions: 'Sortie à allure facile avec une pause si nécessaire.', published: true },
  { id: SEED_WORKOUTS.noahToday, workspace: WORKSPACE_A, athlete: ATHLETES.noah, offset: 0, sport: 'cycling', title: 'Sortie souple', minutes: 50, instructions: 'Rester souple et régulier en choisissant un braquet confortable.', published: true },
  { id: SEED_WORKOUTS.leaToday, workspace: WORKSPACE_B, athlete: ATHLETES.lea, offset: 0, sport: 'trail', title: 'Côtes en forêt', minutes: 55, instructions: '8 côtes de 1 min, retour en trottinant.', published: true },
];

/** Vide les données (pas le schéma). TRUNCATE ne déclenche pas les triggers d’immutabilité par ligne. */
export async function clearData(db: Db, opts: { deleteAuthUsers: boolean } = { deleteAuthUsers: true }): Promise<void> {
  const tables = await db.query<{ t: string }>(
    `select format('%I.%I', schemaname, tablename) as t from pg_tables
     where schemaname = 'public' and tablename <> 'sports'`,
  );
  await db.exec(`truncate ${tables.rows.map((r) => r.t).join(', ')} cascade`);
  // Sur Supabase, les comptes auth sont gérés par l’API d’administration (scripts/supabase-seed.ts).
  if (opts.deleteAuthUsers) await db.exec('delete from auth.users');
}

export async function seed(db: Db, opts: { now?: Date; ensureAuthUsers: EnsureAuthUsers }): Promise<void> {
  const today = todayIn(TIME_ZONE, opts.now ?? new Date());
  await opts.ensureAuthUsers(PEOPLE);
  await db.transaction(async (tx) => {
    await insertBase(tx);
    for (const w of workouts) await insertWorkout(tx, w, addDays(today, w.offset));
    // Retour d’hier de Camille, non traité : alimente la file du coach dès l’ouverture.
    const result = await tx.query<{ id: string }>(
      `insert into public.workout_results(workspace_id, athlete_id, workout_id, workout_revision, state, duration_seconds, source)
       values ($1, $2, $3, 1, 'completed', 2400, 'manual') returning id`,
      [WORKSPACE_A, ATHLETES.camille, SEED_WORKOUTS.camilleYesterday],
    );
    const feedback = await tx.query<{ id: string }>(
      `insert into public.feedbacks(workspace_id, athlete_id, result_id, rpe, comment)
       values ($1, $2, $3, 4, 'Jambes un peu lourdes au départ.') returning id`,
      [WORKSPACE_A, ATHLETES.camille, result.rows[0]!.id],
    );
    await tx.query(
      `insert into public.review_items(workspace_id, athlete_id, kind, state, source_ref, rank)
       values ($1, $2, 'feedback', 'open', $3, 1)`,
      [WORKSPACE_A, ATHLETES.camille, feedback.rows[0]!.id],
    );
  });
}

async function insertBase(tx: Q) {
  for (const p of PEOPLE) {
    await tx.query('insert into public.users(id, display_name) values ($1, $2)', [p.id, p.name]);
  }
  await tx.query('insert into public.workspaces(id, name, time_zone) values ($1, $2, $3), ($4, $5, $3)', [
    WORKSPACE_A, 'Atelier Endurance', TIME_ZONE, WORKSPACE_B, 'Club Trail Ardennes',
  ]);
  await tx.query(`insert into public.memberships(workspace_id, user_id, role) values ($1, $2, 'owner'), ($3, $4, 'owner')`, [
    WORKSPACE_A, USERS.marine, WORKSPACE_B, USERS.hugo,
  ]);
  const athletes: [string, string, string | null, string, string, string][] = [
    [WORKSPACE_A, ATHLETES.camille, USERS.camille, 'Camille Laurent', 'active', USERS.marine],
    [WORKSPACE_A, ATHLETES.noah, USERS.noah, 'Noah Dubois', 'active', USERS.marine],
    [WORKSPACE_A, ATHLETES.ines, null, 'Inès Martin', 'invited', USERS.marine],
    [WORKSPACE_B, ATHLETES.lea, USERS.lea, 'Léa Moreau', 'active', USERS.hugo],
  ];
  for (const [w, id, user, name, state, coach] of athletes) {
    await tx.query(
      'insert into public.athletes(workspace_id, id, user_id, display_name, time_zone, state) values ($1, $2, $3, $4, $5, $6)',
      [w, id, user, name, TIME_ZONE, state],
    );
    await tx.query(
      `insert into public.coach_assignments(workspace_id, athlete_id, coach_id, starts_at) values ($1, $2, $3, now() - interval '30 days')`,
      [w, id, coach],
    );
  }
}

async function insertWorkout(tx: Q, w: SeedWorkout, localDate: string) {
  await tx.query(
    'insert into public.workouts(workspace_id, athlete_id, id, working_revision, published_revision) values ($1, $2, $3, 1, $4)',
    [w.workspace, w.athlete, w.id, w.published ? 1 : null],
  );
  await tx.query(
    `insert into public.workout_revisions(workspace_id, athlete_id, workout_id, number, local_date, time_zone, sport_code, title, instructions, duration_seconds)
     values ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9)`,
    [w.workspace, w.athlete, w.id, localDate, TIME_ZONE, w.sport, w.title, w.instructions, w.minutes * 60],
  );
  if (w.published) {
    const pub = await tx.query<{ id: string }>(
      `insert into public.publications(workspace_id, athlete_id, actor_id, kind) values ($1, $2, null, 'publish') returning id`,
      [w.workspace, w.athlete],
    );
    await tx.query(
      'insert into public.publication_items(workspace_id, athlete_id, publication_id, workout_id, number) values ($1, $2, $3, $4, 1)',
      [w.workspace, w.athlete, pub.rows[0]!.id, w.id],
    );
  }
}
