import { z } from 'zod';
import type { Block, Step } from './structure';

/**
 * D-096 · Bibliothèque d’exercices de musculation. Chaque exercice a un nom, des consignes, un groupe musculaire,
 * du matériel et, si le coach le souhaite, une vidéo : un lien (YouTube, Vimeo, Drive…) ou un court fichier
 * qu’il a filmé (gardé en privé, lu par les seuls membres de son espace).
 */

export const MUSCLES = ['legs', 'push', 'pull', 'core', 'full', 'mobility', 'cardio', 'other'] as const;
export type Muscle = (typeof MUSCLES)[number];
export const MUSCLE_LABELS: Record<Muscle, string> = {
  legs: 'Jambes et fessiers', push: 'Poussée (pectoraux, épaules, triceps)', pull: 'Tirage (dos, biceps)', core: 'Gainage et abdominaux',
  full: 'Corps entier', mobility: 'Mobilité et étirements', cardio: 'Cardio', other: 'Autre',
};
export const MUSCLE_SHORT: Record<Muscle, string> = {
  legs: 'Jambes', push: 'Poussée', pull: 'Tirage', core: 'Gainage', full: 'Corps entier', mobility: 'Mobilité', cardio: 'Cardio', other: 'Autre',
};

export const EXERCISE_EQUIPMENT = ['bodyweight', 'dumbbells', 'kettlebell', 'barbell', 'bands', 'pullup_bar', 'bench', 'machine', 'mat'] as const;
export type ExerciseEquipment = (typeof EXERCISE_EQUIPMENT)[number];
export const EXERCISE_EQUIPMENT_LABELS: Record<ExerciseEquipment, string> = {
  bodyweight: 'Poids du corps', dumbbells: 'Haltères', kettlebell: 'Kettlebell', barbell: 'Barre', bands: 'Élastiques',
  pullup_bar: 'Barre de traction', bench: 'Banc', machine: 'Machine de salle', mat: 'Tapis de sol',
};

/** Vidéo d’un exercice : 25 Mio au plus, 2 minutes au plus (contrôlé côté navigateur). */
export const EXERCISE_CLIP_MAX_BYTES = 25 * 1024 * 1024;
export const EXERCISE_CLIP_MAX_SECONDS = 120;
export const EXERCISE_CLIP_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;

const text = (max: number) => z.string().trim().max(max, { message: `${max} caractères au plus` }).nullish().transform((v) => (v ? v : null));

export const exerciseInputSchema = z.object({
  name: z.string().trim().min(1, { message: 'Nom requis' }).max(80, { message: '80 caractères au plus' }),
  instructions: text(1500),
  muscle: z.enum(MUSCLES).default('other'),
  equipment: z.array(z.enum(EXERCISE_EQUIPMENT)).max(EXERCISE_EQUIPMENT.length).default([]).transform((a) => [...new Set(a)]),
  videoUrl: z.string().trim().max(500).nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^https:\/\/[^\s]+$/i.test(v), { message: 'Lien de vidéo : adresse commençant par https://' }),
  useBaseVideo: z.boolean().default(true),
}).strict();
export type ExerciseInput = z.output<typeof exerciseInputSchema>;

export interface Exercise extends ExerciseInput {
  id: string;
  revision: number;
  /** Vidéo filmée par le coach, lue par la route privée de l’espace. */
  clipId: string | null;
  starter: boolean;
  archived: boolean;
  /** D-099 : clé de l’exercice de départ d’origine (stable même si le coach le renomme). */
  starterKey: string | null;
  /** D-099 : montrer la vidéo de base CoachOS quand le coach n’a pas mis la sienne. */
  useBaseVideo: boolean;
}

/**
 * Lecture d’un lien de vidéo : YouTube et Vimeo s’affichent dans la page (YouTube sans cookie publicitaire) ;
 * les autres liens s’ouvrent dans un nouvel onglet.
 */
export function videoEmbed(url: string | null | undefined): { kind: 'youtube' | 'vimeo' | 'file' | 'link'; src: string } | null {
  if (!url) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1] ?? null;
  }
  if (id && /^[\w-]{6,20}$/.test(id)) return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1` };
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const v = u.pathname.match(/(\d{6,12})/)?.[1];
    if (v) return { kind: 'vimeo', src: `https://player.vimeo.com/video/${v}` };
  }
  // Fichier vidéo direct (hébergement de CoachOS ou du coach) : lu dans la page.
  if (/\.(mp4|m4v|webm|mov)$/i.test(u.pathname)) return { kind: 'file', src: u.toString() };
  return { kind: 'link', src: u.toString() };
}

/** Type de fichier vidéo reconnu par ses premiers octets (jamais par l’extension annoncée). */
export function detectVideoType(bytes: Uint8Array): (typeof EXERCISE_CLIP_TYPES)[number] | null {
  if (bytes.length < 12) return null;
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(4, 8) === 'ftyp') return ascii(8, 10) === 'qt' ? 'video/quicktime' : 'video/mp4';
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'video/webm';
  return null;
}

type Starter = [name: string, muscle: Muscle, equipment: ExerciseEquipment[], instructions: string];

/** Clé stable d’un exercice de départ : « Squat goblet » → « squat-goblet ». */
export function starterKey(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ---------- Vidéos de base CoachOS (D-099) ----------

export const BASE_VIDEO_SOURCES = ['founder', 'ai', 'founder_ai'] as const;
export type BaseVideoSource = (typeof BASE_VIDEO_SOURCES)[number];
/** Ce que l’élève lit sous la vidéo : il sait toujours qui il regarde. */
export const BASE_VIDEO_SOURCE_LABELS: Record<BaseVideoSource, string> = {
  founder: 'Vidéo CoachOS',
  ai: 'Vidéo CoachOS générée par IA',
  founder_ai: 'Vidéo CoachOS, générée par IA à partir de vrais mouvements',
};
export interface BaseVideo { url: string; source: BaseVideoSource; validatedBy: string; validatedOn: string }

/**
 * Catalogue des vidéos de base, par clé d’exercice de départ. N’y entre qu’une vidéo dont le geste a été validé
 * par le fondateur (`validatedBy`, `validatedOn`). Vide tant que les vidéos ne sont pas produites.
 */
export const BASE_VIDEOS: Readonly<Record<string, BaseVideo>> = {};

/** Vidéo montrée à l’élève : celle du coach d’abord, sinon la vidéo de base si le coach l’accepte. */
export function shownVideo(
  e: Pick<Exercise, 'videoUrl' | 'clipId' | 'starterKey' | 'useBaseVideo'>,
  catalog: Readonly<Record<string, BaseVideo>> = BASE_VIDEOS,
): { from: 'coach_clip' } | { from: 'coach_link'; url: string } | { from: 'base'; url: string; source: BaseVideoSource } | null {
  if (e.clipId) return { from: 'coach_clip' };
  if (e.videoUrl) return { from: 'coach_link', url: e.videoUrl };
  const base = e.useBaseVideo && e.starterKey ? catalog[e.starterKey] : undefined;
  return base ? { from: 'base', url: base.url, source: base.source } : null;
}

/** Exercices de départ (D-096) : le coach les complète, ajoute ses vidéos ou les retire. Consignes générales, sans avis médical. */
export const STARTER_EXERCISES: Starter[] = [
  ['Squat', 'legs', ['bodyweight'], 'Pieds largeur d’épaules, descends les fesses en arrière comme pour t’asseoir, dos droit, genoux dans l’axe des pieds. Remonte en poussant dans les talons.'],
  ['Squat goblet', 'legs', ['dumbbells', 'kettlebell'], 'Tiens la charge contre la poitrine, coudes vers le bas. Descends en gardant le buste droit, puis remonte en poussant dans les talons.'],
  ['Fentes avant', 'legs', ['bodyweight', 'dumbbells'], 'Grand pas en avant, descends jusqu’à ce que les deux genoux forment un angle droit, genou avant au-dessus de la cheville. Reviens en poussant sur la jambe avant.'],
  ['Fentes arrière', 'legs', ['bodyweight', 'dumbbells'], 'Recule une jambe et descends le genou arrière vers le sol, buste droit. Plus doux pour les genoux que la fente avant.'],
  ['Fente bulgare', 'legs', ['bench', 'dumbbells'], 'Pied arrière posé sur un banc, descends sur la jambe avant en gardant le buste droit. Toutes les répétitions d’un côté, puis l’autre.'],
  ['Pont fessier', 'legs', ['mat', 'bodyweight'], 'Allongé sur le dos, pieds à plat. Monte le bassin en serrant les fessiers jusqu’à aligner épaules, hanches et genoux. Redescends lentement.'],
  ['Hip thrust', 'legs', ['bench', 'barbell', 'dumbbells'], 'Haut du dos appuyé sur un banc, charge sur les hanches. Pousse le bassin vers le haut en serrant les fessiers, menton rentré.'],
  ['Soulevé de terre jambes tendues', 'legs', ['dumbbells', 'barbell', 'kettlebell'], 'Genoux légèrement fléchis, descends la charge le long des jambes en poussant les fesses en arrière, dos plat. Remonte en serrant les fessiers.'],
  ['Montées de mollets', 'legs', ['bodyweight', 'dumbbells'], 'Sur une marche ou au sol, monte sur la pointe des pieds, marque une pause en haut, redescends lentement.'],
  ['Step-up sur banc', 'legs', ['bench', 'dumbbells'], 'Monte sur le banc en poussant sur la jambe posée dessus, sans t’aider de la jambe du bas. Redescends en contrôlant.'],
  ['Pompes', 'push', ['bodyweight'], 'Mains un peu plus larges que les épaules, corps gainé de la tête aux pieds. Descends la poitrine près du sol, remonte en poussant. Version facile : genoux au sol ou mains sur un banc.'],
  ['Développé couché haltères', 'push', ['dumbbells', 'bench'], 'Allongé sur le banc, pieds au sol. Pousse les haltères au-dessus de la poitrine, redescends en contrôlant jusqu’au niveau des pectoraux.'],
  ['Développé militaire', 'push', ['dumbbells', 'barbell'], 'Debout, gainé, pousse la charge au-dessus de la tête sans cambrer le bas du dos. Redescends à hauteur des épaules.'],
  ['Dips sur banc', 'push', ['bench'], 'Mains sur le bord du banc, fesses dans le vide. Fléchis les coudes vers l’arrière, puis remonte en poussant.'],
  ['Élévations latérales', 'push', ['dumbbells', 'bands'], 'Bras légèrement fléchis, monte les haltères sur les côtés jusqu’à hauteur d’épaules, sans élan. Redescends lentement.'],
  ['Tractions', 'pull', ['pullup_bar'], 'Mains en pronation, largeur d’épaules. Tire la poitrine vers la barre en serrant les omoplates, redescends bras tendus. Version facile : avec élastique.'],
  ['Rowing haltère un bras', 'pull', ['dumbbells', 'bench'], 'Main et genou en appui sur le banc, dos plat. Tire l’haltère vers la hanche, coude près du corps, puis redescends.'],
  ['Rowing élastique', 'pull', ['bands'], 'Élastique accroché devant toi. Tire les mains vers le ventre en serrant les omoplates, coudes près du corps.'],
  ['Tirage face pull', 'pull', ['bands'], 'Élastique à hauteur du visage. Tire vers le front en écartant les mains, coudes hauts. Bon pour la posture.'],
  ['Curl biceps', 'pull', ['dumbbells', 'bands'], 'Coudes collés au corps, monte la charge en pliant les bras, sans balancer le buste. Redescends lentement.'],
  ['Planche', 'core', ['mat', 'bodyweight'], 'Sur les avant-bras et les pointes de pieds, corps aligné, ventre et fessiers serrés. Respire calmement, sans laisser tomber les hanches.'],
  ['Planche latérale', 'core', ['mat', 'bodyweight'], 'Sur un avant-bras, corps aligné de côté, hanches hautes. Tiens, puis change de côté.'],
  ['Dead bug', 'core', ['mat', 'bodyweight'], 'Sur le dos, bras vers le plafond, genoux à 90°. Allonge un bras et la jambe opposée sans décoller le bas du dos, puis alterne.'],
  ['Bird dog', 'core', ['mat', 'bodyweight'], 'À quatre pattes, tends un bras et la jambe opposée sans bouger le bassin. Reviens et alterne.'],
  ['Mountain climbers', 'core', ['bodyweight'], 'En position de pompe, ramène les genoux vers la poitrine l’un après l’autre, rapidement, bassin stable.'],
  ['Crunch', 'core', ['mat', 'bodyweight'], 'Sur le dos, genoux pliés. Enroule le haut du dos en soufflant, sans tirer sur la nuque.'],
  ['Kettlebell swing', 'full', ['kettlebell'], 'Pieds écartés, pousse les fesses en arrière puis lance la kettlebell à hauteur de poitrine par un coup de hanches. Les bras guident, ce sont les fessiers qui travaillent.'],
  ['Burpees', 'full', ['bodyweight'], 'Accroupi, mains au sol, saute en planche, ramène les pieds, puis saute bras en l’air. Version facile : sans saut ni pompe.'],
  ['Thruster', 'full', ['dumbbells'], 'Squat avec les haltères aux épaules, puis pousse-les au-dessus de la tête en remontant, d’un seul mouvement.'],
  ['Corde à sauter', 'cardio', ['bodyweight'], 'Petits sauts sur l’avant des pieds, poignets qui font tourner la corde, épaules relâchées.'],
  ['Jumping jacks', 'cardio', ['bodyweight'], 'Saute en écartant bras et jambes, puis reviens. Rythme régulier.'],
  ['Mobilité des hanches 90/90', 'mobility', ['mat'], 'Assis, une jambe devant et une sur le côté, genoux à 90°. Bascule doucement d’un côté à l’autre, buste droit.'],
  ['Étirement des fléchisseurs de hanche', 'mobility', ['mat'], 'Un genou au sol, avance le bassin en serrant le fessier de la jambe arrière. 30 secondes par côté, sans à-coups.'],
  ['Chat-vache', 'mobility', ['mat'], 'À quatre pattes, arrondis le dos en soufflant, puis creuse-le en inspirant. Mouvement lent.'],
];

/** Exercices de la bibliothèque nommés par une séance (sans doublon), pour montrer consignes et vidéos. */
export function exerciseIdsOf(blocks: Block[]): string[] {
  const out = new Set<string>();
  const walk = (b: Block) => { if (b.type === 'repeat') b.steps.forEach(walk); else if (b.exercise?.id) out.add(b.exercise.id); };
  blocks.forEach(walk);
  return [...out];
}

// ---------- Suivre la séance pas à pas (D-096, M3) ----------

/** Position dans une répétition : « série » (un exercice répété) ou « tour » (circuit de plusieurs exercices). */
export interface SetPos { k: number; n: number; kind: 'série' | 'tour' }

/** Une étape à faire, dans l’ordre réel : les répétitions sont dépliées (« série 2 sur 4 »). */
export interface FollowStep {
  index: number;
  step: Step;
  /** De la répétition la plus extérieure à la plus intérieure. */
  sets: SetPos[];
}

const workCount = (list: Block[]): number => list.reduce((n, b) => n + (b.type === 'repeat' ? workCount(b.steps) : b.phase === 'work' ? 1 : 0), 0);

/** Séance dépliée pour le mode « Suivre » (400 étapes au plus). */
export function followSequence(blocks: Block[]): FollowStep[] {
  const out: FollowStep[] = [];
  const walk = (list: Block[], sets: SetPos[]) => {
    for (const b of list) {
      if (out.length >= 400) return;
      if (b.type === 'repeat') {
        // Un circuit (plusieurs exercices) ou un bloc de séries se compte en tours ; un exercice répété, en séries.
        const kind = workCount(b.steps) > 1 || b.steps.some((x) => x.type === 'repeat') ? 'tour' : 'série';
        for (let k = 1; k <= b.times; k++) walk(b.steps, [...sets, { k, n: b.times, kind }]);
      } else out.push({ index: out.length, step: b, sets });
    }
  };
  walk(blocks, []);
  return out;
}

/** « Série 2 sur 4 », « Tour 1 sur 3 · série 2 sur 5 ». */
export function setLabel(sets: SetPos[]): string | null {
  if (!sets.length) return null;
  const txt = sets.map((p) => `${p.kind} ${p.k} sur ${p.n}`).join(' · ');
  return txt[0]!.toUpperCase() + txt.slice(1);
}
