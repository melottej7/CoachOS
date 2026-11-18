import { describe, expect, it } from 'vitest';
import {
  bucketOf, canTransition, createAppointmentSchema, createTaskSchema, createTeamSchema, localToUtc, parseWith, rankTasks,
  updateTeamSchema, urgencyLabel, urgencyScore, utcToLocal,
} from './index';

describe('tâches du coach (CE-H-01, CE-H-02)', () => {
  const today = '2026-11-18';

  it('range chaque tâche dans son échéance', () => {
    expect(bucketOf('2026-11-17', today)).toBe('overdue');
    expect(bucketOf(today, today)).toBe('today');
    expect(bucketOf('2026-11-24', today)).toBe('week');
    expect(bucketOf('2026-11-25', today)).toBe('later');
    expect(bucketOf(null, today)).toBe('none');
  });

  it('classe : en retard, puis priorité, puis date, puis titre', () => {
    const tasks = [
      { title: 'B', dueOn: null, priority: 3 },
      { title: 'C', dueOn: '2026-11-20', priority: 1 },
      { title: 'A', dueOn: '2026-11-20', priority: 2 },
      { title: 'D', dueOn: '2026-11-10', priority: 0 },
      { title: 'E', dueOn: today, priority: 1 },
    ];
    expect(rankTasks(tasks, today).map((t) => t.title)).toEqual(['D', 'E', 'A', 'C', 'B']);
  });

  it('vérifie les transitions d’état', () => {
    expect(canTransition('todo', 'done')).toBe(true);
    expect(canTransition('done', 'todo')).toBe(true);
    expect(canTransition('done', 'in_progress')).toBe(false);
    expect(canTransition('canceled', 'waiting')).toBe(false);
  });

  it('refuse un lien externe et un titre vide', () => {
    const base = { title: 'Appeler Emma', kind: 'call' };
    expect(parseWith(createTaskSchema, { ...base, link: '/coach/10000000-0000-4000-8000-00000000000a/athletes' }).ok).toBe(true);
    expect(parseWith(createTaskSchema, { ...base, link: 'https://exemple.test' }).ok).toBe(false);
    expect(parseWith(createTaskSchema, { ...base, title: '   ' }).ok).toBe(false);
  });

  it('calcule l’urgence d’un élève', () => {
    expect(urgencyScore([], today)).toBe(0);
    expect(urgencyLabel(0)).toBe('À jour');
    // Un retour à examiner du jour et un profil à relancer : à suivre, pas urgent.
    expect(urgencyLabel(urgencyScore([{ priority: 2, dueOn: today }, { priority: 1, dueOn: null }], today))).toBe('À suivre');
    const s = urgencyScore([{ priority: 2, dueOn: '2026-11-15' }, { priority: 2, dueOn: null }], today);
    expect(s).toBe(8);
    expect(urgencyLabel(s)).toBe('Urgent');
  });
});

describe('groupes et rendez-vous', () => {
  it('nomme et modifie un groupe', () => {
    expect(parseWith(createTeamSchema, { name: '  Préparation marathon ' })).toEqual({ ok: true, value: { name: 'Préparation marathon' } });
    expect(parseWith(updateTeamSchema, {}).ok).toBe(false);
    expect(parseWith(updateTeamSchema, { archived: true }).ok).toBe(true);
  });

  it('convertit l’heure locale du rendez-vous, heure d’hiver et d’été', () => {
    expect(localToUtc('2026-11-20T18:30', 'Europe/Brussels').toISOString()).toBe('2026-11-20T17:30:00.000Z');
    expect(localToUtc('2026-07-01T09:00', 'Europe/Brussels').toISOString()).toBe('2026-07-01T07:00:00.000Z');
    expect(localToUtc('2026-11-20T08:00', 'America/Montreal').toISOString()).toBe('2026-11-20T13:00:00.000Z');
    expect(utcToLocal(new Date('2026-11-20T17:30:00Z'), 'Europe/Brussels')).toEqual({ date: '2026-11-20', time: '18:30' });
  });

  it('refuse un lien de visio non https', () => {
    const base = { athleteId: '20000000-0000-4000-8000-000000000001', title: 'Bilan', kind: 'video', startsLocal: '2026-11-20T18:30', timeZone: 'Europe/Brussels', durationMin: 30 };
    expect(parseWith(createAppointmentSchema, { ...base, videoUrl: 'https://meet.exemple.test/abc' }).ok).toBe(true);
    expect(parseWith(createAppointmentSchema, { ...base, videoUrl: 'http://meet.exemple.test/abc' }).ok).toBe(false);
  });
});
