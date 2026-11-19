import { describe, expect, it } from 'vitest';
import { fouleeLibrary, generateProgram, parseNotation, type Block, type FeasibilityInput, type ProgramInput } from './index';

// D-061 : règle du fondateur — à la hauteur de l’objectif, 4 semaines de tremplin, risques signalés au coach.

const f: FeasibilityInput = {
  sport: 'running', distanceKm: 21.1, eventDate: '2027-03-14', targetSeconds: 2 * 3600, level: 'intermediate', practiceStatus: 'regular',
  longestRecent: '45to60', weeklySessions: '2to3', weeklyHours: '4to6', today: '2026-11-19',
  history: { experience: '1to3', breakLength: null, resumedSince: null, recentLongestDoneMin: 45, regularity: { due: 3, done: 2 }, achievedKm: 10, performances: [] },
};
const base: ProgramInput = { feasibility: f, startMonday: '2026-11-23', days: [2, 4, 6, 7], currentWeeklyMin: 120, refs: { vmaKmh: 15 }, goalTitle: 'Semi de Bruxelles' };

describe('générateur de programme', () => {
  it('phases : 4 semaines de tremplin, développement avec une semaine allégée sur quatre, affûtage', () => {
    const p = generateProgram(base);
    expect(p.weeks).toHaveLength(16);
    expect(p.weeks.slice(0, 4).every((w) => w.phase === 'tremplin')).toBe(true);
    expect(p.weeks.slice(-2).every((w) => w.phase === 'affutage')).toBe(true);
    expect(p.weeks.filter((w) => w.phase === 'recuperation').length).toBeGreaterThanOrEqual(2);
    // Tremplin : part du volume actuel et monte progressivement.
    expect(p.weeks[0]!.minutes).toBeLessThan(p.weeks[3]!.minutes);
    expect(Math.abs(p.weeks[0]!.minutes - 120)).toBeLessThan(30);
    expect(p.weeks.slice(0, 2).flatMap((w) => w.sessions).some((s) => s.kind === 'quality')).toBe(false);
  });

  it('à la hauteur de l’objectif : la séance longue nécessaire est atteinte avant l’affûtage, course le jour J', () => {
    const p = generateProgram(base);
    const lastDev = [...p.weeks].reverse().find((w) => w.phase === 'developpement')!;
    expect(lastDev.longMinutes).toBe(p.longNeed);
    expect(Math.max(...p.weeks.map((w) => w.longMinutes))).toBe(p.longNeed);
    const race = p.weeks.at(-1)!.sessions.find((s) => s.kind === 'race')!;
    expect(race).toMatchObject({ date: '2027-03-14', title: 'Semi de Bruxelles' });
    expect(p.weeks.at(-1)!.sessions.every((s) => s.date <= '2027-03-14')).toBe(true);
    // Chrono visé : séances à l’allure de course.
    expect(p.weeks.flatMap((w) => w.sessions).some((s) => s.title.startsWith('Allure course'))).toBe(true);
  });

  it('séances aux jours choisis, séance longue le week-end, dates dans leur semaine', () => {
    const p = generateProgram(base);
    for (const w of p.weeks) for (const s of w.sessions) {
      const dow = ((new Date(`${s.date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
      if (s.kind !== 'race') expect([2, 4, 6, 7]).toContain(dow);
      expect(s.date >= w.monday && s.date <= `${w.monday.slice(0, 8)}${w.monday.slice(8)}` || s.date >= w.monday).toBe(true);
      if (s.kind === 'long') expect(dow).toBe(7);
    }
  });

  it('préparation courte : programme toujours à la hauteur, risques signalés au coach', () => {
    const p = generateProgram({ ...base, feasibility: { ...f, eventDate: '2027-01-17' } });
    expect(p.weeks).toHaveLength(8);
    expect(Math.max(...p.weeks.map((w) => w.longMinutes))).toBe(p.longNeed);
    expect(p.risks.some((r) => r.level !== 'watch')).toBe(true);
    expect(p.risks.map((r) => r.text).join(' ')).toMatch(/Délai/);
    // Avec deux séances par semaine, la progression devient aussi un risque signalé.
    const two = generateProgram({ ...base, feasibility: { ...f, eventDate: '2027-01-17' }, days: [3, 7], currentWeeklyMin: 60 });
    expect(Math.max(...two.weeks.map((w) => w.longMinutes))).toBe(two.longNeed);
    expect(two.risks.map((r) => r.text).join(' ')).toMatch(/par semaine/);
  });

  it('autres sports : vélo en séances de temps', () => {
    const p = generateProgram({ ...base, feasibility: { ...f, sport: 'cycling', distanceKm: 100, targetSeconds: null, longestRecent: 'gt120' }, days: [3, 6, 7] });
    const titles = p.weeks.flatMap((w) => w.sessions.map((s) => s.title));
    expect(titles.some((x) => x.startsWith('Sortie vélo facile'))).toBe(true);
    expect(titles.some((x) => x.startsWith('Sortie longue'))).toBe(true);
  });

  it('bibliothèque du coach (D-062) : ses séances d’abord quand elles conviennent, en alternance ; sinon le générateur', () => {
    const lib = (id: string, title: string, category: string, n: string, sport: 'running' | 'cycling' = 'running') =>
      ({ id, title, category, sport, blocks: parseNotation(n, sport).blocks as Block[], instructions: `Consignes ${title}` });
    const library = [
      lib('s1', 'Seuil 3 × 10′', 'threshold', "10' Z1 + 3×(8' Z4 + R2') + 5' Z1"), // 45 min
      lib('s2', 'Seuil 4 × 6′', 'threshold', "10' Z1 + 4×(5' Z4 + R2') + 5' Z1"), // 43 min
      lib('v1', 'VMA vélo', 'intervals', "15' Z1 + 6×(3' Z6 + R3') + 10' Z1", 'cycling'), // autre sport : ignorée
      lib('l1', 'Sortie longue vallonnée', 'long', "80' Z2"),
    ];
    const p = generateProgram({ ...base, library });
    const all = p.weeks.flatMap((w) => w.sessions);
    const fromLib = all.filter((x) => x.source === 'library');
    expect(fromLib.some((x) => x.libraryId === 's1')).toBe(true);
    expect(fromLib.some((x) => x.libraryId === 's2')).toBe(true); // alternance
    expect(fromLib.some((x) => x.libraryId === 'v1')).toBe(false);
    expect(fromLib.find((x) => x.libraryId === 's1')!).toMatchObject({ title: 'Seuil 3 × 10′', instructions: 'Consignes Seuil 3 × 10′' });
    expect(fromLib.find((x) => x.libraryId === 's1')!.why).toMatch(/Choisie dans ta bibliothèque/);
    // La sortie longue de bibliothèque n’est prise que si sa durée est proche (±15 %) : 80 min, au pic.
    expect(all.filter((x) => x.libraryId === 'l1').every((x) => x.kind === 'long')).toBe(true);
    // Toute séance a sa raison.
    expect(all.every((x) => x.why.length > 10)).toBe(true);
    expect(all.find((x) => x.kind === 'easy')!.why).toMatch(/^Tremplin : endurance facile/);
  });

  it('bilan (D-066) : séance longue le jour préféré ; séances trop longues en semaine signalées au coach', () => {
    const dow = (d: string) => ((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
    const p = generateProgram({ ...base, preferredLongDay: 6 });
    expect(p.weeks.slice(0, -1).flatMap((w) => w.sessions.filter((x) => x.kind === 'long')).every((x) => dow(x.date) === 6)).toBe(true);
    // Jour préféré hors des jours choisis : ignoré (dimanche reste le jour de la séance longue).
    expect(generateProgram({ ...base, preferredLongDay: 3 }).weeks[0]!.sessions.find((x) => x.kind === 'long')!.date).toBe('2026-11-29');
    const capped = generateProgram({ ...base, weekdayCapMin: 30 });
    const risk = capped.risks.find((r) => r.text.startsWith('Temps en semaine'));
    expect(risk).toMatchObject({ level: 'watch' });
    expect(risk!.text).toMatch(/30′ au plus/);
    expect(generateProgram({ ...base, weekdayCapMin: null }).risks.some((r) => r.text.startsWith('Temps en semaine'))).toBe(false);
    expect(generateProgram({ ...base, weekdayCapMin: 600 }).risks.some((r) => r.text.startsWith('Temps en semaine'))).toBe(false);
  });

  it('bibliothèque Foulée (D-068) : niveaux et phases respectés ; séances adaptées choisies', () => {
    const library = fouleeLibrary().map((x, i) => ({ id: `f${i}`, title: x.workout.title, category: x.category, sport: 'running' as const, blocks: x.workout.intervals as Block[], instructions: x.workout.instructions, levels: x.meta.levels, phases: x.meta.phases }));
    const byId = new Map(library.map((x) => [x.id, x]));
    const p = generateProgram({ ...base, library });
    const picked = p.weeks.flatMap((w) => w.sessions.filter((x) => x.libraryId).map((x) => ({ w, x: byId.get(x.libraryId!)! })));
    expect(picked.length).toBeGreaterThan(5);
    expect(picked.every(({ x }) => x.levels.includes('I'))).toBe(true); // niveau intermédiaire : jamais une séance réservée aux débutants
    expect(picked.filter(({ w }) => w.phase === 'tremplin').every(({ x }) => x.phases.some((ph) => ph === 'reprise' || ph === 'base'))).toBe(true);
  });
});

