import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { beforeAll, describe, expect, it } from 'vitest';
import { addDays, todayIn, type Block } from '@coachos/domain';
import { openDatabase, setDb } from './db/client';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A } from './db/fixtures';
import { repoRoot } from './db/migrate';
import { AppError } from './errors';
import { createWorkout, publishWorkouts } from './commands/workouts';
import { coachWorkout } from './repo/coach';
import { athleteWorkout } from './repo/athlete';

// D-164 · Cardio sur machine en paliers : enregistré, relu par le coach et par l’élève une fois publié, conforme au contrat.

const spec = JSON.parse(fs.readFileSync(path.join(repoRoot(), 'contracts', 'openapi.json'), 'utf8'));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(spec, 'openapi');
const stepContract = ajv.getSchema('openapi#/components/schemas/workoutStep')!;

const stage = (minutes: number, extra: Record<string, unknown> = {}) => ({ seconds: minutes * 60, ...extra });
const program: Block[] = [
  {
    type: 'step', phase: 'warmup', sport: null, measure: { kind: 'time', seconds: 19 * 60 }, intensity: { kind: 'none' }, cadence: null, note: null,
    cardio: { machine: 'elliptical', stages: [stage(5, { level: 1 }), stage(7, { level: 2 }), stage(5, { level: 3 }), stage(2, { level: 1 })] },
  } as Block,
  {
    type: 'repeat', times: 3, steps: [
      { type: 'step', phase: 'work', sport: null, measure: { kind: 'reps', reps: 10 }, intensity: { kind: 'load', min: 20, max: null }, cadence: null, note: null, exercise: { id: null, name: 'Squat' } },
      { type: 'step', phase: 'rest', sport: null, measure: { kind: 'time', seconds: 60 }, intensity: { kind: 'none' }, cadence: null, note: null },
    ],
  },
  {
    type: 'step', phase: 'cooldown', sport: null, measure: { kind: 'time', seconds: 15 * 60 }, intensity: { kind: 'none' }, cadence: null, note: null,
    exercise: { id: null, name: 'Marche rapide' },
    cardio: { machine: 'treadmill', stages: [stage(10, { speedKmh: 5.5, inclinePct: 6 }), stage(5, { speedKmh: 4.5, note: 'mains libres' })] },
  } as Block,
];

const meta = (actorId: string) => ({ actorId, workspaceId: WORKSPACE_A, athleteId: ATHLETES.camille, idempotencyKey: randomUUID(), requestId: randomUUID() });
const data = (intervals: unknown) => ({ localDate: addDays(todayIn(TIME_ZONE), 2), timeZone: TIME_ZONE, sport: 'strength', title: 'Salle complète', intervals });

beforeAll(async () => {
  setDb(await openDatabase());
});

describe('cardio sur machine en paliers, de bout en bout côté serveur (D-164)', () => {
  it('le coach enregistre un programme complet, le relit tel quel, et chaque étape respecte le contrat', async () => {
    const created = await createWorkout(meta(USERS.marine), { data: data(program) });
    expect(created.status).toBe(201);
    const id = (created.body as { id: string }).id;
    const seen = await coachWorkout(USERS.marine, WORKSPACE_A, ATHLETES.camille, id);
    const blocks = seen!.working.intervals;
    expect(blocks[0]).toMatchObject({ cardio: { machine: 'elliptical', stages: [{ seconds: 300, level: 1 }, { seconds: 420, level: 2 }, { seconds: 300, level: 3 }, { seconds: 120, level: 1 }] } });
    expect(blocks[2]).toMatchObject({ cardio: { machine: 'treadmill', stages: [{ speedKmh: 5.5, inclinePct: 6 }, { note: 'mains libres' }] } });
    for (const b of blocks.filter((x) => x.type === 'step')) expect(stepContract(b), JSON.stringify(stepContract.errors)).toBe(true);

    // Publiée, l’élève la lit avec ses paliers.
    await publishWorkouts(meta(USERS.marine), { changes: [{ id, revision: 1 }] });
    const mine = await athleteWorkout(USERS.camille, WORKSPACE_A, ATHLETES.camille, id);
    expect(mine!.workout.intervals[0]).toMatchObject({ cardio: { machine: 'elliptical' } });
  });

  it('refuse une durée qui n’est pas la somme des paliers (champs à corriger)', async () => {
    const wrong = [{ ...program[0]!, measure: { kind: 'time', seconds: 20 * 60 } }];
    try {
      await createWorkout(meta(USERS.marine), { data: data(wrong) });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe('INVALID_FIELDS');
    }
  });
});
