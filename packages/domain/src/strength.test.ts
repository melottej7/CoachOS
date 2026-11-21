import { describe, expect, it } from 'vitest';
import {
  describeBlock, describeTotals, detectVideoType, exerciseIdsOf, fitSteps, parseNotation, presetsFor, STARTER_EXERCISES, structureSchema,
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
