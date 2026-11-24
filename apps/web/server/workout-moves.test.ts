import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { beforeAll, describe, expect, it } from 'vitest';
import { addDays } from '@coachos/domain';
import { openDatabase, setDb, type Db } from './db/client';
import { ATHLETES, USERS, WORKSPACE_A } from './db/fixtures';
import { repoRoot } from './db/migrate';
import { SEED_WORKOUTS } from './db/seed';
import { AppError } from './errors';
import { copyWorkout, discardWorkout, moveWorkout, restoreWorkout } from './commands/workout-moves';

// D-158 · Gestes du calendrier : déplacer, copier, retirer un brouillon, le rétablir ; droits, conflits, contrat OpenAPI.

let db: Db;
const spec = JSON.parse(fs.readFileSync(path.join(repoRoot(), 'contracts', 'openapi.json'), 'utf8'));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(spec, 'openapi');
const ptr = (...parts: string[]) => parts.map((p) => encodeURIComponent(p.replace(/~/g, '~0').replace(/\//g, '~1'))).join('/');
function conforms(op: string, status: number, body: unknown) {
  const validate = ajv.getSchema(`openapi#/${ptr('paths', `/workspaces/{wid}/athletes/{aid}/workouts/{sid}/${op}`, 'post', 'responses', String(status), 'content', 'application/json', 'schema')}`)!;
  expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
}

const meta = (actorId: string, workoutId: string, athleteId: string = ATHLETES.camille) =>
  ({ actorId, workspaceId: WORKSPACE_A, athleteId, workoutId, idempotencyKey: randomUUID(), requestId: randomUUID() });
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}
async function state(sid: string) {
  const r = await db.query<{ working_revision: number; published_revision: number | null; local_date: string; canceled: boolean; title: string; time_zone: string; athlete_id: string }>(
    `select w.working_revision, w.published_revision, to_char(r.local_date, 'YYYY-MM-DD') as local_date, r.canceled, r.title, r.time_zone, w.athlete_id
       from public.workouts w join public.workout_revisions r on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id and r.workout_id = w.id and r.number = w.working_revision
      where w.id = $1`, [sid]);
  return r.rows[0]!;
}

beforeAll(async () => {
  db = await openDatabase();
  setDb(db);
});

describe('déplacer une séance (D-158)', () => {
  it('brouillon : même contenu, autre date ; même clé rejouée, même réponse ; annuler = redéplacer', async () => {
    const before = await state(SEED_WORKOUTS.camilleDraft);
    const target = addDays(before.local_date, 1);
    const m = meta(USERS.marine, SEED_WORKOUTS.camilleDraft);
    const r = await moveWorkout(m, { expectedRevision: before.working_revision, localDate: target });
    conforms('move', 200, r.body);
    expect(r.body).toMatchObject({ workingRevision: before.working_revision + 1, previousDate: before.local_date, published: false });
    expect(await moveWorkout(m, { expectedRevision: before.working_revision, localDate: target })).toEqual(r);
    const after = await state(SEED_WORKOUTS.camilleDraft);
    expect(after).toMatchObject({ local_date: target, title: before.title, published_revision: null, canceled: false });
    // Annulation des 10 secondes : le geste inverse.
    await moveWorkout(meta(USERS.marine, SEED_WORKOUTS.camilleDraft), { expectedRevision: after.working_revision, localDate: before.local_date });
    expect((await state(SEED_WORKOUTS.camilleDraft)).local_date).toBe(before.local_date);
  });

  it('publiée : la version publiée ne bouge pas avant la republication', async () => {
    const before = await state(SEED_WORKOUTS.camilleToday);
    const r = await moveWorkout(meta(USERS.marine, SEED_WORKOUTS.camilleToday), { expectedRevision: before.working_revision, localDate: addDays(before.local_date, 2) });
    expect(r.body).toMatchObject({ published: true });
    const after = await state(SEED_WORKOUTS.camilleToday);
    expect(after.published_revision).toBe(before.published_revision);
    expect(after.working_revision).toBe(before.working_revision + 1);
  });

  it('refus : révision périmée, séance déjà renseignée, même date, autre coach, élève', async () => {
    const d = await state(SEED_WORKOUTS.camilleDraft);
    expect(await codeOf(moveWorkout(meta(USERS.marine, SEED_WORKOUTS.camilleDraft), { expectedRevision: d.working_revision - 1, localDate: addDays(d.local_date, 3) }))).toBe('CONFLICT_OR_QUOTA');
    const y = await state(SEED_WORKOUTS.camilleYesterday);
    expect(await codeOf(moveWorkout(meta(USERS.marine, SEED_WORKOUTS.camilleYesterday), { expectedRevision: y.working_revision, localDate: addDays(y.local_date, 1) }))).toBe('CONFLICT_OR_QUOTA');
    expect(await codeOf(moveWorkout(meta(USERS.marine, SEED_WORKOUTS.camilleDraft), { expectedRevision: d.working_revision, localDate: d.local_date }))).toBe('INVALID_FIELDS');
    expect(await codeOf(moveWorkout(meta(USERS.hugo, SEED_WORKOUTS.camilleDraft), { expectedRevision: d.working_revision, localDate: addDays(d.local_date, 1) }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(moveWorkout(meta(USERS.camille, SEED_WORKOUTS.camilleDraft), { expectedRevision: d.working_revision, localDate: addDays(d.local_date, 1) }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(moveWorkout(meta(USERS.marine, SEED_WORKOUTS.camilleDraft), { expectedRevision: d.working_revision, localDate: '2026-02-30' }))).toBe('INVALID_FIELDS');
    expect((await state(SEED_WORKOUTS.camilleDraft)).working_revision).toBe(d.working_revision);
  });
});

describe('copier une séance (D-158)', () => {
  it('pour le même élève et pour un autre élève suivi : brouillons, fuseau de l’élève visé', async () => {
    const src = await state(SEED_WORKOUTS.camilleToday);
    const same = await copyWorkout(meta(USERS.marine, SEED_WORKOUTS.camilleToday), { localDate: addDays(src.local_date, 7) });
    conforms('copy', 201, same.body);
    const a = await state((same.body as { id: string }).id);
    expect(a).toMatchObject({ athlete_id: ATHLETES.camille, published_revision: null, title: src.title, local_date: addDays(src.local_date, 7), working_revision: 1 });
    const other = await copyWorkout(meta(USERS.marine, SEED_WORKOUTS.camilleToday), { localDate: addDays(src.local_date, 1), athleteId: ATHLETES.noah });
    expect(other.body).toMatchObject({ athleteId: ATHLETES.noah });
    const b = await state((other.body as { id: string }).id);
    const tz = await db.query<{ time_zone: string }>('select time_zone from public.athletes where id = $1', [ATHLETES.noah]);
    expect(b).toMatchObject({ athlete_id: ATHLETES.noah, time_zone: tz.rows[0]!.time_zone, published_revision: null });
  });

  it('refus : élève d’un autre espace, coach d’un autre espace, élève', async () => {
    expect(await codeOf(copyWorkout(meta(USERS.marine, SEED_WORKOUTS.camilleToday), { localDate: '2026-12-01', athleteId: ATHLETES.lea }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(copyWorkout(meta(USERS.hugo, SEED_WORKOUTS.camilleToday), { localDate: '2026-12-01' }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(copyWorkout(meta(USERS.camille, SEED_WORKOUTS.camilleToday), { localDate: '2026-12-01' }))).toBe('RESOURCE_NOT_VISIBLE');
  });
});

describe('retirer un brouillon, le rétablir (D-158)', () => {
  it('brouillon retiré puis rétabli à l’identique ; une séance publiée ne se retire pas d’ici', async () => {
    const d = await state(SEED_WORKOUTS.camilleDraft);
    const r = await discardWorkout(meta(USERS.marine, SEED_WORKOUTS.camilleDraft), { expectedRevision: d.working_revision });
    conforms('discard', 200, r.body);
    expect(await state(SEED_WORKOUTS.camilleDraft)).toMatchObject({ canceled: true, published_revision: null });
    expect(await codeOf(discardWorkout(meta(USERS.marine, SEED_WORKOUTS.camilleDraft), { expectedRevision: d.working_revision + 1 }))).toBe('CONFLICT_OR_QUOTA');
    const back = await restoreWorkout(meta(USERS.marine, SEED_WORKOUTS.camilleDraft), { expectedRevision: d.working_revision + 1 });
    conforms('restore', 200, back.body);
    expect(await state(SEED_WORKOUTS.camilleDraft)).toMatchObject({ canceled: false, title: d.title, local_date: d.local_date, working_revision: d.working_revision + 2 });
    expect(await codeOf(restoreWorkout(meta(USERS.marine, SEED_WORKOUTS.camilleDraft), { expectedRevision: d.working_revision + 2 }))).toBe('CONFLICT_OR_QUOTA');
    const p = await state(SEED_WORKOUTS.camilleToday);
    expect(await codeOf(discardWorkout(meta(USERS.marine, SEED_WORKOUTS.camilleToday), { expectedRevision: p.working_revision }))).toBe('CONFLICT_OR_QUOTA');
    expect(await codeOf(discardWorkout(meta(USERS.hugo, SEED_WORKOUTS.camilleDraft), { expectedRevision: d.working_revision + 2 }))).toBe('RESOURCE_NOT_VISIBLE');
  });
});
