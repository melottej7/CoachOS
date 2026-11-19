import { addDays, todayIn, weekStart } from '@coachos/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb } from './db/client';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A } from './db/fixtures';
import { athleteMeasureFacts, athleteWeekReview } from './repo/week-review';

// D-073 : résumé de semaine lu sous RLS par le coach affecté, sur les séances publiées du jeu fictif.

beforeAll(async () => { setDb(await openDatabase()); });

describe('résumé de la semaine (serveur)', () => {
  it('le coach affecté lit le résumé ; l’élève et un autre élève non (affiché au coach seulement)', async () => {
    const today = todayIn(TIME_ZONE);
    const monday = weekStart(addDays(today, -1));
    const coach = await athleteWeekReview(USERS.marine, WORKSPACE_A, ATHLETES.camille, monday, today);
    expect(coach).not.toBeNull();
    expect(await athleteWeekReview(USERS.camille, WORKSPACE_A, ATHLETES.camille, monday, today)).toBeNull();
    expect(coach!.facts.length).toBeGreaterThanOrEqual(1);
    expect(coach!.facts.length).toBeLessThanOrEqual(3);
    expect(await athleteWeekReview(USERS.noah, WORKSPACE_A, ATHLETES.camille, monday, today)).toBeNull();
  });

  it('fraîcheur des mesures (D-075) : retours comptés, coach affecté seulement', async () => {
    const today = todayIn(TIME_ZONE);
    const f = (await athleteMeasureFacts(USERS.marine, WORKSPACE_A, ATHLETES.camille, today, TIME_ZONE))!;
    expect(f).toMatchObject({ windowDays: 30, activities: 0, lastActivity: null });
    expect(f.feedbacks).toBeGreaterThanOrEqual(1);
    expect(f.fromWatch).toBeLessThanOrEqual(f.feedbacks);
    expect(await athleteMeasureFacts(USERS.camille, WORKSPACE_A, ATHLETES.camille, today, TIME_ZONE)).toBeNull();
  });
});

