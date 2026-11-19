import { describe, expect, it } from 'vitest';
import { generateProgram, planRegeneration, programInstructions, regenWeekCount, regenerateProgramSchema, weekIndexOf, type PlannedSession, type ProgramInput } from './index';

// D-063 : régénération partielle ; séances passées, réalisées ou retouchées protégées ; différences par semaine.

const base: ProgramInput = {
  feasibility: {
    sport: 'running', distanceKm: 21.1, eventDate: '2027-03-14', targetSeconds: 7200, level: 'intermediate', practiceStatus: 'regular',
    longestRecent: '45to60', weeklySessions: '2to3', weeklyHours: '4to6', today: '2026-11-19',
  } as ProgramInput['feasibility'],
  startMonday: '2026-11-23', days: [2, 4, 6, 7], currentWeeklyMin: 120, refs: { vmaKmh: 15 }, goalTitle: 'Semi',
};
const first = generateProgram(base);
let n = 0;
const stored = (over: Partial<PlannedSession> = {}) => first.weeks.flatMap((w) => w.sessions.map((s): PlannedSession => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, revision: 1, date: s.date, title: s.title, blocks: s.blocks,
  canceled: false, done: false, edited: false, published: false, ...over,
})));

describe('régénération partielle (D-063)', () => {
  it('mêmes paramètres : rien ne change', () => {
    const old = stored();
    const r = planRegeneration({ old, program: first, startMonday: base.startMonday, fromWeek: 1, toWeek: first.weeks.length, today: '2026-11-19' });
    expect(r.counts).toMatchObject({ changed: 0, added: 0, removed: 0, kept: 0 });
    expect(r.counts.same).toBe(old.length);
  });

  it('jours changés à partir de la semaine 6 : seules ces semaines bougent ; passé, réalisé et retouché protégés', () => {
    const old = stored();
    const next = generateProgram({ ...base, days: [1, 3, 6] });
    const today = '2027-01-01'; // semaine 6
    const w6 = old.filter((s) => weekIndexOf(base.startMonday, s.date) === 6);
    // Dans la semaine 6 : une séance passée (mardi 29 déc.), une réalisée en avance, une retouchée par le coach.
    const done = w6.find((s) => s.date >= today)!; done.done = true;
    const edited = old.filter((s) => weekIndexOf(base.startMonday, s.date) === 7)[0]!; edited.edited = true;
    const r = planRegeneration({ old, program: next, startMonday: base.startMonday, fromWeek: 6, toWeek: regenWeekCount(old, next, base.startMonday), today });
    expect(r.weeks[0]!.index).toBe(6);
    const items = r.weeks.flatMap((w) => w.items);
    // Rien avant la semaine 6.
    expect(items.every((it) => weekIndexOf(base.startMonday, it.date) >= 6)).toBe(true);
    // Rien dans le passé n’est ajouté, retiré ou modifié.
    expect(items.filter((it) => it.date < today).every((it) => it.kind === 'kept' && it.reason === 'past')).toBe(true);
    expect(items.find((it) => it.kind === 'kept' && it.before.id === done.id)).toMatchObject({ reason: 'done' });
    expect(items.find((it) => it.kind === 'kept' && it.before.id === edited.id)).toMatchObject({ reason: 'edited' });
    // Nouveaux jours : lundi, mercredi, samedi ; les anciens mardi/jeudi non protégés disparaissent.
    const dow = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7 + 1;
    expect(items.filter((it) => it.kind === 'added').every((it) => [1, 3, 6].includes(dow(it.date)))).toBe(true);
    expect(items.filter((it) => it.kind === 'removed').every((it) => [2, 4, 7].includes(dow(it.date)))).toBe(true);
    expect(r.counts.added).toBeGreaterThan(0);
    expect(r.counts.removed).toBeGreaterThan(0);
  });

  it('une seule semaine ; séance annulée ignorée ; consignes avec raison', () => {
    const old = stored();
    old.find((s) => weekIndexOf(base.startMonday, s.date) === 3)!.canceled = true;
    const r = planRegeneration({ old, program: first, startMonday: base.startMonday, fromWeek: 3, toWeek: 3, today: '2026-11-19' });
    expect(r.weeks).toHaveLength(1);
    expect(r.counts.added).toBe(1); // le jour annulé reçoit à nouveau sa séance
    expect(programInstructions(first.weeks[0]!, first.weeks[0]!.sessions[0]!)).toMatch(/^Semaine 1 · Tremplin \(semaine 1\)\n\nPourquoi cette séance \? /);
    expect(regenerateProgramSchema.safeParse({ fromWeek: 4, toWeek: 2, days: [2, 4], seen: [] }).success).toBe(false);
  });
});
