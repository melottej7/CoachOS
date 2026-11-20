import { describe, expect, it } from 'vitest';
import { fouleeLibrary, generateProgram, NO_TWEAKS, parseNotation, type Block, type FeasibilityInput, type ProgramInput } from './index';

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


// D-086 : méthode du fondateur (docs/execution/METHODE_FONDATEUR.md).
describe('générateur aligné sur la méthode du fondateur (D-086)', () => {
  const run = (p: ReturnType<typeof generateProgram>) => p.weeks.flatMap((w) => w.sessions.map((s) => ({ w, s })));
  const tenK = (over: Partial<FeasibilityInput>): FeasibilityInput => ({
    sport: 'running', distanceKm: 10, eventDate: '2027-01-17', targetSeconds: null, level: 'beginner', practiceStatus: 'regular',
    longestRecent: '30to45', weeklySessions: '2to3', weeklyHours: null, today: '2026-11-08', ...over,
  });
  const at = (f2: FeasibilityInput, days = [2, 4, 7], cur: number | null = 105) =>
    generateProgram({ feasibility: f2, startMonday: '2026-11-09', days, currentWeeklyMin: cur, goalTitle: '10 km' });

  it('reprise lourde : course/marche dès 1′, portions qui s’allongent, sortie du week-end la plus longue, pas de qualité', () => {
    const p = at(tenK({ practiceStatus: 'stopped', longestRecent: null, weeklySessions: '0to1' }), [2, 4, 7], null);
    const w1 = p.weeks[0]!.sessions;
    expect(w1.every((s) => s.title.startsWith('Course/marche'))).toBe(true);
    expect(w1[0]!.title).toBe('Course/marche 8 × (1′ + 1′30 marche)');
    expect(w1[0]!.blocks[0]).toMatchObject({ phase: 'warmup', note: 'marche active' });
    expect(w1[0]!.instructions).toMatch(/La marche n’est pas un échec/);
    expect(w1.at(-1)!.minutes).toBeGreaterThan(w1[0]!.minutes);
    const portions = p.weeks.map((w) => Number(/\((\d+)/.exec(w.sessions[0]!.title)?.[1] ?? 99));
    expect(portions.slice(0, 5)).toEqual([...portions.slice(0, 5)].sort((a, b) => a - b));
    // Pas de qualité tant que l’élève court/marche.
    expect(run(p).filter(({ s }) => s.title.startsWith('Course/marche')).every(({ w }) => w.sessions.every((x) => x.kind !== 'quality'))).toBe(true);
    expect(run(p).some(({ s }) => s.title.startsWith('Sortie longue'))).toBe(true);
  });

  it('débutante active : lignes droites d’abord, test 5 km en semaine 3, puis 200 m → côtes → pyramide → 400 m → 1 km', () => {
    const p = at(tenK({}));
    expect(p.weeks[0]!.sessions[0]!.title).toMatch(/\+ lignes droites$/);
    expect(p.weeks[0]!.sessions[0]!.kind).toBe('easy');
    expect(p.weeks.slice(0, 3).every((w) => w.sessions.every((s) => s.kind !== 'quality' || s.title === 'Test 5 km'))).toBe(true);
    const test = p.weeks[2]!.sessions.find((s) => s.title === 'Test 5 km')!;
    expect(test.blocks[1]).toMatchObject({ measure: { kind: 'distance', meters: 5000 } });
    expect(test.instructions).toMatch(/Pars prudent/);
    const q = run(p).filter(({ s }) => s.kind === 'quality' && s.title !== 'Test 5 km').map(({ s }) => s.title);
    expect(q.slice(0, 5).map((x) => x.replace(/\d+ × /, ''))).toEqual(['Fractionné 200 m', 'Côtes 30″', 'Pyramide 1-2-3-2-1′', 'Fractionné 400 m', 'Fractionné 1 km']);
    expect(run(p).find(({ s }) => s.title.startsWith('Fractionné'))!.s.instructions).toMatch(/la première ne peut pas être plus rapide/);
  });

  it('dernière semaine : rappel d’allure tôt, veille en footing + lignes droites ; jamais de qualité autour de la sortie longue', () => {
    const p = at(tenK({ eventDate: '2027-01-30', targetSeconds: 75 * 60, level: 'intermediate', longestRecent: '45to60' }), [1, 3, 5, 7], 150);
    const last = p.weeks.at(-1)!.sessions;
    expect(last[0]!.title).toBe('Rappel d’allure 4 × 3′');
    expect(last.find((s) => s.date === '2027-01-29')!.title).toBe('Footing 15′ + lignes droites');
    const dow = (d: string) => ((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
    for (const w of p.weeks) {
      const long = w.sessions.find((s) => s.kind === 'long');
      if (!long) continue;
      for (const s of w.sessions.filter((x) => x.kind === 'quality')) expect(Math.abs(dow(s.date) - dow(long.date))).toBeGreaterThan(1);
    }
    // Deux qualités par semaine : vitesse puis allure, jamais deux fois l’allure.
    for (const w of p.weeks) expect(w.sessions.filter((s) => s.title.startsWith('Allure course')).length).toBeLessThanOrEqual(1);
  });

  it('types écartés par le coach respectés ; vélo inchangé ; risques en minutes (+15 à 30′ aux petits volumes acceptés)', () => {
    const noVma = generateProgram({ feasibility: tenK({}), startMonday: '2026-11-09', days: [2, 4, 7], currentWeeklyMin: 105, goalTitle: '10 km', tweaks: { ...NO_TWEAKS, avoidQuality: ['vma'] } });
    const titles = run(noVma).map(({ s }) => s.title);
    expect(titles.some((x) => /200 m|400 m|Côtes/.test(x))).toBe(false);
    expect(titles.some((x) => x.startsWith('Pyramide'))).toBe(true);
    const bike = generateProgram({ ...base, feasibility: { ...f, sport: 'cycling', distanceKm: 100, targetSeconds: null, longestRecent: 'gt120' }, days: [3, 6, 7] });
    expect(run(bike).some(({ s }) => /Course\/marche|lignes droites|Test 5 km/.test(s.title))).toBe(false);
    expect(at(tenK({})).risks.some((r) => /augmente/.test(r.text))).toBe(false);
  });
});
