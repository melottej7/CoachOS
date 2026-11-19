import { randomUUID } from 'node:crypto';
import { addDays, todayIn, weekStart } from '@coachos/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, readAs, setDb } from './db/client';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { confirmLevel, createGoal, createNote, createTeam, deleteNote, setTeamMember, updateGoal, updateTeam } from './commands/portfolio';
import { createAppointment, createTask, saveAutoRuleSettings, snoozeAutoTask, updateAppointment, updateTask } from './commands/tasks';
import { athleteFile, autoRuleSettings, home, portfolio } from './repo/portfolio';
import { saveAthleteProfile } from './commands/athlete-profile';

// Lots G et H (D-032) : droits, règles et lectures.

const meta = (actorId: string) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A });
async function codeOf(p: Promise<unknown>) {
  try {
    await p;
    return 'OK';
  } catch (e) {
    if (e instanceof AppError) return e.code;
    throw e;
  }
}
const idOf = (r: { body: unknown }) => (r.body as { id?: string; item?: { id: string } }).id ?? (r.body as { item: { id: string } }).item.id;

beforeAll(async () => {
  setDb(await openDatabase());
});

describe('lot G · groupes, niveaux, objectifs, notes', () => {
  let marathon = '', mardi = '';

  it('le propriétaire crée des groupes ; nom unique ; ni élève ni coach d’un autre espace', async () => {
    marathon = idOf(await createTeam(meta(USERS.marine), { name: 'Préparation marathon' }));
    mardi = idOf(await createTeam(meta(USERS.marine), { name: 'Groupe du mardi' }));
    expect(await codeOf(createTeam(meta(USERS.marine), { name: 'préparation MARATHON' }))).toBe('CONFLICT_OR_QUOTA');
    expect(await codeOf(createTeam(meta(USERS.camille), { name: 'Pirates' }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(createTeam(meta(USERS.hugo), { name: 'Pirates' }))).toBe('RESOURCE_NOT_VISIBLE');
  });

  it('un élève appartient à deux groupes ; vue d’ensemble ; retrait ; archivage', async () => {
    await setTeamMember({ ...meta(USERS.marine), teamId: marathon, athleteId: ATHLETES.camille }, true);
    await setTeamMember({ ...meta(USERS.marine), teamId: mardi, athleteId: ATHLETES.camille }, true);
    await setTeamMember({ ...meta(USERS.marine), teamId: mardi, athleteId: ATHLETES.noah }, true);
    let p = await portfolio(USERS.marine, WORKSPACE_A, TIME_ZONE);
    expect(p.roster.find((a) => a.id === ATHLETES.camille)!.teams.map((t) => t.name).sort()).toEqual(['Groupe du mardi', 'Préparation marathon']);
    expect(p.teams.find((t) => t.id === mardi)).toMatchObject({ members: 2, archived: false });
    await setTeamMember({ ...meta(USERS.marine), teamId: mardi, athleteId: ATHLETES.noah }, false);
    // « Groupe du mardi » placé avant « Préparation marathon ».
    await updateTeam({ ...meta(USERS.marine), teamId: mardi }, { sortOrder: 0 });
    expect((await portfolio(USERS.marine, WORKSPACE_A, TIME_ZONE)).teams.slice(0, 2).map((t) => t.name)).toEqual(['Groupe du mardi', 'Préparation marathon']);
    await updateTeam({ ...meta(USERS.marine), teamId: marathon }, { name: 'Marathon de printemps', sortOrder: 0 });
    await updateTeam({ ...meta(USERS.marine), teamId: mardi }, { archived: true });
    p = await portfolio(USERS.marine, WORKSPACE_A, TIME_ZONE);
    expect(p.roster.find((a) => a.id === ATHLETES.camille)!.teams.map((t) => t.name)).toEqual(['Marathon de printemps']);
    expect(p.teams.find((t) => t.id === mardi)!.archived).toBe(true);
    expect(await codeOf(setTeamMember({ ...meta(USERS.marine), teamId: mardi, athleteId: ATHLETES.noah }, true))).toBe('ACTION_FORBIDDEN_OR_FEATURE_DISABLED');
    expect(await codeOf(setTeamMember({ ...meta(USERS.hugo), teamId: marathon, athleteId: ATHLETES.camille }, true))).toBe('RESOURCE_NOT_VISIBLE');
  });

  it('le coach confirme un niveau par sport ; l’élève le lit ; personne d’autre ne l’écrit', async () => {
    const r = await confirmLevel({ ...meta(USERS.marine), athleteId: ATHLETES.camille }, { sport: 'trail', level: 'advanced' });
    expect(r.body).toMatchObject({ item: { sport: 'trail', level: 'advanced' } });
    const seen = await readAs(USERS.camille, (tx) => tx.query('select level from public.athlete_sport_levels where athlete_id = $1', [ATHLETES.camille]));
    expect(seen.rows).toEqual([{ level: 'advanced' }]);
    expect(await codeOf(confirmLevel({ ...meta(USERS.camille), athleteId: ATHLETES.camille }, { sport: 'trail', level: 'competitive' }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(confirmLevel({ ...meta(USERS.hugo), athleteId: ATHLETES.camille }, { sport: 'trail', level: 'competitive' }))).toBe('RESOURCE_NOT_VISIBLE');
  });

  it('objectif visible par l’élève ; atteint ; note privée invisible pour l’élève puis effacée', async () => {
    const g = idOf(await createGoal({ ...meta(USERS.marine), athleteId: ATHLETES.camille }, { title: 'Trail des Fagnes 30 km', sport: 'trail', targetDate: '2027-04-18' }));
    await updateGoal({ ...meta(USERS.marine), athleteId: ATHLETES.camille, goalId: g }, { state: 'achieved' });
    const goals = await readAs(USERS.camille, (tx) => tx.query<{ state: string }>('select state from public.goals where id = $1', [g]));
    expect(goals.rows[0]?.state).toBe('achieved');
    const n = idOf(await createNote({ ...meta(USERS.marine), athleteId: ATHLETES.camille }, { body: 'Préfère les séances le matin.' }));
    const asAthlete = await readAs(USERS.camille, (tx) => tx.query('select id from public.coach_notes'));
    expect(asAthlete.rows).toHaveLength(0);
    expect((await athleteFile(USERS.marine, WORKSPACE_A, ATHLETES.camille, TIME_ZONE)).notes.map((x) => x.body)).toContain('Préfère les séances le matin.');
    expect(await codeOf(deleteNote({ ...meta(USERS.hugo), athleteId: ATHLETES.camille, noteId: n }))).toBe('RESOURCE_NOT_VISIBLE');
    await deleteNote({ ...meta(USERS.marine), athleteId: ATHLETES.camille, noteId: n });
    expect((await athleteFile(USERS.marine, WORKSPACE_A, ATHLETES.camille, TIME_ZONE)).notes).toHaveLength(0);
  });
});

describe('lot H · tâches, suivis automatiques, rendez-vous', () => {
  const today = todayIn(TIME_ZONE);

  it('tâche liée à un élève : transitions vérifiées, conflit de révision, autre espace refusé', async () => {
    const r = await createTask(meta(USERS.marine), { title: 'Appeler Camille pour son objectif', kind: 'call', athleteId: ATHLETES.camille, dueOn: addDays(today, -1), priority: 2 });
    const id = idOf(r);
    const h = await home(USERS.marine, WORKSPACE_A, TIME_ZONE, weekStart(today));
    expect(h.tasks[0]).toMatchObject({ source: 'manual', title: 'Appeler Camille pour son objectif' });
    expect(await codeOf(updateTask({ ...meta(USERS.marine), taskId: id }, { expectedRevision: 9, status: 'done' }))).toBe('CONFLICT_OR_QUOTA');
    await updateTask({ ...meta(USERS.marine), taskId: id }, { expectedRevision: 1, status: 'done' });
    expect(await codeOf(updateTask({ ...meta(USERS.marine), taskId: id }, { expectedRevision: 2, status: 'in_progress' }))).toBe('INVALID_FIELDS');
    await updateTask({ ...meta(USERS.marine), taskId: id }, { expectedRevision: 2, status: 'todo', dueOn: null });
    expect(await codeOf(updateTask({ ...meta(USERS.hugo), taskId: id }, { expectedRevision: 3, status: 'done' }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(createTask(meta(USERS.hugo), { title: 'x', kind: 'other', athleteId: ATHLETES.camille }))).toBe('RESOURCE_NOT_VISIBLE');
    const hidden = await readAs(USERS.camille, (tx) => tx.query('select id from public.coach_tasks'));
    expect(hidden.rows).toHaveLength(0);
  });

  it('suivis automatiques uniques par règle et objet, reportables, clos quand l’objet est résolu', async () => {
    let h = await home(USERS.marine, WORKSPACE_A, TIME_ZONE, weekStart(today));
    const keys = h.tasks.filter((t) => t.source === 'auto').map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    const noahGap = h.tasks.find((t) => t.rule === 'profile_missing' && t.athlete?.id === ATHLETES.noah) ?? h.tasks.find((t) => t.source === 'auto' && t.athlete?.id === ATHLETES.noah);
    expect(noahGap).toBeTruthy();
    await snoozeAutoTask({ ...meta(USERS.marine), sourceRef: noahGap!.ref }, { rule: noahGap!.rule, until: addDays(today, 3) });
    h = await home(USERS.marine, WORKSPACE_A, TIME_ZONE, weekStart(today));
    expect(h.tasks.some((t) => t.key === noahGap!.key)).toBe(false);
    await snoozeAutoTask({ ...meta(USERS.marine), sourceRef: noahGap!.ref }, { rule: noahGap!.rule, until: null });
    h = await home(USERS.marine, WORKSPACE_A, TIME_ZONE, weekStart(today));
    expect(h.tasks.some((t) => t.key === noahGap!.key)).toBe(true);
    // Objet résolu : Noah déclare son niveau → « Confirmer le niveau » apparaît, puis disparaît une fois confirmé.
    await saveAthleteProfile({ ...meta(USERS.noah) }, { sport: 'cycling', level: 'intermediate', experience: '1to3', weeklySessions: '2to3' });
    h = await home(USERS.marine, WORKSPACE_A, TIME_ZONE, weekStart(today));
    expect(h.tasks.filter((t) => t.rule === 'level_unconfirmed' && t.athlete?.id === ATHLETES.noah)).toHaveLength(1);
    await confirmLevel({ ...meta(USERS.marine), athleteId: ATHLETES.noah }, { sport: 'cycling', level: 'intermediate' });
    h = await home(USERS.marine, WORKSPACE_A, TIME_ZONE, weekStart(today));
    expect(h.tasks.some((t) => t.rule === 'level_unconfirmed' && t.athlete?.id === ATHLETES.noah)).toBe(false);
  });

  it('rendez-vous à l’heure locale, dans l’agenda de la semaine ; compte rendu ; autre coach refusé', async () => {
    const day = addDays(today, 1);
    const r = await createAppointment(meta(USERS.marine), {
      athleteId: ATHLETES.camille, title: 'Bilan d’objectif', kind: 'video', startsLocal: `${day}T18:30`, timeZone: TIME_ZONE, durationMin: 30,
      videoUrl: 'https://visio.exemple.test/bilan', prepNotes: 'Revoir les 4 dernières semaines',
    });
    const id = idOf(r);
    const h = await home(USERS.marine, WORKSPACE_A, TIME_ZONE, weekStart(day));
    const slot = h.week.find((d) => d.date === day)!.appointments[0]!;
    expect(slot).toMatchObject({ title: 'Bilan d’objectif', localTime: '18:30', athleteName: 'Camille Laurent' });
    await updateAppointment({ ...meta(USERS.marine), appointmentId: id }, { expectedRevision: 1, status: 'done', report: 'Objectif confirmé, 3 séances par semaine.' });
    expect((await athleteFile(USERS.marine, WORKSPACE_A, ATHLETES.camille, TIME_ZONE)).appointments[0]).toMatchObject({ status: 'done', report: 'Objectif confirmé, 3 séances par semaine.' });
    expect(await codeOf(updateAppointment({ ...meta(USERS.hugo), appointmentId: id }, { expectedRevision: 2, status: 'canceled' }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(createAppointment(meta(USERS.marine), { athleteId: ATHLETES.lea, title: 'x', kind: 'call', startsLocal: `${day}T10:00`, timeZone: TIME_ZONE, durationMin: 15 }))).toBe('RESOURCE_NOT_VISIBLE');
    const athleteView = await readAs(USERS.camille, (tx) => tx.query('select id from public.appointments'));
    expect(athleteView.rows).toHaveLength(0);
  });

  it('questionnaire reçu → « Planifier l’appel de bienvenue », clos par un rendez-vous, rouvert s’il est annulé (D-038)', async () => {
    const onboarding = async () => (await home(USERS.marine, WORKSPACE_A, TIME_ZONE, weekStart(today))).tasks.filter((t) => t.rule === 'onboarding_call' && t.athlete?.id === ATHLETES.noah);
    // Noah a rempli son questionnaire dans le test précédent, sans rendez-vous.
    const [task] = await onboarding();
    expect(task).toMatchObject({ kind: 'call', ref: ATHLETES.noah, athlete: { timeZone: TIME_ZONE } });
    const r = await createAppointment(meta(USERS.marine), { athleteId: ATHLETES.noah, title: 'Appel de bienvenue', kind: 'video', startsLocal: `${addDays(today, 2)}T18:00`, timeZone: TIME_ZONE, durationMin: 30 });
    expect(await onboarding()).toHaveLength(0);
    await updateAppointment({ ...meta(USERS.marine), appointmentId: idOf(r) }, { expectedRevision: 1, status: 'canceled' });
    expect(await onboarding()).toHaveLength(1);
    // « Pas besoin d’appel » : mise en attente longue.
    await snoozeAutoTask({ ...meta(USERS.marine), sourceRef: ATHLETES.noah }, { rule: 'onboarding_call', until: addDays(today, 3650) });
    expect(await onboarding()).toHaveLength(0);
  });

  it('réglage des suivis (CE-H-04) : délai pris en compte, règle désactivée puis réactivée, bornes et droits', async () => {
    const tasks = async () => (await home(USERS.marine, WORKSPACE_A, TIME_ZONE, weekStart(today))).tasks;
    expect(await autoRuleSettings(USERS.marine, WORKSPACE_A)).toMatchObject({
      message_reply: { enabled: true, delayDays: 1 }, invite_pending: { enabled: true, delayDays: 3 }, vma_missing: { enabled: true, delayDays: null },
    });
    const invite = (await tasks()).find((t) => t.rule === 'invite_pending' && t.athlete?.id === ATHLETES.ines)!;
    expect(invite).toBeTruthy();
    const save = (actor: string, rules: unknown[]) => saveAutoRuleSettings(meta(actor), { rules });

    // Délai porté de 3 à 10 jours : échéance décalée de 7 jours ; horizon de 21 jours pour « Préparer les prochaines séances ».
    const r = await save(USERS.marine, [{ rule: 'invite_pending', enabled: true, delayDays: 10 }, { rule: 'no_upcoming', enabled: true, delayDays: 21 }]);
    expect((r.body as { rules: { rule: string; delayDays: number }[] }).rules.find((x) => x.rule === 'invite_pending')!.delayDays).toBe(10);
    let all = await tasks();
    expect(all.find((t) => t.key === invite.key)!.dueOn).toBe(addDays(invite.dueOn!, 7));
    for (const t of all.filter((x) => x.rule === 'no_upcoming')) expect(t.reason).toContain('21 prochains jours');

    // Règle désactivée : plus aucun suivi de ce type ; réactivée : il revient.
    await save(USERS.marine, [{ rule: 'invite_pending', enabled: false, delayDays: 10 }]);
    expect((await tasks()).some((t) => t.rule === 'invite_pending')).toBe(false);
    await save(USERS.marine, [{ rule: 'invite_pending', enabled: true, delayDays: 3 }, { rule: 'no_upcoming', enabled: true, delayDays: 7 }]);
    all = await tasks();
    expect(all.find((t) => t.key === invite.key)!.dueOn).toBe(invite.dueOn);

    // Bornes : délai hors limites, délai sur une règle sans délai, règle en double.
    expect(await codeOf(save(USERS.marine, [{ rule: 'feedback_review', enabled: true, delayDays: 99 }]))).toBe('INVALID_FIELDS');
    expect(await codeOf(save(USERS.marine, [{ rule: 'vma_missing', enabled: true, delayDays: 2 }]))).toBe('INVALID_FIELDS');
    expect(await codeOf(save(USERS.marine, [{ rule: 'invite_pending', enabled: true, delayDays: 3 }, { rule: 'invite_pending', enabled: false, delayDays: 3 }]))).toBe('INVALID_FIELDS');
    // Droits : ni l’élève ni un coach d’un autre espace ; réglage invisible pour l’élève.
    expect(await codeOf(save(USERS.camille, [{ rule: 'invite_pending', enabled: false, delayDays: 3 }]))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(save(USERS.hugo, [{ rule: 'invite_pending', enabled: false, delayDays: 3 }]))).toBe('RESOURCE_NOT_VISIBLE');
    expect((await readAs(USERS.camille, (tx) => tx.query('select 1 from public.auto_rule_settings'))).rows).toHaveLength(0);
  });
});
