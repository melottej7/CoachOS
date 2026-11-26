/**
 * D-178 · Animations dessinées des exercices sur machine : une silhouette et sa machine en schéma, de profil, qui
 * bougent en boucle. Un seul gabarit pour tous les exercices : chacun se décrit par la position fixe du bassin, l’angle
 * du buste, et le trajet des mains et des pieds entre le départ et l’arrivée ; les genoux et les coudes se placent
 * seuls (cinématique inverse), les membres gardent leur longueur. Sortie : un SVG animé de quelques kilo-octets,
 * muet, en boucle de 4 s, aux couleurs du thème (clair ou sombre), lisible hors ligne puisqu’il est dans la page.
 */

import { MORE_MOTIONS } from './machine-motion-specs';

export type Pt = readonly [number, number];
/** Trajet d’un point de contact (mains sur la poignée, pieds sur la plateforme) : en ligne droite ou en arc autour d’un pivot. */
export type Path = {
  from: Pt; to: Pt; pivot?: Pt;
  /** Tour complet (pédalier, foulée) : ellipse de centre c, rayons rx et ry, départ à `start` degrés ; from/to ignorés. */
  orbit?: { c: Pt; rx: number; ry: number; start: number };
};
type Anchor = 'hand' | 'ankle' | 'knee' | 'shoulder' | 'hip' | 'toe' | 'elbow' | 'chest';
type Part = 'hip' | 'torso' | 'feet' | 'hands';

/** Partie de machine : fixe, ou portée par un point du corps (elle bouge avec lui). */
export type Shape =
  | { k: 'line'; a: Pt; b: Pt; w?: number; on?: Anchor; tone?: 'frame' | 'pad' | 'cable' | 'move'; /** Vue de face : aussi du côté gauche. */ both?: boolean }
  | { k: 'rect'; at: Pt; size: Pt; on?: Anchor; tone?: 'frame' | 'pad' | 'stack' }
  | { k: 'circle'; at: Pt; r: number; on?: Anchor; tone?: 'frame' | 'pad' | 'move' }
  /** Câble tendu entre un point fixe et un point du corps (la barre, la poignée). */
  | { k: 'cable'; from: Pt; to: Anchor; offset?: Pt; w?: number; tone?: 'cable' | 'frame'; both?: boolean };

export interface MotionSpec {
  key: string;
  /** Bassin : fixe sur un siège, ou mobile (squat, rameur). En vue de face, le milieu du bassin. */
  hip: Pt | Path;
  /** Inclinaison du buste en degrés depuis la verticale, négative vers l’arrière : au départ, à l’arrivée. */
  torso: readonly [number, number];
  /** Pieds : chevilles le long d’un trajet (ou fixes), angle du pied depuis l’horizontale (degrés, positif vers le haut). */
  feet: { path: Path; /** Angle du pied, fixe ou du départ à l’arrivée (mollets). */ foot: number | readonly [number, number] };
  /** Mains ; `relative` : trajet compté depuis le milieu des épaules (elles suivent le buste : rameur, crunch). */
  hands: { path: Path; relative?: boolean };
  /** Sens dans lequel plient genoux et coudes (1 ou −1, selon le côté du segment bassin-cheville ou épaule-main). */
  bend: { knee: 1 | -1; elbow: 1 | -1 };
  /** L’effort (phase concentrique) va du départ vers l’arrivée (« toB ») ou revient (« toA »). */
  effort: 'toB' | 'toA';
  machine: Shape[];
  /** Chaque partie bouge dans sa fenêtre de l’aller (0 à 1) : au rameur, jambes, puis buste, puis bras. */
  phases?: Partial<Record<Part, readonly [number, number]>>;
  /** Mouvement continu (pédaler, marcher) : l’avancement suit le temps, sans arrêt ; membres opposés décalés de `far`. */
  cycle?: { far: number; /** Cycles par boucle de 4 s (foulées, tours de pédalier). */ per: number };
  /** Un seul côté travaille : l’autre jambe ou l’autre bras n’est pas dessiné (de face : il reste immobile). */
  single?: 'leg' | 'arm';
  /** Jambe d’appui (fente, fessiers) : pied fixe au sol, le genou suit le bassin. */
  stance?: { ankle: Pt; foot: number; bend: 1 | -1 };
  /** Cadre élargi pour les exercices debout (1,25 : un quart plus grand). */
  zoom?: number;
  /** Vue de face (écarter, élévations latérales) : membres des deux côtés, en miroir autour du bassin. */
  front?: boolean;
  /** Longueurs propres à l’exercice (cuisse vue de face, raccourcie). */
  limbs?: Partial<Record<'thigh' | 'shin' | 'upperArm' | 'forearm' | 'torso', number>>;
}

/** Longueurs des segments, en unités du dessin (cadre 240 × 180). */
export const BODY = { torso: 52, neck: 17, head: 9, thigh: 44, shin: 42, foot: 15, upperArm: 30, forearm: 28 } as const;
/** Tempo : effort 1,2 s, retour freiné 2 s, deux courts temps d’arrêt ; boucle de 4 s. */
export const TEMPO = { effort: 1.2, back: 2.0, holdB: 0.3, holdA: 0.5 } as const;
export const LOOP_SECONDS = TEMPO.effort + TEMPO.back + TEMPO.holdA + TEMPO.holdB;

const rad = (d: number) => (d * Math.PI) / 180;
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;

/** Point du trajet à l’avancement t (0 = départ, 1 = arrivée). */
export function pathAt(p: Path, t: number): Pt {
  if (p.orbit) {
    const a = rad(p.orbit.start + 360 * t);
    return [p.orbit.c[0] + p.orbit.rx * Math.cos(a), p.orbit.c[1] + p.orbit.ry * Math.sin(a)];
  }
  if (!p.pivot) return [lerp(p.from[0], p.to[0], t), lerp(p.from[1], p.to[1], t)];
  const [cx, cy] = p.pivot;
  const r0 = dist(p.pivot, p.from), r1 = dist(p.pivot, p.to);
  const a0 = Math.atan2(p.from[1] - cy, p.from[0] - cx), a1 = Math.atan2(p.to[1] - cy, p.to[0] - cx);
  // Le petit arc, jamais le tour par l’autre côté.
  let da = a1 - a0;
  if (da > Math.PI) da -= 2 * Math.PI;
  if (da < -Math.PI) da += 2 * Math.PI;
  const a = a0 + da * t, r = lerp(r0, r1, t);
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

export interface Pose {
  /** Hanche et épaule du côté dessiné (de face : côté droit de l’image) ; pelvis et chest : milieux du bassin et des épaules. */
  hip: Pt; shoulder: Pt; pelvis: Pt; chest: Pt; head: Pt; knee: Pt; ankle: Pt; toe: Pt; elbow: Pt; hand: Pt;
  /** La cible des mains est atteinte (sinon le geste est impossible). */ reach: number;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Avancement d’une partie du corps dans sa fenêtre (rameur : jambes, puis buste, puis bras). */
function partAt(s: MotionSpec, part: Part, t: number): number {
  const w = s.phases?.[part];
  return w ? ease(clamp01((t - w[0]) / (w[1] - w[0]))) : t;
}
const isPath = (h: Pt | Path): h is Path => !Array.isArray(h);
/** Demi-largeurs du bassin et des épaules en vue de face. */
const HALF = { hip: 7, shoulder: 13 } as const;

/** Position du corps à l’avancement t entre le départ et l’arrivée. */
export function poseAt(s: MotionSpec, t: number): Pose {
  const L = { ...BODY, ...s.limbs };
  const pelvis = isPath(s.hip) ? pathAt(s.hip, partAt(s, 'hip', t)) : s.hip;
  const lean = rad(lerp(s.torso[0], s.torso[1], partAt(s, 'torso', t)));
  const dir: Pt = [Math.sin(lean), -Math.cos(lean)];
  const chest: Pt = [pelvis[0] + L.torso * dir[0], pelvis[1] + L.torso * dir[1]];
  const head: Pt = [chest[0] + L.neck * dir[0], chest[1] + L.neck * dir[1]];
  const hip: Pt = s.front ? [pelvis[0] + HALF.hip, pelvis[1]] : pelvis;
  const shoulder: Pt = s.front ? [chest[0] + HALF.shoulder, chest[1]] : chest;
  const ankle = pathAt(s.feet.path, partAt(s, 'feet', t));
  const knee = ik(hip, ankle, L.thigh, L.shin, s.bend.knee);
  const fa = rad(typeof s.feet.foot === 'number' ? s.feet.foot : lerp(s.feet.foot[0], s.feet.foot[1], partAt(s, 'feet', t)));
  const toe: Pt = [ankle[0] + L.foot * Math.cos(fa), ankle[1] - L.foot * Math.sin(fa)];
  const rel = pathAt(s.hands.path, partAt(s, 'hands', t));
  const target: Pt = s.hands.relative ? [chest[0] + rel[0], chest[1] + rel[1]] : rel;
  const elbow = ik(shoulder, target, L.upperArm, L.forearm, s.bend.elbow);
  const fd = dist(elbow, target) || 1;
  const hand: Pt = [elbow[0] + ((target[0] - elbow[0]) / fd) * L.forearm, elbow[1] + ((target[1] - elbow[1]) / fd) * L.forearm];
  return { hip, shoulder, pelvis, chest, head, knee, ankle, toe, elbow, hand, reach: dist(hand, target) };
}

/** Image miroir d’une position autour du milieu du bassin (vue de face, côté gauche). */
export function mirrorPose(p: Pose): Pose {
  const m = (q: Pt): Pt => [2 * p.pelvis[0] - q[0], q[1]];
  return { ...p, hip: m(p.hip), shoulder: m(p.shoulder), knee: m(p.knee), ankle: m(p.ankle), toe: m(p.toe), elbow: m(p.elbow), hand: m(p.hand) };
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
export function progressAt(s: Pick<MotionSpec, 'effort' | 'cycle'>, u: number): number {
  if (s.cycle) return (u * s.cycle.per) % 1;
  const go = s.effort === 'toB' ? TEMPO.effort : TEMPO.back;
  const back = s.effort === 'toB' ? TEMPO.back : TEMPO.effort;
  const t = u * LOOP_SECONDS;
  if (t < TEMPO.holdA) return 0;
  if (t < TEMPO.holdA + go) return ease((t - TEMPO.holdA) / go);
  if (t < TEMPO.holdA + go + TEMPO.holdB) return 1;
  return 1 - ease(Math.min(1, (t - TEMPO.holdA - go - TEMPO.holdB) / back));
}

const FRAMES = 96;
/** Hauteur dont montent les plaques choisies, en haut de l’effort. */
const STACK_LIFT = 16;
const f1 = (n: number) => String(Math.round(n * 10) / 10);

/** Gélule de a vers b, de rayon ra à la racine et rb au bout : un segment de membre galbé. Même suite de commandes à chaque image (animable). */
export function capsulePath(a: Pt, b: Pt, ra: number, rb: number): string {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
  const p = (c: Pt, r: number, k: 1 | -1) => `${f1(c[0] + k * nx * r)} ${f1(c[1] + k * ny * r)}`;
  return `M${p(a, ra, 1)}L${p(b, rb, 1)}A${rb} ${rb} 0 0 0 ${p(b, rb, -1)}L${p(a, ra, -1)}A${ra} ${ra} 0 0 0 ${p(a, ra, 1)}Z`;
}

const COLORS = {
  body: 'var(--ds-ink, #0E1116)',
  frame: 'var(--ds-rule-strong, #C3C9D2)',
  pad: 'var(--ds-ink-2, #5A6372)',
  stack: 'var(--ds-surface-3, #E3E6EB)',
  move: 'var(--ds-signal, #FF5A1F)',
  cable: 'var(--ds-ink-2, #5A6372)',
} as const;

/** Options de rendu : `still` dessine l’image d’aperçu (position de départ, sans animation). */
export interface MotionRender { still?: boolean; /** Image fixe à cet avancement (0 = départ, 1 = arrivée). */ at?: number; title?: string; width?: number }

/** SVG animé (SMIL, sans script) d’un exercice ; lisible au téléphone, quelques kilo-octets. */
export function motionSvg(s: MotionSpec, o: MotionRender = {}): string {
  const us = Array.from({ length: FRAMES + 1 }, (_, i) => i / FRAMES);
  const ts = o.at !== undefined ? [o.at] : o.still ? [0] : us.map((u) => progressAt(s, u));
  const poses = ts.map((t) => poseAt(s, t));
  // Les plaques montent pendant l’effort (vers l’arrivée, ou vers le départ pour la presse).
  const lifts = ts.map((t) => STACK_LIFT * (s.effort === 'toB' ? t : 1 - t));
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
  const z = s.zoom ?? 1, vw = 240 * z, vh = 180 * z, vx = -(vw - 240) / 2, vy = 180 - vh;
  parts.push(`<line x1="${f1(vx + 8)}" y1="166" x2="${f1(vx + vw - 8)}" y2="166" stroke="${COLORS.frame}" stroke-width="2" stroke-linecap="round"/>`);
  const drawShape = (m: Shape) => {
    const mx = (q: Pt, i: number): Pt => [2 * poses[i]!.pelvis[0] - q[0], q[1]];
    if (m.k === 'cable') {
      const off = m.offset ?? [0, 0];
      parts.push(line(() => m.from, (p) => add(p[m.to], off), COLORS[m.tone ?? 'cable'], m.w ?? 1.2, m.tone === 'frame' ? 'round' : 'butt'));
      if (m.both && s.front) parts.push(line((_, i) => mx(m.from, i), (p, i) => mx(add(p[m.to], off), i), COLORS[m.tone ?? 'cable'], m.w ?? 1.2, m.tone === 'frame' ? 'round' : 'butt'));
    } else if (m.k === 'line') {
      const tone = m.tone ?? 'frame';
      parts.push(line((_, i) => at(m.on, m.a, i), (_, i) => at(m.on, m.b, i), COLORS[tone === 'cable' ? 'cable' : tone], m.w ?? 4));
      if (m.both && s.front) parts.push(line((_, i) => mx(at(m.on, m.a, i), i), (_, i) => mx(at(m.on, m.b, i), i), COLORS[tone === 'cable' ? 'cable' : tone], m.w ?? 4));
    } else if (m.k === 'rect' && m.tone === 'stack') {
      // Pile de poids : un cadre, des plaques ; les plaques choisies montent avec l’effort.
      const [x, y] = m.at, [w, h] = m.size;
      const plate = (py: number) => `<rect x="${x + 2}" y="${f1(py)}" width="${w - 4}" height="7" rx="1.5" fill="${COLORS.frame}"/>`;
      const plates = Array.from({ length: Math.floor((h - 8) / 9) }, (_, k) => y + h - 9 - k * 9);
      const moving = plates.slice(0, 4);
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${COLORS.stack}"/>`);
      parts.push(plates.slice(4).map(plate).join(''));
      parts.push(`<g transform="translate(0 ${f1(-lifts[0]!)})">${moving.map(plate).join('')}<line x1="${x + w / 2}" y1="${f1(moving.at(-1)! - 1)}" x2="${x + w / 2}" y2="${y - 4}" stroke="${COLORS.cable}" stroke-width="1.4"/>`
        + (!o.still && lifts.some((v) => Math.abs(v - lifts[0]!) > 0.05) ? `<animateTransform attributeName="transform" type="translate" dur="${LOOP_SECONDS}s" repeatCount="indefinite" calcMode="linear" keyTimes="${keyTimes}" values="${lifts.map((v) => `0 ${f1(-v)}`).join(';')}"/>` : '')
        + '</g>');
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
  // Silhouette en volume : chaque segment est une gélule galbée (plus large à la racine) ; jambe et bras du côté
  // opposé en transparence, légèrement décalés, pour la profondeur.
  const B = COLORS.body;
  const animD = (ds: string[]) => (o.still || ds.every((d) => d === ds[0]) ? ''
    : `<animate attributeName="d" dur="${LOOP_SECONDS}s" repeatCount="indefinite" calcMode="linear" keyTimes="${keyTimes}" values="${ds.join(';')}"/>`);
  const capsule = (ps: Pose[], a: (p: Pose) => Pt, b: (p: Pose) => Pt, ra: number, rb: number) => {
    const ds = ps.map((p) => capsulePath(a(p), b(p), ra, rb));
    return `<path d="${ds[0]}" fill="${B}">${animD(ds)}</path>`;
  };
  const dot = (ps: Pose[], at: (p: Pose) => Pt, r: number) => {
    const ds = ps.map((p) => capsulePath(at(p), [at(p)[0] + 0.01, at(p)[1]], r, r));
    return `<path d="${ds[0]}" fill="${B}">${animD(ds)}</path>`;
  };
  const leg = (ps: Pose[]) => capsule(ps, (p) => p.hip, (p) => p.knee, 7.5, 5.2) + capsule(ps, (p) => p.knee, (p) => p.ankle, 5.2, 3.6)
    + capsule(ps, (p) => p.ankle, (p) => p.toe, 3.6, 2.6);
  const arm = (ps: Pose[]) => capsule(ps, (p) => p.shoulder, (p) => p.elbow, 5, 3.8) + capsule(ps, (p) => p.elbow, (p) => p.hand, 3.6, 2.8) + dot(ps, (p) => p.hand, 3.6);
  // Jambe d’appui : pied fixe, le genou suit le bassin.
  const planted = (ps: Pose[]): Pose[] => (s.stance ? ps.map((p) => {
    const st = s.stance!;
    const fa = rad(st.foot);
    return { ...p, ankle: st.ankle, knee: ik(p.hip, st.ankle, BODY.thigh, BODY.shin, st.bend), toe: [st.ankle[0] + BODY.foot * Math.cos(fa), st.ankle[1] - BODY.foot * Math.sin(fa)] as Pt };
  }) : ps);
  if (s.front) {
    // De face : les deux côtés, en miroir, à pleine couleur ; le côté qui ne travaille pas reste immobile.
    const left = poses.map(mirrorPose);
    parts.push(leg(poses), leg(s.single === 'leg' ? [left[0]!] : left));
    parts.push(capsule(poses, (p) => p.pelvis, (p) => p.chest, 12, 15));
  } else {
    // De profil : le côté opposé en transparence, décalé ; en mouvement continu, en opposition de phase.
    const far = s.cycle && !o.still ? ts.map((t) => poseAt(s, (t + s.cycle!.far) % 1)) : s.cycle ? [poseAt(s, s.cycle.far)] : poses;
    const farLeg = s.stance ? leg(planted(poses)) : s.single === 'leg' ? '' : leg(far);
    parts.push(`<g opacity="0.32" transform="translate(4 -2.5)">${farLeg}${s.single === 'arm' ? '' : arm(far)}</g>`);
    parts.push(leg(poses));
    parts.push(capsule(poses, (p) => p.pelvis, (p) => p.chest, 9, 10));
  }
  parts.push(capsule(poses, (p) => p.chest, (p) => p.head, 3.6, 3.6));
  parts.push(`<circle cx="${f1(first.head[0])}" cy="${f1(first.head[1])}" r="${BODY.head}" fill="${B}">`
    + anim('cx', series((p) => p.head[0])) + anim('cy', series((p) => p.head[1])) + '</circle>');
  parts.push(arm(poses));
  if (s.front) parts.push(arm(s.single === 'arm' ? [mirrorPose(poses[0]!)] : poses.map(mirrorPose)));
  for (const m of s.machine) if ('on' in m && m.on) drawShape(m);

  const title = o.title ? `<title>${o.title.replace(/[<&>"]/g, '')}</title>` : '';
  const w = o.width ? ` width="${o.width}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f1(vx)} ${f1(vy)} ${f1(vw)} ${f1(vh)}"${w} role="img"${o.title ? ` aria-label="${o.title.replace(/[<&>"]/g, '')}"` : ''}>${title}${parts.join('')}</svg>`;
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
    { k: 'line', a: [187, 8], b: [187, 42], w: 1.4, tone: 'cable' },
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
  ...Object.fromEntries(MORE_MOTIONS.map((m) => [m.key, m])),
};

/**
 * Relecture des animations par le fondateur : aucune n’est montrée à un élève sans y figurer (D-178, comme les vidéos
 * de base de D-099). On n’y ajoute une clé que sur sa validation explicite, avec la date.
 */
/** Validées par le fondateur le 26 novembre 2026 (« Oui, tout validé ») : liste figée, une animation ajoutée ensuite reste à relire. */
const VALIDATED_2026_11_26 = [
  'presse-a-cuisses', 'tirage-vertical', 'developpe-machine', 'presse-pieds-hauts', 'presse-une-jambe', 'mollets-presse', 'leg-extension',
  'leg-extension-une-jambe', 'leg-curl-assis', 'leg-curl-allonge-ex', 'abduction-machine', 'adduction-machine', 'fessier-machine',
  'mollets-machine-ex', 'developpe-machine-un-bras', 'developpe-incline-machine', 'butterfly', 'oiseau-machine',
  'developpe-epaules-machine', 'elevations-laterales-machine-ex', 'tirage-vertical-serre', 'tirage-vertical-supination', 'rowing-assis',
  'rowing-assis-large', 'curl-machine', 'triceps-machine-ex', 'crunch-machine', 'extension-lombaires-machine', 'extension-lombaires-banc',
  'traction-assistee', 'dips-assistes', 'hack-squat-ex', 'ecarte-poulies-haut-bas', 'ecarte-poulies-bas-haut', 'extension-triceps-corde',
  'extension-triceps-nuque', 'curl-poulie-basse', 'elevation-laterale-poulie', 'face-pull', 'tirage-bras-tendus', 'rowing-poulie-un-bras',
  'bucheron', 'pallof', 'kickback-fessier-poulie', 'abduction-poulie', 'crunch-poulie', 'pull-through', 'oiseau-poulies', 'squat-smith',
  'fente-smith', 'developpe-couche-smith', 'developpe-incline-smith', 'developpe-militaire-smith', 'rowing-smith', 'hip-thrust-smith',
  'souleve-roumain-smith', 'mollets-smith', 'rowing-inverse-smith', 'pompes-inclinees-smith', 'marche-inclinee', 'course-tapis',
  'velo-droit-ex', 'velo-allonge-ex', 'rameur-ex', 'velo-elliptique-ex', 'escalier-ex', 'velo-air-ex', 'skierg-ex',
] as const;

export const MOTION_REVIEWS: Readonly<Record<string, { validatedBy: string; validatedOn: string }>> = Object.fromEntries(
  VALIDATED_2026_11_26.map((k) => [k, { validatedBy: 'fondateur', validatedOn: '2026-11-26' }]),
);

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
