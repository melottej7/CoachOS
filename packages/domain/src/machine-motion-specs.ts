import type { MotionSpec, Path, Pt, Shape } from './machine-motion';

/**
 * D-179 · Animations dessinées de toute la bibliothèque des machines (hors les trois pilotes, dans machine-motion.ts).
 * Chaque exercice : bassin, buste, trajet des pieds et des mains, au départ et à l’arrivée ; la machine en schéma.
 * Toutes commencent « À relire » : le fondateur les valide une à une (MOTION_REVIEWS).
 */

// ---------- Pièces de machine communes ----------

const still = (p: Pt): Path => ({ from: p, to: p });
const line = (from: Pt, to: Pt): Path => ({ from, to });
/** Arc de a vers b autour d’un pivot placé sur leur médiatrice, à `bulge` du milieu (un bras de machine qui pivote). */
function arc(a: Pt, b: Pt, bulge: number): Path {
  const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const n: Pt = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L];
  return { from: a, to: b, pivot: [m[0] + n[0] * bulge, m[1] + n[1] * bulge] };
}
const pivotOf = (p: Path): Pt => p.pivot ?? p.from;

const seat = (hx: number, y = 134, w = 42): Shape[] => [
  { k: 'line', a: [hx - w / 2, y], b: [hx + w / 2, y], w: 8, tone: 'pad' },
  { k: 'line', a: [hx - 2, y + 4], b: [hx - 2, 166], w: 6 },
];
const back = (a: Pt, b: Pt): Shape => ({ k: 'line', a, b, w: 8, tone: 'pad' });
const frame = (a: Pt, b: Pt, w = 6): Shape => ({ k: 'line', a, b, w });
const stack = (x = 196): Shape => ({ k: 'rect', at: [x, 46], size: [22, 112], tone: 'stack' });
const grip: Shape = { k: 'line', a: [0, -7], b: [0, 7], w: 7, on: 'hand', tone: 'move' };
const barEnd: Shape = { k: 'circle', at: [0, 0], r: 5, on: 'hand', tone: 'move' };
const lever = (p: Path): Shape => ({ k: 'cable', from: pivotOf(p), to: 'hand', w: 5, tone: 'frame' });
const cableTo = (from: Pt, to: 'hand' | 'ankle' = 'hand', both = false): Shape => ({ k: 'cable', from, to, ...(both ? { both } : {}) });
const roller = (on: 'ankle' | 'knee' | 'elbow' | 'shoulder', at: Pt = [0, 0], r = 5): Shape => ({ k: 'circle', at, r, on, tone: 'pad' });
/** Colonne de poulie (vue de profil), poulie à la hauteur y. */
const column = (x: number, y: number): Shape[] => [frame([x, -40], [x, 166], 7), { k: 'circle', at: [x - 4, y], r: 4 }];
/** Rail vertical de la Smith machine, derrière la barre. */
const smithRail = (x: number): Shape => frame([x, -42], [x, 166], 3);
const floorFeet = (x: number) => ({ path: still([x, 160]), foot: 4 });

const S = (spec: MotionSpec): MotionSpec => spec;

// ---------- Presse, leg extension, leg curl ----------

const PRESS_FRAME: Shape[] = [
  frame([36, 166], [212, 166]), frame([80, 134], [80, 166]),
  { k: 'line', a: [62, 132], b: [100, 132], w: 8, tone: 'pad' }, back([70, 134], [37, 97]), stack(196),
  { k: 'line', a: [-5, 0], b: [5, 0], w: 5, on: 'hand', tone: 'pad' },
];
const pressBase = { hip: [78, 124] as Pt, torso: [-42, -42] as const, hands: { path: still([76, 128]) }, bend: { knee: -1, elbow: 1 } as const };

const legExtension = (key: string, single = false): MotionSpec => ({
  key, hip: [96, 120], torso: [-10, -10], ...(single ? { single: 'leg' as const } : {}),
  feet: { path: { from: [136, 161], to: [180, 114], pivot: [140, 120] }, foot: [-60, 10] },
  hands: { path: still([100, 122]) }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
  machine: [...seat(106, 128, 62), back([80, 126], [74, 70]), stack(196), frame([140, 120], [196, 100], 4),
    { k: 'cable', from: [140, 120], to: 'ankle', w: 4, tone: 'frame' }, roller('ankle', [3, -5])],
});

// ---------- Les exercices ----------

export const MORE_MOTIONS: MotionSpec[] = [
  // Presse à cuisses
  S({ ...pressBase, key: 'presse-pieds-hauts', feet: { path: line([158, 96], [137, 96]), foot: 86 }, effort: 'toA',
    machine: [...PRESS_FRAME, { k: 'line', a: [4, -16], b: [4, 22], w: 7, on: 'ankle', tone: 'move' }, { k: 'line', a: [7, 4], b: [44, 4], w: 3, on: 'ankle', tone: 'move' }] }),
  S({ ...pressBase, key: 'presse-une-jambe', single: 'leg', feet: { path: line([160, 106], [141, 106]), foot: 86 }, effort: 'toA',
    machine: [...PRESS_FRAME, { k: 'line', a: [4, -26], b: [4, 12], w: 7, on: 'ankle', tone: 'move' }, { k: 'line', a: [7, -6], b: [44, -6], w: 3, on: 'ankle', tone: 'move' }] }),
  S({ ...pressBase, key: 'mollets-presse', feet: { path: still([158, 112]), foot: [100, 62] }, effort: 'toB',
    machine: [...PRESS_FRAME, { k: 'line', a: [3, -22], b: [3, 16], w: 7, on: 'toe', tone: 'move' }, { k: 'line', a: [6, -2], b: [40, -2], w: 3, on: 'toe', tone: 'move' }] }),

  legExtension('leg-extension'),
  legExtension('leg-extension-une-jambe', true),

  S({ key: 'leg-curl-assis', hip: [92, 118], torso: [-12, -12],
    feet: { path: { from: [176, 124], to: [132, 158], pivot: [136, 118] }, foot: [70, 20] },
    hands: { path: still([116, 106]) }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [...seat(102, 126, 62), back([76, 122], [66, 66]), stack(196), { k: 'circle', at: [124, 107], r: 6, tone: 'pad' },
      frame([124, 107], [196, 96], 4), { k: 'cable', from: [136, 118], to: 'ankle', w: 4, tone: 'frame' }, roller('ankle', [2, 6])] }),
  S({ key: 'leg-curl-allonge-ex', hip: [130, 118], torso: [-90, -90],
    feet: { path: { from: [214, 124], to: [180, 80], pivot: [174, 120] }, foot: [-70, -10] },
    hands: { path: still([70, 134]) }, bend: { knee: 1, elbow: -1 }, effort: 'toB',
    machine: [frame([54, 128], [182, 128], 9), frame([70, 132], [70, 166]), frame([170, 132], [170, 166]), stack(206),
      { k: 'cable', from: [174, 124], to: 'ankle', w: 4, tone: 'frame' }, roller('ankle', [2, -5])] }),

  // Abducteurs et adducteurs (de face)
  S({ key: 'abduction-machine', front: true, hip: [120, 118], torso: [0, 0], limbs: { thigh: 12, shin: 40 },
    feet: { path: line([130, 162], [148, 160]), foot: 0 }, hands: { path: still([152, 114]) }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [{ k: 'rect', at: [98, 40], size: [44, 82], tone: 'frame' }, frame([92, 126], [148, 126], 8), frame([120, 130], [120, 166]),
      { k: 'line', a: [6, -9], b: [6, 9], w: 6, on: 'knee', tone: 'move', both: true }] }),
  S({ key: 'adduction-machine', front: true, hip: [120, 118], torso: [0, 0], limbs: { thigh: 12, shin: 40 },
    feet: { path: line([148, 160], [130, 162]), foot: 0 }, hands: { path: still([152, 114]) }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [{ k: 'rect', at: [98, 40], size: [44, 82], tone: 'frame' }, frame([92, 126], [148, 126], 8), frame([120, 130], [120, 166]),
      { k: 'line', a: [-6, -9], b: [-6, 9], w: 6, on: 'knee', tone: 'move', both: true }] }),

  // Fessiers et mollets
  S({ key: 'fessier-machine', zoom: 1.25, hip: [104, 92], torso: [58, 58], single: 'leg', stance: { ankle: [110, 160], foot: 4, bend: -1 },
    feet: { path: line([124, 136], [52, 112]), foot: [80, 60] }, hands: { path: still([170, 70]) }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [frame([140, 62], [166, 84], 9), frame([166, 70], [166, 166]), frame([166, 70], [176, 70], 5), stack(196),
      { k: 'line', a: [-3, -16], b: [-3, 10], w: 6, on: 'toe', tone: 'move' }] }),
  S({ key: 'mollets-machine-ex', zoom: 1.25, hip: line([116, 66], [119, 56]), torso: [0, 0],
    feet: { path: line([118, 149], [122, 139]), foot: [-5, -45] }, hands: { path: { from: [10, -2], to: [10, -2] }, relative: true },
    bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [frame([120, 152], [150, 152], 8), frame([150, 152], [150, 166]), stack(196), frame([170, -40], [170, 166]),
      { k: 'line', a: [-8, -3], b: [16, -3], w: 7, on: 'chest', tone: 'pad' }, { k: 'cable', from: [170, -10], to: 'chest', w: 4, tone: 'frame' }] }),

  // Développés
  S({ key: 'developpe-machine-un-bras', single: 'arm', hip: [82, 126], torso: [-8, -8], feet: floorFeet(124),
    hands: { path: { from: [88, 80], to: [132, 79], pivot: [110, 4] } }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [...seat(81, 134, 38), back([66, 128], [60, 64]), frame([48, 4], [170, 4]), frame([48, 4], [48, 166]), { k: 'circle', at: [110, 4], r: 5 },
      stack(178), lever({ from: [88, 80], to: [132, 79], pivot: [110, 4] }), grip] }),
  ((): MotionSpec => {
    const p = arc([76, 78], [110, 52], -40);
    return S({ key: 'developpe-incline-machine', hip: [84, 126], torso: [-25, -25], feet: floorFeet(128), hands: { path: p },
      bend: { knee: -1, elbow: 1 }, effort: 'toB',
      machine: [...seat(86, 134, 38), back([70, 132], [46, 82]), stack(196), frame([pivotOf(p)[0], pivotOf(p)[1]], [196, 40], 5), lever(p), grip] });
  })(),
  S({ key: 'butterfly', front: true, hip: [120, 118], torso: [0, 0], limbs: { thigh: 12, shin: 40, upperArm: 23, forearm: 22 }, feet: { path: still([132, 162]), foot: 0 },
    hands: { path: line([175, 70], [125, 74]) }, bend: { knee: -1, elbow: -1 }, effort: 'toB',
    machine: [{ k: 'rect', at: [98, 40], size: [44, 82], tone: 'frame' }, frame([92, 126], [148, 126], 8), frame([120, 130], [120, 166]),
      { k: 'line', a: [0, -14], b: [0, 4], w: 6, on: 'hand', tone: 'move', both: true }] }),
  S({ key: 'oiseau-machine', front: true, hip: [120, 118], torso: [0, 0], limbs: { thigh: 12, shin: 40, upperArm: 26, forearm: 26 }, feet: { path: still([132, 162]), foot: 0 },
    hands: { path: line([127, 72], [178, 70]) }, bend: { knee: -1, elbow: -1 }, effort: 'toB',
    machine: [frame([92, 126], [148, 126], 8), frame([120, 130], [120, 166]), { k: 'line', a: [-4, -6], b: [8, -6], w: 5, on: 'hand', tone: 'move', both: true }] }),

  // Épaules
  ((): MotionSpec => {
    const p = arc([94, 70], [92, 22], 40);
    return S({ key: 'developpe-epaules-machine', hip: [88, 126], torso: [-6, -6], feet: floorFeet(130), hands: { path: p },
      bend: { knee: -1, elbow: 1 }, effort: 'toB',
      machine: [...seat(88, 134, 38), back([72, 128], [66, 50]), stack(196), lever(p), grip] });
  })(),
  S({ key: 'elevations-laterales-machine-ex', front: true, hip: [120, 118], limbs: { thigh: 12, shin: 40 }, torso: [0, 0], feet: { path: still([132, 162]), foot: 0 },
    hands: { path: { from: [140, 116], to: [183, 76], pivot: [133, 66] } }, bend: { knee: -1, elbow: -1 }, effort: 'toB',
    machine: [frame([92, 126], [148, 126], 8), frame([120, 130], [120, 166]), frame([106, 90], [134, 90], 10),
      { k: 'line', a: [-6, -4], b: [6, 4], w: 7, on: 'elbow', tone: 'move', both: true }] }),

  // Tirage vertical
  ...([['tirage-vertical-serre', [100, 20], [97, 82]], ['tirage-vertical-supination', [103, 19], [98, 76]]] as const).map(([key, a, b]) => S({
    key, hip: [96, 126], torso: [-6, -14], feet: { path: still([138, 160]), foot: 4 }, hands: { path: line(a, b) },
    bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [{ k: 'line', a: [70, 134], b: [118, 134], w: 8, tone: 'pad' }, frame([94, 138], [94, 166]), frame([164, 8], [164, 166], 7), frame([100, 8], [164, 8]),
      { k: 'circle', at: [104, 9], r: 5 }, frame([131, 108], [164, 104], 5), { k: 'circle', at: [131, 109], r: 6, tone: 'pad' },
      { k: 'line', a: [187, 8], b: [187, 42], w: 1.4, tone: 'cable' }, stack(176), cableTo([104, 9]),
      key === 'tirage-vertical-serre' ? { k: 'line', a: [-4, -4], b: [4, 4], w: 5, on: 'hand', tone: 'move' } : { k: 'line', a: [-9, 0], b: [9, 0], w: 6, on: 'hand', tone: 'move' }],
  })),

  // Rowing assis
  ...([['rowing-assis', [136, 80], [98, 84]], ['rowing-assis-large', [134, 70], [100, 70]]] as const).map(([key, a, b]) => S({
    key, hip: [80, 126], torso: [2, 2], feet: { path: still([124, 150]), foot: 70 }, hands: { path: line(a, b) },
    bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [...seat(80, 134, 38), frame([110, 66], [110, 108], 9), frame([110, 108], [110, 166], 5), frame([130, 156], [130, 166], 4),
      { k: 'line', a: [124, 150], b: [134, 140], w: 4 }, stack(196), cableTo([192, 80]), grip],
  })),

  // Bras
  S({ key: 'curl-machine', hip: [92, 126], torso: [6, 6], feet: floorFeet(134),
    hands: { path: { from: [134, 104], to: [106, 70], pivot: [110, 96] } }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [...seat(92, 134, 38), frame([96, 98], [126, 110], 9), frame([126, 110], [126, 166], 5), stack(196),
      { k: 'cable', from: [110, 98], to: 'hand', w: 4, tone: 'frame' }, grip] }),
  ((): MotionSpec => {
    const p = arc([92, 98], [97, 128], 30);
    return S({ key: 'triceps-machine-ex', hip: [86, 126], torso: [-4, -4], feet: floorFeet(128), hands: { path: p },
      bend: { knee: -1, elbow: -1 }, effort: 'toB',
      machine: [...seat(86, 134, 38), back([70, 128], [66, 66]), stack(196), lever(p), grip] });
  })(),

  // Abdominaux et lombaires
  S({ key: 'crunch-machine', hip: [92, 126], torso: [-5, 32], feet: { path: still([132, 152]), foot: 30 },
    hands: { path: still([8, -4]), relative: true }, bend: { knee: -1, elbow: -1 }, effort: 'toB',
    machine: [...seat(92, 134, 38), back([76, 128], [72, 70]), stack(196), { k: 'cable', from: [86, 60], to: 'hand', w: 4, tone: 'frame' },
      { k: 'line', a: [-2, -8], b: [8, -8], w: 6, on: 'hand', tone: 'pad' }, frame([128, 156], [142, 148], 5)] }),
  S({ key: 'extension-lombaires-machine', hip: [92, 126], torso: [28, -6], feet: { path: still([132, 152]), foot: 30 },
    hands: { path: still([10, 10]), relative: true }, bend: { knee: -1, elbow: -1 }, effort: 'toB',
    machine: [...seat(92, 134, 38), stack(196), { k: 'line', a: [-8, -10], b: [-8, 14], w: 8, on: 'chest', tone: 'pad' },
      { k: 'cable', from: [76, 128], to: 'chest', offset: [-8, 0], w: 4, tone: 'frame' }, frame([128, 156], [142, 148], 5)] }),
  S({ key: 'extension-lombaires-banc', zoom: 1.25, hip: [120, 96], torso: [150, 48], feet: { path: still([62, 150]), foot: 40 },
    hands: { path: still([6, 8]), relative: true }, bend: { knee: 1, elbow: -1 }, effort: 'toB',
    machine: [frame([110, 104], [134, 82], 10), frame([56, 156], [70, 148], 8), frame([60, 160], [110, 104], 5), frame([60, 160], [60, 166], 5), frame([122, 96], [122, 166], 4)] }),

  // Assistance
  S({ key: 'traction-assistee', hip: line([104, 122], [104, 88]), torso: [-6, -6], feet: { path: line([64, 150], [64, 116]), foot: -20 },
    hands: { path: still([110, 14]) }, bend: { knee: 1, elbow: 1 }, effort: 'toB',
    machine: [frame([92, 14], [150, 14], 5), frame([150, 8], [150, 166], 7), { k: 'line', a: [-14, 6], b: [10, 6], w: 7, on: 'knee', tone: 'pad' },
      { k: 'cable', from: [150, 140], to: 'knee', w: 4, tone: 'frame' }, stack(176)] }),
  S({ key: 'dips-assistes', hip: line([99, 91], [95, 117]), torso: [10, 14], feet: { path: line([58, 118], [54, 144]), foot: -20 },
    hands: { path: still([112, 92]) }, bend: { knee: 1, elbow: -1 }, effort: 'toA',
    machine: [frame([96, 94], [128, 94], 6), frame([128, 94], [128, 166], 6), { k: 'line', a: [-14, 6], b: [10, 6], w: 7, on: 'knee', tone: 'pad' },
      { k: 'cable', from: [150, 150], to: 'knee', w: 4, tone: 'frame' }, stack(176)] }),

  // Hack squat
  S({ key: 'hack-squat-ex', zoom: 1.2, hip: line([112, 74], [96, 118]), torso: [-20, -20], feet: { path: still([150, 150]), foot: 20 },
    hands: { path: still([8, 4]), relative: true }, bend: { knee: -1, elbow: 1 }, effort: 'toA',
    machine: [frame([128, 30], [72, 166], 5), frame([138, 158], [178, 144], 8), frame([160, 152], [160, 166], 5),
      { k: 'line', a: [-14, 4], b: [-30, 50], w: 9, on: 'chest', tone: 'pad' }, { k: 'circle', at: [2, -4], r: 5, on: 'chest', tone: 'pad' }] }),

  // ---------- Poulies ----------
  S({ key: 'ecarte-poulies-haut-bas', front: true, zoom: 1.3, hip: [120, 82], torso: [0, 0], feet: { path: still([136, 160]), foot: 0 },
    hands: { path: line([178, 26], [126, 70]) }, bend: { knee: -1, elbow: -1 }, effort: 'toB',
    machine: [frame([222, -50], [222, 166], 7), frame([18, -50], [18, 166], 7), cableTo([218, -10], 'hand', true), grip] }),
  S({ key: 'ecarte-poulies-bas-haut', front: true, zoom: 1.3, hip: [120, 82], torso: [0, 0], feet: { path: still([136, 160]), foot: 0 },
    hands: { path: line([160, 78], [126, 42]) }, bend: { knee: -1, elbow: -1 }, effort: 'toB',
    machine: [frame([222, -50], [222, 166], 7), frame([18, -50], [18, 166], 7), cableTo([218, 150], 'hand', true), grip] }),
  S({ key: 'extension-triceps-corde', zoom: 1.3, hip: [100, 82], torso: [10, 10], feet: { path: still([104, 160]), foot: 4 },
    hands: { path: { from: [132, 52], to: [118, 88], pivot: [110, 60] } }, bend: { knee: -1, elbow: -1 }, effort: 'toB',
    machine: [...column(196, -30), cableTo([192, -30]), grip] }),
  S({ key: 'extension-triceps-nuque', zoom: 1.3, hip: [110, 84], torso: [25, 25], stance: { ankle: [80, 160], foot: 4, bend: -1 },
    feet: { path: still([140, 160]), foot: 4 }, hands: { path: { from: [128, 12], to: [180, 4], pivot: [146, 20] } }, bend: { knee: -1, elbow: -1 }, effort: 'toB',
    machine: [...column(30, 150), cableTo([34, 150]), grip] }),
  S({ key: 'curl-poulie-basse', zoom: 1.3, hip: [102, 82], torso: [0, 0], feet: { path: still([108, 160]), foot: 4 },
    hands: { path: { from: [114, 84], to: [116, 40], pivot: [104, 58] } }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [...column(196, 156), cableTo([192, 156]), grip] }),
  S({ key: 'elevation-laterale-poulie', front: true, single: 'arm', zoom: 1.3, hip: [120, 82], torso: [0, 0], feet: { path: still([136, 160]), foot: 0 },
    hands: { path: { from: [138, 86], to: [184, 32], pivot: [133, 30] } }, bend: { knee: -1, elbow: -1 }, effort: 'toB',
    machine: [frame([18, -50], [18, 166], 7), cableTo([22, 156]), grip] }),
  S({ key: 'face-pull', zoom: 1.3, hip: [100, 82], torso: [-5, -5], stance: { ankle: [76, 160], foot: 4, bend: -1 }, feet: { path: still([116, 160]), foot: 4 },
    hands: { path: line([150, 32], [112, 24]) }, bend: { knee: -1, elbow: -1 }, effort: 'toB',
    machine: [...column(200, 30), cableTo([196, 30]), grip] }),
  S({ key: 'tirage-bras-tendus', zoom: 1.3, hip: [96, 84], torso: [15, 15], feet: { path: still([100, 160]), foot: 4 },
    hands: { path: { from: [146, -2], to: [118, 88], pivot: [109, 34] } }, bend: { knee: -1, elbow: -1 }, effort: 'toB',
    machine: [...column(200, -36), cableTo([196, -36]), { k: 'line', a: [-8, 2], b: [8, -2], w: 5, on: 'hand', tone: 'move' }] }),
  S({ key: 'rowing-poulie-un-bras', zoom: 1.3, single: 'arm', hip: [96, 84], torso: [10, 10], stance: { ankle: [70, 160], foot: 4, bend: -1 },
    feet: { path: still([120, 160]), foot: 4 }, hands: { path: line([154, 58], [104, 68]) }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [...column(200, 58), cableTo([196, 58]), grip] }),
  S({ key: 'bucheron', zoom: 1.3, hip: [110, 84], torso: [4, 18], stance: { ankle: [86, 160], foot: 4, bend: -1 }, feet: { path: still([134, 160]), foot: 4 },
    hands: { path: line([162, 8], [100, 84]) }, bend: { knee: -1, elbow: -1 }, effort: 'toB',
    machine: [...column(206, -30), cableTo([202, -30]), grip] }),
  S({ key: 'pallof', zoom: 1.3, hip: [100, 82], torso: [0, 0], feet: { path: still([108, 160]), foot: 4 },
    hands: { path: line([112, 40], [154, 40]) }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [frame([62, -40], [62, 166], 7), cableTo([66, 40]), grip] }),
  S({ key: 'kickback-fessier-poulie', zoom: 1.3, single: 'leg', hip: [104, 84], torso: [22, 22], stance: { ankle: [112, 160], foot: 4, bend: -1 },
    feet: { path: line([108, 158], [46, 140]), foot: [4, -30] }, hands: { path: still([164, 50]) }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [...column(176, 158), cableTo([172, 158], 'ankle'), roller('ankle', [0, 0], 4)] }),
  S({ key: 'abduction-poulie', front: true, single: 'leg', zoom: 1.3, hip: [120, 82], torso: [0, 0], feet: { path: line([130, 160], [160, 150]), foot: 0 },
    hands: { path: still([150, 70]) }, bend: { knee: -1, elbow: -1 }, effort: 'toB',
    machine: [frame([18, -50], [18, 166], 7), cableTo([22, 162], 'ankle'), roller('ankle', [0, 0], 4)] }),
  S({ key: 'crunch-poulie', zoom: 1.3, hip: [110, 110], torso: [10, 72], feet: { path: still([66, 160]), foot: -10 },
    hands: { path: still([6, -8]), relative: true }, bend: { knee: 1, elbow: -1 }, effort: 'toB',
    machine: [...column(200, -30), cableTo([196, -30]), grip] }),
  S({ key: 'pull-through', zoom: 1.3, hip: line([104, 84], [92, 92]), torso: [0, 60], feet: { path: still([110, 160]), foot: 4 },
    hands: { path: line([6, 54], [-9, 52]), relative: true }, bend: { knee: -1, elbow: 1 }, effort: 'toA',
    machine: [...column(30, 156), cableTo([34, 156]), grip] }),
  S({ key: 'oiseau-poulies', front: true, zoom: 1.3, hip: [120, 82], torso: [0, 0], feet: { path: still([136, 160]), foot: 0 },
    hands: { path: line([116, 40], [184, 34]) }, bend: { knee: -1, elbow: -1 }, effort: 'toB',
    machine: [frame([222, -50], [222, 166], 7), frame([18, -50], [18, 166], 7), cableTo([22, 34], 'hand', true)] }),

  // ---------- Smith machine ----------
  S({ key: 'squat-smith', zoom: 1.25, hip: line([104, 80], [84, 120]), torso: [10, 35], feet: { path: still([120, 160]), foot: 4 },
    hands: { path: still([2, -6]), relative: true }, bend: { knee: -1, elbow: 1 }, effort: 'toA',
    machine: [smithRail(114), { k: 'circle', at: [0, -4], r: 6, on: 'chest', tone: 'move' }] }),
  S({ key: 'fente-smith', zoom: 1.25, hip: line([100, 84], [100, 116]), torso: [0, 0], stance: { ankle: [62, 156], foot: -60, bend: 1 },
    feet: { path: still([136, 160]), foot: 4 }, hands: { path: still([2, -5]), relative: true }, bend: { knee: -1, elbow: 1 }, effort: 'toA',
    machine: [smithRail(101), { k: 'circle', at: [1, -4], r: 6, on: 'chest', tone: 'move' }] }),
  S({ key: 'developpe-couche-smith', hip: [130, 124], torso: [-90, -90], feet: { path: still([176, 160]), foot: 4 },
    hands: { path: line([82, 112], [80, 68]) }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [frame([50, 132], [150, 132], 8), frame([60, 136], [60, 166]), frame([140, 136], [140, 166]), smithRail(81), barEnd] }),
  S({ key: 'developpe-incline-smith', hip: [120, 120], torso: [-60, -60], feet: { path: still([168, 160]), foot: 4 },
    hands: { path: line([82, 88], [84, 40]) }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [back([116, 130], [64, 100]), frame([96, 130], [96, 166]), smithRail(83), barEnd] }),
  S({ key: 'developpe-militaire-smith', hip: [100, 126], torso: [-4, -4], feet: floorFeet(140),
    hands: { path: line([106, 62], [106, 18]) }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [...seat(100, 134, 38), back([86, 128], [82, 66]), smithRail(106), barEnd] }),
  S({ key: 'rowing-smith', zoom: 1.25, hip: [100, 84], torso: [50, 50], feet: { path: still([110, 160]), foot: 4 },
    hands: { path: line([132, 104], [130, 76]) }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [smithRail(131), barEnd] }),
  S({ key: 'hip-thrust-smith', hip: line([118, 138], [121, 112]), torso: [-67, -97], feet: { path: still([152, 160]), foot: 4 },
    hands: { path: line([118, 128], [121, 102]) }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [frame([36, 126], [76, 126], 9), frame([50, 130], [50, 166]), smithRail(120), { k: 'circle', at: [2, -8], r: 6, on: 'hip', tone: 'move' }] }),
  S({ key: 'souleve-roumain-smith', zoom: 1.25, hip: line([104, 82], [90, 88]), torso: [0, 74], feet: { path: still([112, 160]), foot: 4 },
    hands: { path: line([116, 80], [116, 116]) }, bend: { knee: -1, elbow: 1 }, effort: 'toA',
    machine: [smithRail(116), barEnd] }),
  S({ key: 'mollets-smith', zoom: 1.25, hip: line([116, 66], [119, 56]), torso: [0, 0], feet: { path: line([118, 149], [122, 139]), foot: [-5, -45] },
    hands: { path: still([4, -6]), relative: true }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [frame([120, 152], [150, 152], 8), smithRail(118), { k: 'circle', at: [0, -4], r: 6, on: 'chest', tone: 'move' }] }),
  S({ key: 'rowing-inverse-smith', hip: { from: [112.9, 137.7], to: [125.6, 110.7], pivot: [196, 160] }, torso: [-75, -55],
    feet: { path: still([196, 160]), foot: 80 }, hands: { path: still([72.7, 68.2]) }, bend: { knee: 1, elbow: 1 }, effort: 'toB',
    machine: [smithRail(73), barEnd] }),
  S({ key: 'pompes-inclinees-smith', hip: { from: [122, 123.7], to: [139.2, 99.2], pivot: [200, 160] }, torso: [-65, -45],
    feet: { path: still([200, 160]), foot: 70 }, hands: { path: still([76, 112]) }, bend: { knee: 1, elbow: -1 }, effort: 'toB',
    machine: [smithRail(76), barEnd] }),

  // ---------- Cardio ----------
  S({ key: 'marche-inclinee', zoom: 1.3, cycle: { far: 0.5, per: 4 }, hip: { from: [110, 80], to: [110, 80], orbit: { c: [110, 80], rx: 0, ry: 1.5, start: 0 } },
    torso: [3, 3], feet: { path: { from: [0, 0], to: [0, 0], orbit: { c: [112, 150], rx: 22, ry: 6, start: 0 } }, foot: 0 },
    hands: { path: { from: [0, 0], to: [0, 0], orbit: { c: [8, 46], rx: 10, ry: 3, start: 180 } }, relative: true }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [frame([30, 160], [196, 152], 8), frame([196, 152], [204, 40], 6), frame([186, 60], [206, 60], 5)] }),
  S({ key: 'course-tapis', zoom: 1.3, cycle: { far: 0.5, per: 6 }, hip: { from: [110, 84], to: [110, 84], orbit: { c: [110, 84], rx: 0, ry: 3, start: 0 } },
    torso: [8, 8], feet: { path: { from: [0, 0], to: [0, 0], orbit: { c: [112, 140], rx: 30, ry: 14, start: 0 } }, foot: 0 },
    hands: { path: { from: [0, 0], to: [0, 0], orbit: { c: [14, 26], rx: 12, ry: 4, start: 180 } }, relative: true }, bend: { knee: -1, elbow: -1 }, effort: 'toB',
    machine: [frame([30, 162], [196, 160], 8), frame([196, 160], [204, 40], 6), frame([186, 60], [206, 60], 5)] }),
  S({ key: 'velo-droit-ex', cycle: { far: 0.5, per: 6 }, hip: [100, 84], torso: [30, 30],
    feet: { path: { from: [0, 0], to: [0, 0], orbit: { c: [128, 134], rx: 16, ry: 16, start: 0 } }, foot: 0 },
    hands: { path: still([150, 52]) }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [frame([88, 92], [112, 92], 7), frame([100, 96], [128, 134], 6), frame([128, 134], [158, 60], 6), frame([146, 52], [160, 52], 5),
      { k: 'circle', at: [128, 134], r: 5 }, frame([84, 166], [176, 166], 8), frame([128, 134], [128, 166], 6)] }),
  S({ key: 'velo-allonge-ex', cycle: { far: 0.5, per: 5 }, hip: [84, 120], torso: [-25, -25],
    feet: { path: { from: [0, 0], to: [0, 0], orbit: { c: [150, 128], rx: 16, ry: 16, start: 0 } }, foot: 0 },
    hands: { path: still([90, 120]) }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [...seat(86, 128, 44), back([70, 126], [50, 80]), frame([108, 132], [150, 128], 6), { k: 'circle', at: [150, 128], r: 5 }, frame([150, 128], [150, 166], 6)] }),
  S({ key: 'rameur-ex', hip: line([96, 140], [52, 140]), torso: [25, -25], feet: { path: still([136, 150]), foot: 70 },
    hands: { path: line([42, 25], [26, 19]), relative: true }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    phases: { hip: [0, 0.55], torso: [0.3, 0.8], hands: [0.55, 1] },
    machine: [frame([20, 152], [200, 152], 5), { k: 'circle', at: [196, 128], r: 16 }, cableTo([184, 124]), frame([128, 156], [142, 140], 5),
      { k: 'line', a: [-14, 8], b: [12, 8], w: 7, on: 'hip', tone: 'pad' }, grip] }),
  S({ key: 'velo-elliptique-ex', zoom: 1.3, cycle: { far: 0.5, per: 4 }, hip: { from: [110, 80], to: [110, 80], orbit: { c: [110, 80], rx: 2, ry: 2, start: 90 } },
    torso: [4, 4], feet: { path: { from: [0, 0], to: [0, 0], orbit: { c: [110, 146], rx: 22, ry: 8, start: 0 } }, foot: 0 },
    hands: { path: { from: [0, 0], to: [0, 0], orbit: { c: [130, 64], rx: 12, ry: 2, start: 180 } } }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [frame([60, 162], [190, 162], 8), frame([170, 162], [176, 70], 6), { k: 'cable', from: [160, 130], to: 'hand', w: 5, tone: 'frame' },
      { k: 'line', a: [-12, 3], b: [12, 3], w: 5, on: 'ankle', tone: 'pad' }, grip] }),
  S({ key: 'escalier-ex', zoom: 1.3, cycle: { far: 0.5, per: 3 }, hip: { from: [110, 78], to: [110, 78], orbit: { c: [110, 78], rx: 0, ry: 3, start: 90 } },
    torso: [6, 6], feet: { path: { from: [0, 0], to: [0, 0], orbit: { c: [118, 142], rx: 5, ry: 14, start: 0 } }, foot: 0 },
    hands: { path: still([146, 64]) }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [frame([80, 166], [176, 110], 4), frame([92, 160], [116, 160], 4), frame([110, 146], [134, 146], 4), frame([128, 132], [152, 132], 4),
      frame([150, 60], [162, 166], 6), frame([140, 64], [162, 64], 5)] }),
  S({ key: 'velo-air-ex', cycle: { far: 0.5, per: 5 }, hip: [100, 84], torso: [24, 24],
    feet: { path: { from: [0, 0], to: [0, 0], orbit: { c: [128, 134], rx: 16, ry: 16, start: 0 } }, foot: 0 },
    hands: { path: { from: [0, 0], to: [0, 0], orbit: { c: [148, 58], rx: 10, ry: 2, start: 180 } } }, bend: { knee: -1, elbow: 1 }, effort: 'toB',
    machine: [frame([88, 92], [112, 92], 7), frame([100, 96], [128, 134], 6), { k: 'circle', at: [184, 120], r: 26 }, { k: 'circle', at: [128, 134], r: 5 },
      { k: 'cable', from: [150, 120], to: 'hand', w: 5, tone: 'frame' }, frame([84, 166], [210, 166], 8), grip] }),
  S({ key: 'skierg-ex', zoom: 1.3, hip: line([100, 82], [92, 92]), torso: [0, 35], feet: { path: still([104, 160]), foot: 4 },
    hands: { path: line([124, -8], [128, 100]) }, bend: { knee: -1, elbow: -1 }, effort: 'toB',
    machine: [frame([156, -44], [156, 166], 9), cableTo([150, -36]), grip] }),
];
