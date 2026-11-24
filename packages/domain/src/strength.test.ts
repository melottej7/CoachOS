import { describe, expect, it } from 'vitest';
import {
  applyFollowLog, asDone, exerciseKey, lastDoneByExercise, availableEquipment, exerciseFits, missingEquipment, modulesOf, sportsFor, BASE_VIDEOS, compareSet, entryVerdict, loadProgress, progressText, strengthLogSchema, strengthPlan, describeBlock, describeTotals, detectVideoType, shownVideo, starterKey, exerciseIdsOf, fitSteps, followSequence, parseNotation, setLabel, presetsFor, STARTER_EXERCISES, structureSchema,
  structureTotals, toNotation, videoEmbed, type Block,
} from './index';

// D-096 : musculation dans le modèle de séance, la notation, l’export montre et la bibliothèque d’exercices.

describe('séance de musculation', () => {
  it('lit « 4×(10 squat goblet 16kg + repos 1\'30) » : exercice, répétitions, charge, repos', () => {
    const r = parseNotation("8' RPE3 + 4×(10 squat goblet 16kg + repos 1'30) + 3×(12 fentes arrière + 30\" planche + repos 45\")", 'strength');
    expect(r.errors).toEqual([]);
    const [warm, sets, circuit] = r.blocks as [Block, Block, Block];
    expect(warm).toMatchObject({ phase: 'warmup', measure: { kind: 'time', seconds: 480 } });
    expect(sets).toMatchObject({ type: 'repeat', times: 4, steps: [
      { phase: 'work', measure: { kind: 'reps', reps: 10 }, intensity: { kind: 'load', min: 16 }, exercise: { id: null, name: 'Squat goblet' } },
      { phase: 'rest', measure: { kind: 'time', seconds: 90 } },
    ] });
    expect(describeBlock(sets, 'strength')).toBe('4 × (Squat goblet · 10 répétitions · 16 kg / repos 1 min 30 s)');
    expect(describeBlock(circuit, 'strength')).toBe('3 × (Fentes arrière · 12 répétitions / Planche · 30 s / repos 45 s)');
    // Aller-retour texte → blocs → texte.
    expect(parseNotation(toNotation(r.blocks, 'strength'), 'strength').blocks).toEqual(r.blocks);
    // Validé par le schéma (charge au demi-kilo, nom d’exercice).
    expect(structureSchema.safeParse(r.blocks).success).toBe(true);
    expect(structureSchema.safeParse([{ ...(warm as object), intensity: { kind: 'load', min: 16.3, max: null } }]).success).toBe(false);
  });

  it('durée estimée à 4 s par répétition, arrondie à la minute', () => {
    const r = parseNotation("4×(10 squats + repos 1')", 'strength');
    const t = structureTotals(r.blocks, { sport: 'strength' });
    expect(t.seconds).toBe(4 * (10 * 4 + 60));
    expect(t.estimated).toBe(true);
    expect(t.totalMeters).toBe(0);
    expect(describeTotals(t)).toBe('environ 7 min');
  });

  it('les mots ne deviennent un exercice qu’en musculation : l’endurance garde ses règles', () => {
    expect(parseNotation('10 squats', 'running').errors.length).toBeGreaterThan(0);
    expect(parseNotation('10 lignes droites', 'running', { lenient: true }).blocks.some((b) => b.type === 'step' && b.exercise)).toBe(false);
    // « 3 séances » n’est plus lu comme 3 secondes.
    const loose = parseNotation('3 séances', 'running', { lenient: true }).blocks;
    expect(loose.some((b) => b.type === 'step' && b.measure.kind === 'time' && b.measure.seconds === 3)).toBe(false);
  });

  it('export montre : répétitions comptées, nom de l’exercice, charge en note', () => {
    const r = parseNotation('10 squat goblet 16kg', 'strength');
    const [s] = fitSteps(r.blocks, 'strength');
    expect(s).toMatchObject({ name: 'Squat goblet', durationType: 29, durationValue: 10, notes: '16 kg' });
  });

  it('modèles rapides propres à la musculation, tous valides', () => {
    const p = presetsFor('strength');
    expect(p.map((x) => x.id)).toEqual(expect.arrayContaining(['str-sets', 'str-superset', 'str-circuit']));
    for (const x of p) expect(structureSchema.safeParse(x.blocks()).success).toBe(true);
    expect(presetsFor('running').some((x) => x.id.startsWith('str-'))).toBe(false);
  });

  it('exercices de la bibliothèque nommés par une séance', () => {
    const id = '0653b914-5a8c-4543-a2b6-29b3d0fee0fa';
    const blocks = parseNotation("3×(10 pompes + repos 1')", 'strength').blocks as Block[];
    const linked = blocks.map((b) => (b.type === 'repeat' ? { ...b, steps: b.steps.map((s) => (s.type === 'step' && s.exercise ? { ...s, exercise: { id, name: s.exercise.name } } : s)) } : b));
    expect(exerciseIdsOf(linked)).toEqual([id]);
  });
});

describe('bibliothèque d’exercices', () => {
  it('liens vidéo : YouTube et Vimeo intégrés, autres liens ouverts à part, http refusé', () => {
    expect(videoEmbed('https://youtu.be/dQw4w9WgXcQ')).toMatchObject({ kind: 'youtube', src: expect.stringContaining('youtube-nocookie.com/embed/dQw4w9WgXcQ') });
    expect(videoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3')).toMatchObject({ kind: 'youtube' });
    expect(videoEmbed('https://youtube.com/shorts/abcdefghijk')).toMatchObject({ kind: 'youtube' });
    expect(videoEmbed('https://vimeo.com/123456789')).toEqual({ kind: 'vimeo', src: 'https://player.vimeo.com/video/123456789' });
    expect(videoEmbed('https://drive.google.com/file/d/x/view')).toMatchObject({ kind: 'link' });
    expect(videoEmbed('http://youtu.be/dQw4w9WgXcQ')).toBeNull();
    expect(videoEmbed('javascript:alert(1)')).toBeNull();
  });

  it('vidéo reconnue par ses premiers octets', () => {
    const box = (brand: string) => Uint8Array.from([0, 0, 0, 20, ...new TextEncoder().encode('ftyp'), ...new TextEncoder().encode(brand), 0, 0, 0, 0]);
    expect(detectVideoType(box('isom'))).toBe('video/mp4');
    expect(detectVideoType(box('qt  '))).toBe('video/quicktime');
    expect(detectVideoType(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('video/webm');
    expect(detectVideoType(new TextEncoder().encode('<!doctype html><html>'))).toBeNull();
  });

  it('exercices de départ : noms uniques, consignes présentes', () => {
    const names = STARTER_EXERCISES.map(([n]) => n.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    expect(STARTER_EXERCISES.every(([, , , txt]) => txt.length > 20)).toBe(true);
  });
});

describe('suivre la séance pas à pas (M3)', () => {
  it('répétitions dépliées dans l’ordre, séries et tours nommés', () => {
    const blocks = parseNotation("8' RPE3 + 4×(10 squats + repos 1'30) + 3×(12 fentes + 30\" planche + repos 45\")", 'strength').blocks;
    const seq = followSequence(blocks);
    // D-167 · D-172 : le repos qui suit la dernière série d’une carte est omis (et donc celui qui finirait la séance).
    expect(seq).toHaveLength(1 + 4 * 2 - 1 + 3 * 3 - 1);
    expect(seq.at(-1)!.step.exercise?.name).toBe('Planche');
    expect(seq[1]!.step.exercise?.name).toBe('Squats');
    expect(setLabel(seq[1]!.sets)).toBe('Série 1 sur 4');
    expect(setLabel(seq[7]!.sets)).toBe('Série 4 sur 4');
    expect(setLabel(seq[9]!.sets)).toBe('Tour 1 sur 3');
    expect(setLabel(seq[0]!.sets)).toBeNull();
    expect(seq.map((f) => f.index)).toEqual(seq.map((_, k) => k));
  });

  it('séries imbriquées et plafond de 400 étapes', () => {
    const nested = parseNotation("2×(3×(5 pompes + repos 20\") + repos 2')", 'strength').blocks;
    expect(setLabel(followSequence(nested)[0]!.sets)).toBe('Tour 1 sur 2 · série 1 sur 3');
    const huge = parseNotation('50×(50×(1 pompe + repos 5"))', 'strength').blocks;
    expect(followSequence(huge)).toHaveLength(400);
  });
});

describe('vidéo montrée à l’élève (D-099)', () => {
  const catalog = { 'squat-goblet': { url: 'https://videos.coachos.test/squat-goblet.mp4', source: 'founder_ai' as const, validatedBy: 'fondateur', validatedOn: '2026-11-21' } };
  const ex = { videoUrl: null, clipId: null, starterKey: 'squat-goblet', useBaseVideo: true };
  it('celle du coach d’abord (fichier, puis lien), sinon la vidéo de base acceptée, sinon rien', () => {
    expect(shownVideo({ ...ex, clipId: 'c1', videoUrl: 'https://youtu.be/abcdefghijk' }, catalog)).toEqual({ from: 'coach_clip' });
    expect(shownVideo({ ...ex, videoUrl: 'https://youtu.be/abcdefghijk' }, catalog)).toEqual({ from: 'coach_link', url: 'https://youtu.be/abcdefghijk' });
    expect(shownVideo(ex, catalog)).toEqual({ from: 'base', url: catalog['squat-goblet'].url, source: 'founder_ai' });
    expect(shownVideo({ ...ex, useBaseVideo: false }, catalog)).toBeNull();
    expect(shownVideo({ ...ex, starterKey: null }, catalog)).toBeNull();
    expect(shownVideo({ ...ex, starterKey: 'pompes' }, catalog)).toBeNull();
  });
  it('clé stable, sans accent ; fichier vidéo direct lu dans la page ; catalogue validé', () => {
    expect(starterKey('Soulevé de terre jambes tendues')).toBe('souleve-de-terre-jambes-tendues');
    expect(starterKey('Mobilité des hanches 90/90')).toBe('mobilite-des-hanches-90-90');
    expect(new Set(STARTER_EXERCISES.map(([n]) => starterKey(n))).size).toBe(STARTER_EXERCISES.length);
    expect(videoEmbed('https://videos.coachos.test/a/squat.mp4')).toEqual({ kind: 'file', src: 'https://videos.coachos.test/a/squat.mp4' });
    // Toute vidéo de base nommée par le catalogue est validée et rattachée à un exercice de départ.
    const keys = new Set(STARTER_EXERCISES.map(([n]) => starterKey(n)));
    for (const [k, v] of Object.entries(BASE_VIDEOS)) {
      expect(keys.has(k)).toBe(true);
      expect(v.url.startsWith('https://') && v.validatedBy && /^\d{4}-\d{2}-\d{2}$/.test(v.validatedOn)).toBeTruthy();
    }
  });
});

describe('séries et charges réalisées (M4)', () => {
  const blocks = parseNotation("8' RPE3 + 4×(10 squat goblet 16kg + repos 1'30) + 3×(12 fentes + 30\" planche + repos 45\")", 'strength').blocks;
  it('le prévu, exercice par exercice, avec la place de chaque série dans « Suivre »', () => {
    const plan = strengthPlan(blocks);
    expect(plan.map((e) => [e.name, e.sets.length])).toEqual([['Squat goblet', 4], ['Fentes', 3], ['Planche', 3]]);
    expect(plan[0]!.sets[0]).toEqual({ followIndex: 1, reps: 10, kg: 16, seconds: null });
    expect(plan[2]!.sets[0]).toMatchObject({ reps: null, kg: null, seconds: 30 });
    expect(strengthPlan(parseNotation("15' Z2 + 6×(400m Z6 + R200m)", 'running').blocks)).toEqual([]);
  });
  it('ce qui a été noté pendant « Suivre » corrige le prévu ; le schéma valide', () => {
    const plan = strengthPlan(blocks);
    const log = applyFollowLog(plan, { 5: { reps: 8, kg: 16 }, 7: { reps: 6, kg: 14 } });
    expect(log[0]!.sets.map((x) => [x.reps, x.kg])).toEqual([[10, 16], [10, 16], [8, 16], [6, 14]]);
    expect(strengthLogSchema.safeParse(log).success).toBe(true);
    expect(strengthLogSchema.safeParse([{ name: 'Squat', sets: [{ reps: 10, kg: 16.3 }] }]).success).toBe(false);
    expect(strengthLogSchema.safeParse([{ name: 'Squat', sets: [] }]).success).toBe(false);
  });
  it('comparaison au prévu : moins, autant, plus ; séries non faites', () => {
    expect(compareSet({ reps: 10, kg: 16, seconds: null }, { reps: 8, kg: 16, seconds: null })).toBe('less');
    expect(compareSet({ reps: 10, kg: 16, seconds: null }, { reps: 10, kg: 18, seconds: null })).toBe('more');
    expect(compareSet({ reps: 10, kg: 16, seconds: null }, { reps: 10, kg: 16, seconds: null })).toBe('same');
    const plan = strengthPlan(blocks)[0]!;
    expect(entryVerdict(plan, { exerciseId: null, name: 'Squat goblet', sets: [{ reps: 10, kg: 16, seconds: null }, { reps: 8, kg: 16, seconds: null }, { reps: 0, kg: 16, seconds: null }] }))
      .toEqual({ less: 1, more: 0, missing: 2 });
    expect(entryVerdict(plan, asDone([plan])[0]!)).toEqual({ less: 0, more: 0, missing: 0 });
  });
  it('progression : meilleure série par séance, évolution lisible, sans charge en répétitions', () => {
    const series = loadProgress([
      { date: '2026-11-25', log: [{ exerciseId: null, name: 'Squat goblet', sets: [{ reps: 10, kg: 18, seconds: null }, { reps: 8, kg: 20, seconds: null }] }, { exerciseId: null, name: 'Pompes', sets: [{ reps: 12, kg: null, seconds: null }] }] },
      { date: '2026-11-18', log: [{ exerciseId: null, name: 'Squat goblet', sets: [{ reps: 10, kg: 16, seconds: null }, { reps: 0, kg: 16, seconds: null }] }, { exerciseId: null, name: 'Pompes', sets: [{ reps: 8, kg: null, seconds: null }] }] },
    ]);
    const goblet = series.find((x) => x.name === 'Squat goblet')!;
    expect(goblet.points.map((p) => [p.date, p.topKg, p.topReps, p.sets, p.volumeKg])).toEqual([['2026-11-18', 16, 10, 1, 160], ['2026-11-25', 20, 8, 2, 340]]);
    expect(progressText(goblet)).toBe('16 kg → 20 kg (+4 kg)');
    expect(progressText(series.find((x) => x.name === 'Pompes')!)).toBe('8 → 12 répétitions');
  });
});

describe('modules de l’espace et séances mixtes (M5)', () => {
  it('endurance, musculation ou les deux, d’après les sports encadrés ; rien de coché = les deux', () => {
    expect(modulesOf([])).toEqual({ endurance: true, strength: true });
    expect(modulesOf(null)).toEqual({ endurance: true, strength: true });
    expect(modulesOf(['strength'])).toEqual({ endurance: false, strength: true });
    expect(modulesOf(['running', 'trail'])).toEqual({ endurance: true, strength: false });
    expect(modulesOf(['running', 'strength'])).toEqual({ endurance: true, strength: true });
    expect(sportsFor({ endurance: false, strength: true })).toEqual(['strength']);
    expect(sportsFor({ endurance: true, strength: false })).not.toContain('strength');
    // La valeur d’une séance existante reste proposée.
    expect(sportsFor({ endurance: false, strength: true }, 'running')).toEqual(['strength', 'running']);
  });
  it('« renfo » marque une étape de musculation dans une séance de course ; aller-retour texte', () => {
    const r = parseNotation("45' Z2 + 3×(renfo 10 squats + renfo repos 1')", 'running');
    expect(r.errors).toEqual([]);
    const rep = r.blocks[1]!;
    expect(rep).toMatchObject({ type: 'repeat', times: 3, steps: [
      { sport: 'strength', measure: { kind: 'reps', reps: 10 }, exercise: { name: 'Squats' } },
      { sport: 'strength', phase: 'rest', measure: { kind: 'time', seconds: 60 } },
    ] });
    expect(parseNotation(toNotation(r.blocks, 'running'), 'running').blocks).toEqual(r.blocks);
    expect(describeBlock(r.blocks[0]!, 'running')).toBe('Effort · 45 min · Z2 (endurance fondamentale)');
    // Le retour demande les séries de l’exercice ; « Suivre » est proposé.
    expect(strengthPlan(r.blocks).map((e) => [e.name, e.sets.length])).toEqual([['Squats', 3]]);
    // Sans « renfo », la course garde ses règles.
    expect(parseNotation('3×(10 squats)', 'running').errors.length).toBeGreaterThan(0);
  });
});

describe('exercice et matériel de l’élève (D-111)', () => {
  it('salle = tout ; maison = son matériel + poids du corps ; extérieur = barre de traction ; tapis jamais bloquant', () => {
    expect(availableEquipment({ places: ['gym'], equipment: [] })).toBe('all');
    const home = { places: ['home' as const], equipment: ['bands', 'gps_watch'] };
    expect(exerciseFits(['dumbbells', 'kettlebell'], home)).toBe(false);
    expect(exerciseFits(['dumbbells', 'bands'], home)).toBe(true);
    expect(exerciseFits(['mat', 'bodyweight'], home)).toBe(true);
    expect(exerciseFits(['mat'], home)).toBe(true);
    expect(exerciseFits(['pullup_bar'], home)).toBe(false);
    expect(exerciseFits(['pullup_bar'], { places: ['outdoor'], equipment: [] })).toBe(true);
    expect(exerciseFits(['machine'], { places: ['gym', 'home'], equipment: [] })).toBe(true);
    // Lieu inconnu : on ne juge pas.
    expect(exerciseFits(['dumbbells'], { places: [], equipment: [] })).toBeNull();
    expect(exerciseFits(['dumbbells'], null)).toBeNull();
    expect(missingEquipment(['dumbbells', 'kettlebell', 'mat'])).toBe('haltères ou kettlebell');
  });
});

describe('la dernière fois (D-112)', () => {
  it('meilleure série de la séance la plus récente, par identifiant ou par nom', () => {
    const last = lastDoneByExercise(loadProgress([
      { date: '2026-11-14', log: [{ exerciseId: 'e1', name: 'Squat goblet', sets: [{ reps: 10, kg: 14, seconds: null }] }] },
      { date: '2026-11-21', log: [{ exerciseId: 'e1', name: 'Squat goblet', sets: [{ reps: 10, kg: 16, seconds: null }, { reps: 8, kg: 18, seconds: null }] }, { exerciseId: null, name: 'Pompes', sets: [{ reps: 12, kg: null, seconds: null }] }] },
    ]));
    expect(last[exerciseKey('e1', 'Squat goblet')]).toMatchObject({ text: '8 × 18 kg', date: '2026-11-21' });
    expect(last[exerciseKey(null, ' pompes ')]?.text).toBe('12 rép');
    expect(last[exerciseKey(null, 'Fentes')]).toBeUndefined();
  });
});

