/**
 * D-178 · Animations dessinées des exercices sur machine : une silhouette et sa machine en schéma, de profil, qui
 * bougent en boucle. Un seul gabarit pour tous les exercices : chacun se décrit par la position fixe du bassin, l’angle
 * du buste, et le trajet des mains et des pieds entre le départ et l’arrivée ; les genoux et les coudes se placent
 * seuls (cinématique inverse), les membres gardent leur longueur. Sortie : un SVG animé de quelques kilo-octets,
 * muet, en boucle de 4 s, aux couleurs du thème (clair ou sombre), lisible hors ligne puisqu’il est dans la page.
 */

export type Pt = readonly [number, number];
/** Trajet d’un point de contact (mains sur la poignée, pieds sur la plateforme) : en ligne droite ou en arc autour d’un pivot. */
export type Path = { from: Pt; to: Pt; pivot?: Pt };
type Anchor = 'hand' | 'ankle' | 'knee' | 'shoulder' | 'hip';

/** Partie de machine : fixe, ou portée par un point du corps (elle bouge avec lui). */
export type Shape =
  | { k: 'line'; a: Pt; b: Pt; w?: number; on?: Anchor; tone?: 'frame' | 'pad' | 'cable' | 'move' }
  | { k: 'rect'; at: Pt; size: Pt; on?: Anchor; tone?: 'frame' | 'pad' | 'stack' }
  | { k: 'circle'; at: Pt; r: number; on?: Anchor; tone?: 'frame' | 'pad' }
  /** Câble tendu entre un point fixe et un point du corps (la barre, la poignée). */
  | { k: 'cable'; from: Pt; to: Anchor; offset?: Pt; w?: number; tone?: 'cable' | 'frame' };

export interface MotionSpec {
  key: string;
  /** Bassin (fixe sur le siège). */
  hip: Pt;
  /** Inclinaison du buste en degrés depuis la verticale, négative vers l’arrière : au départ, à l’arrivée. */
  torso: readonly [number, number];
  /** Pieds : chevilles le long d’un trajet (ou fixes), angle du pied depuis l’horizontale (degrés, positif vers le haut). */
  feet: { path: Path; foot: number };
  hands: { path: Path };
  /** Sens dans lequel plient genoux et coudes (1 ou −1, selon le côté du segment bassin-cheville ou épaule-main). */
  bend: { knee: 1 | -1; elbow: 1 | -1 };
  /** L’effort (phase concentrique) va du départ vers l’arrivée (« toB ») ou revient (« toA »). */
  effort: 'toB' | 'toA';
  machine: Shape[];
}

/** Longueurs des segments, en unités du dessin (cadre 240 × 180). */
export const BODY = { torso: 52, neck: 15, head: 9, thigh: 44, shin: 42, foot: 15, upperArm: 30, forearm: 28 } as const;
/** Tempo : effort 1,2 s, retour freiné 2 s, deux courts temps d’arrêt ; boucle de 4 s. */
export const TEMPO = { effort: 1.2, back: 2.0, holdB: 0.3, holdA: 0.5 } as const;
export const LOOP_SECONDS = TEMPO.effort + TEMPO.back + TEMPO.holdA + TEMPO.holdB;

const rad = (d: number) => (d * Math.PI) / 180;
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

/** Point du trajet à l’avancement t (0 = départ, 1 = arrivée). */
export function pathAt(p: Path, t: number): Pt {
  if (!p.pivot) return [lerp(p.from[0], p.to[0], t), lerp(p.from[1], p.to[1], t)];
  const [cx, cy] = p.pivot;
  const r0 = dist(p.pivot, p.from), r1 = dist(p.pivot, p.to);
  const a0 = Math.atan2(p.from[1] - cy, p.from[0] - cx), a1 = Math.atan2(p.to[1] - cy, p.to[0] - cx);
  const a = lerp(a0, a1, t), r = lerp(r0, r1, t);
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** Articulation du milieu (genou, coude) entre une racine et une cible, membres de longueur a et b. */
export function ik(root: Pt, target: Pt, a: number, b: number, bend: 1 | -1): Pt {
  const d = Math.min(Math.max(dist(root, target), Math.abs(a - b) + 1e-6), a + b - 1e-6);
  const base = Math.atan2(target[1] - root[1], target[0] - root[0]);
  const alpha = Math.acos((a * a + d * d - b * b) / (2 * a * d));
  const ang = base + bend * alpha;
  return [root[0] + a * Math.cos(ang), root[1] + a * Math.sin(ang)];
}

export interface Pose { hip: Pt; shoulder: Pt; head: Pt; knee: Pt; ankle: Pt; toe: Pt; elbow: Pt; hand: Pt; /** La cible des mains est atteinte (sinon le geste est impossible). */ reach: number }

/** Position du corps à l’avancement t entre le départ et l’arrivée. */
export function poseAt(s: MotionSpec, t: number): Pose {
  const lean = rad(lerp(s.torso[0], s.torso[1], t));
  const dir: Pt = [Math.sin(lean), -Math.cos(lean)];
  const shoulder: Pt = [s.hip[0] + BODY.torso * dir[0], s.hip[1] + BODY.torso * dir[1]];
  const head: Pt = [shoulder[0] + (BODY.neck) * dir[0], shoulder[1] + (BODY.neck) * dir[1]];
  const ankle = pathAt(s.feet.path, t);
  const knee = ik(s.hip, ankle, BODY.thigh, BODY.shin, s.bend.knee);
  const fa = rad(s.feet.foot);
  const toe: Pt = [ankle[0] + BODY.foot * Math.cos(fa), ankle[1] - BODY.foot * Math.sin(fa)];
  const target = pathAt(s.hands.path, t);
  const elbow = ik(shoulder, target, BODY.upperArm, BODY.forearm, s.bend.elbow);
  const fd = dist(elbow, target);
  const hand: Pt = [elbow[0] + ((target[0] - elbow[0]) / fd) * BODY.forearm, elbow[1] + ((target[1] - elbow[1]) / fd) * BODY.forearm];
  return { hip: s.hip, shoulder, head, knee, ankle, toe, elbow, hand, reach: dist(hand, target) };
}

/** Angle intérieur à une articulation, en degrés (180 = membre tendu). */
export function jointAngle(a: Pt, mid: Pt, b: Pt): number {
  const v1 = [a[0] - mid[0], a[1] - mid[1]], v2 = [b[0] - mid[0], b[1] - mid[1]];
  const c = (v1[0]! * v2[0]! + v1[1]! * v2[1]!) / (Math.hypot(v1[0]!, v1[1]!) * Math.hypot(v2[0]!, v2[1]!));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

/**
 * Avancement (0 = départ, 1 = arrivée) au temps u de la boucle (0 à 1) : arrêt au départ, aller, arrêt, retour.
 * L’aller dure le temps de l’effort si l’effort va vers l’arrivée, sinon le temps du retour freiné.
 */
export function progressAt(s: Pick<MotionSpec, 'effort'>, u: number): number {
  const go = s.effort === 'toB' ? TEMPO.effort : TEMPO.back;
  const back = s.effort === 'toB' ? TEMPO.back : TEMPO.effort;
  const t = u * LOOP_SECONDS;
  if (t < TEMPO.holdA) return 0;
  if (t < TEMPO.holdA + go) return ease((t - TEMPO.holdA) / go);
  if (t < TEMPO.holdA + go + TEMPO.holdB) return 1;
  return 1 - ease(Math.min(1, (t - TEMPO.holdA - go - TEMPO.holdB) / back));
}

const FRAMES = 40;
const f1 = (n: number) => String(Math.round(n * 10) / 10);

const COLORS = {
  body: 'var(--ds-ink, #0E1116)',
  frame: 'var(--ds-rule-strong, #C3C9D2)',
  pad: 'var(--ds-ink-2, #5A6372)',
  stack: 'var(--ds-surface-3, #E3E6EB)',
  move: 'var(--ds-signal, #FF5A1F)',
  cable: 'var(--ds-ink-2, #5A6372)',
} as const;

/** Options de rendu : `still` dessine l’image d’aperçu (position de départ, sans animation). */
export interface MotionRender { still?: boolean; title?: string; width?: number }

/** SVG animé (SMIL, sans script) d’un exercice ; lisible au téléphone, quelques kilo-octets. */
export function motionSvg(s: MotionSpec, o: MotionRender = {}): string {
  const us = Array.from({ length: FRAMES + 1 }, (_, i) => i / FRAMES);
  const poses = o.still ? [poseAt(s, 0)] : us.map((u) => poseAt(s, progressAt(s, u)));
  const keyTimes = us.map((u) => f1(u * 1000) === '1000' ? '1' : String(Math.round(u * 1000) / 1000)).join(';');
  const anim = (attr: string, vals: number[]) => (o.still || vals.every((v) => Math.abs(v - vals[0]!) < 0.05) ? ''
    : `<animate attributeName="${attr}" dur="${LOOP_SECONDS}s" repeatCount="indefinite" calcMode="linear" keyTimes="${keyTimes}" values="${vals.map(f1).join(';')}"/>`);
  const first = poses[0]!;
  const at = (on: Anchor | undefined, p: Pt, i: number): Pt => (on ? add(poses[i]![on], p) : p);
  const series = (fn: (pose: Pose, i: number) => number) => poses.map(fn);

  const line = (pa: (p: Pose, i: number) => Pt, pb: (p: Pose, i: number) => Pt, stroke: string, w: number, cap = 'round') =>
    `<line x1="${f1(pa(first, 0)[0])}" y1="${f1(pa(first, 0)[1])}" x2="${f1(pb(first, 0)[0])}" y2="${f1(pb(first, 0)[1])}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="${cap}">`
    + anim('x1', series((p, i) => pa(p, i)[0])) + anim('y1', series((p, i) => pa(p, i)[1]))
    + anim('x2', series((p, i) => pb(p, i)[0])) + anim('y2', series((p, i) => pb(p, i)[1])) + '</line>';

  const parts: string[] = [];
  // Sol.
  parts.push(`<line x1="8" y1="166" x2="232" y2="166" stroke="${COLORS.frame}" stroke-width="2" stroke-linecap="round"/>`);
  const drawShape = (m: Shape) => {
    if (m.k === 'cable') {
      const off = m.offset ?? [0, 0];
      parts.push(line(() => m.from, (p) => add(p[m.to], off), COLORS[m.tone ?? 'cable'], m.w ?? 1.2, m.tone === 'frame' ? 'round' : 'butt'));
    } else if (m.k === 'line') {
      const tone = m.tone ?? 'frame';
      parts.push(line((_, i) => at(m.on, m.a, i), (_, i) => at(m.on, m.b, i), COLORS[tone === 'cable' ? 'cable' : tone], m.w ?? 4));
    } else if (m.k === 'rect') {
      const fill = m.tone === 'stack' ? COLORS.stack : m.tone === 'pad' ? COLORS.pad : COLORS.frame;
      const p0 = at(m.on, m.at, 0);
      parts.push(`<rect x="${f1(p0[0])}" y="${f1(p0[1])}" width="${m.size[0]}" height="${m.size[1]}" rx="3" fill="${fill}">`
        + anim('x', series((_, i) => at(m.on, m.at, i)[0])) + anim('y', series((_, i) => at(m.on, m.at, i)[1])) + '</rect>');
    } else {
      const fill = m.tone === 'pad' ? COLORS.pad : COLORS.frame;
      const p0 = at(m.on, m.at, 0);
      parts.push(`<circle cx="${f1(p0[0])}" cy="${f1(p0[1])}" r="${m.r}" fill="${fill}">`
        + anim('cx', series((_, i) => at(m.on, m.at, i)[0])) + anim('cy', series((_, i) => at(m.on, m.at, i)[1])) + '</circle>');
    }
  };
  // Le bâti derrière le corps ; ce que l’on tient ou pousse devant.
  for (const m of s.machine) if (!('on' in m && m.on) && m.k !== 'cable') drawShape(m);
  for (const m of s.machine) if (m.k === 'cable') drawShape(m);
  const B = COLORS.body;
  parts.push(line((p) => p.hip, (p) => p.knee, B, 9));
  parts.push(line((p) => p.knee, (p) => p.ankle, B, 8));
  parts.push(line((p) => p.ankle, (p) => p.toe, B, 6));
  parts.push(line((p) => p.hip, (p) => p.shoulder, B, 11));
  parts.push(`<circle cx="${f1(first.head[0])}" cy="${f1(first.head[1])}" r="${BODY.head}" fill="${B}">`
    + anim('cx', series((p) => p.head[0])) + anim('cy', series((p) => p.head[1])) + '</circle>');
  parts.push(line((p) => p.shoulder, (p) => p.elbow, B, 7));
  parts.push(line((p) => p.elbow, (p) => p.hand, B, 6));
  for (const m of s.machine) if ('on' in m && m.on) drawShape(m);

  const title = o.title ? `<title>${o.title.replace(/[<&>"]/g, '')}</title>` : '';
  const w = o.width ? ` width="${o.width}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180"${w} role="img"${o.title ? ` aria-label="${o.title.replace(/[<&>"]/g, '')}"` : ''}>${title}${parts.join('')}</svg>`;
}

// ---------- Les trois pilotes ----------

/** Presse à cuisses assise : dossier incliné, plateforme verticale qui recule quand les jambes se tendent. */
const LEG_PRESS: MotionSpec = {
  key: 'presse-a-cuisses',
  hip: [78, 124],
  torso: [-42, -42],
  // Départ : jambes presque tendues (genoux à environ 160°) ; arrivée : genoux à 90°.
  feet: { path: { from: [160, 106], to: [139, 106] }, foot: 86 },
  hands: { path: { from: [76, 128], to: [76, 128] } },
  bend: { knee: -1, elbow: 1 },
  effort: 'toA',
  machine: [
    { k: 'line', a: [36, 166], b: [212, 166], w: 6 },
    { k: 'line', a: [80, 134], b: [80, 166], w: 6 },
    { k: 'line', a: [62, 132], b: [100, 132], w: 8, tone: 'pad' },
    { k: 'line', a: [70, 134], b: [37, 97], w: 8, tone: 'pad' },
    { k: 'line', a: [-5, 0], b: [5, 0], w: 5, on: 'hand', tone: 'pad' },
    { k: 'rect', at: [196, 46], size: [22, 112], tone: 'stack' },
    { k: 'line', a: [207, 40], b: [207, 166], w: 3 },
    // Plateforme et chariot, portés par les chevilles.
    { k: 'line', a: [4, -26], b: [4, 12], w: 7, on: 'ankle', tone: 'move' },
    { k: 'line', a: [7, -6], b: [44, -6], w: 3, on: 'ankle', tone: 'move' },
  ],
};

/** Tirage vertical : assis, cuisses calées, la barre descend du haut vers le haut de la poitrine. */
const LAT_PULLDOWN: MotionSpec = {
  key: 'tirage-vertical',
  hip: [96, 126],
  torso: [-6, -16],
  feet: { path: { from: [138, 160], to: [138, 160] }, foot: 4 },
  hands: { path: { from: [103.5, 18.5], to: [99, 72] } },
  bend: { knee: -1, elbow: 1 },
  effort: 'toB',
  machine: [
    { k: 'line', a: [70, 134], b: [118, 134], w: 8, tone: 'pad' },
    { k: 'line', a: [94, 138], b: [94, 166], w: 6 },
    { k: 'line', a: [164, 8], b: [164, 166], w: 7 },
    { k: 'line', a: [100, 8], b: [164, 8], w: 6 },
    { k: 'circle', at: [104, 9], r: 5 },
    { k: 'line', a: [131, 108], b: [164, 104], w: 5 },
    { k: 'circle', at: [131, 109], r: 6, tone: 'pad' },
    { k: 'rect', at: [176, 46], size: [22, 112], tone: 'stack' },
    { k: 'cable', from: [104, 9], to: 'hand' },
    // La barre, vue de bout, dans les mains.
    { k: 'line', a: [-9, 0], b: [9, 0], w: 6, on: 'hand', tone: 'move' },
  ],
};

/** Développé assis à la machine : dos contre le dossier, les poignées avancent sur un bras qui pivote au-dessus. */
const CHEST_PRESS: MotionSpec = {
  key: 'developpe-machine',
  hip: [82, 126],
  torso: [-8, -8],
  feet: { path: { from: [124, 160], to: [124, 160] }, foot: 4 },
  hands: { path: { from: [88, 80], to: [132, 79], pivot: [110, 4] } },
  bend: { knee: -1, elbow: 1 },
  effort: 'toB',
  machine: [
    { k: 'line', a: [62, 134], b: [100, 134], w: 8, tone: 'pad' },
    { k: 'line', a: [80, 138], b: [80, 166], w: 6 },
    { k: 'line', a: [66, 128], b: [60, 64], w: 8, tone: 'pad' },
    { k: 'line', a: [48, 4], b: [170, 4], w: 6 },
    { k: 'line', a: [48, 4], b: [48, 166], w: 6 },
    { k: 'circle', at: [110, 4], r: 5 },
    { k: 'rect', at: [178, 46], size: [22, 112], tone: 'stack' },
    { k: 'line', a: [189, 40], b: [189, 166], w: 3 },
    // Le bras de la machine : du pivot à la poignée.
    { k: 'cable', from: [110, 4], to: 'hand', w: 5, tone: 'frame' },
    { k: 'line', a: [0, -8], b: [0, 8], w: 7, on: 'hand', tone: 'move' },
  ],
};

/** Animations dessinées, par clé d’exercice de la bibliothèque des machines. */
export const MACHINE_MOTIONS: Readonly<Record<string, MotionSpec>> = {
  [LEG_PRESS.key]: LEG_PRESS,
  [LAT_PULLDOWN.key]: LAT_PULLDOWN,
  [CHEST_PRESS.key]: CHEST_PRESS,
};

/**
 * Relecture des animations par le fondateur : aucune n’est montrée à un élève sans y figurer (D-178, comme les vidéos
 * de base de D-099). On n’y ajoute une clé que sur sa validation explicite, avec la date.
 */
export const MOTION_REVIEWS: Readonly<Record<string, { validatedBy: string; validatedOn: string }>> = {};

export type MotionStatus = 'to_review' | 'validated';
export const MOTION_STATUS_LABELS: Record<MotionStatus, string> = { to_review: 'À relire', validated: 'Validée' };

export function motionStatus(key: string, reviews: Readonly<Record<string, unknown>> = MOTION_REVIEWS): MotionStatus | null {
  if (!MACHINE_MOTIONS[key]) return null;
  return reviews[key] ? 'validated' : 'to_review';
}

/** L’animation à montrer à un élève : seulement si elle est validée. */
export function athleteMotion(key: string | null | undefined, reviews: Readonly<Record<string, unknown>> = MOTION_REVIEWS): MotionSpec | null {
  return key && motionStatus(key, reviews) === 'validated' ? MACHINE_MOTIONS[key]! : null;
}
