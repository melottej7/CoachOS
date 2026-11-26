import { starterKey, STARTER_EXERCISES, type Muscle } from './exercises';
import type { Machine } from './structure';

/**
 * D-179 · Bibliothèque des machines de salle : chaque machine, tous les exercices qu’elle permet, et pour chacun
 * les muscles, le niveau, les réglages, trois consignes, l’erreur la plus fréquente et une alternative si la machine
 * est prise. Rangée par type de machine, pas par enseigne : « Disponible chez Basic-Fit » n’est qu’une étiquette
 * (d’autres coachs ont des élèves dans d’autres salles). Consignes générales, sans avis médical.
 */

export const MACHINE_KINDS = ['guided', 'cable', 'smith', 'plate', 'cardio'] as const;
export type MachineKind = (typeof MACHINE_KINDS)[number];
export const MACHINE_KIND_LABELS: Record<MachineKind, string> = {
  guided: 'Musculation guidée (charge à broche)', cable: 'Poulies', smith: 'Smith machine (barre guidée)',
  plate: 'Machines à disques', cardio: 'Cardio',
};

/**
 * Présence dans une chaîne de salles. « sure » : nommée par la chaîne elle-même ; « likely » : de série dans les gammes
 * de la marque équipementière, à confirmer ; « verify » : selon le club, à vérifier sur place.
 */
export type Availability = 'sure' | 'likely' | 'verify';
export const AVAILABILITY_LABELS: Record<Availability, string> = { sure: 'Sûr', likely: 'Très probable', verify: 'Selon le club' };
export const GYM_CHAINS = { 'basic-fit-be': 'Basic-Fit (Belgique)' } as const;
export type GymChain = keyof typeof GYM_CHAINS;

export interface GymMachine {
  key: string;
  name: string;
  /** Nom anglais habituel des fabricants, souvent celui écrit sur la plaque de la machine (à vérifier sur place). */
  en: string;
  kind: MachineKind;
  /** Étiquettes « Disponible chez … », avec le degré de certitude. */
  chains: Partial<Record<GymChain, Availability>>;
  /** Comment la reconnaître dans la salle (photo, plaque, forme). */
  looks: string;
}

export type MachineLevel = 1 | 2 | 3;
export const MACHINE_LEVEL_LABELS: Record<MachineLevel, string> = { 1: 'Débutant', 2: 'Intermédiaire', 3: 'Confirmé' };

export interface MachineExercise {
  /** Clé stable (aussi `starter_key` de l’exercice une fois ajouté à la bibliothèque d’un coach). */
  key: string;
  name: string;
  machine: string;
  muscle: Muscle;
  /** Muscles travaillés, en clair. */
  muscles: string;
  level: MachineLevel;
  /** Réglages de la machine avant la première série. */
  settings: string;
  cues: [string, string, string];
  /** L’erreur la plus fréquente. */
  mistake: string;
  /** Clé d’un exercice de ce catalogue ou d’un exercice de départ (D-096) à faire si la machine est prise. */
  alternative: string;
  /** D-164 : machine de cardio correspondante dans les séances en paliers. */
  cardio?: Machine;
}

const BF = (a: Availability): GymMachine['chains'] => ({ 'basic-fit-be': a });

export const GYM_MACHINES: GymMachine[] = [
  // Musculation guidée
  { key: 'presse-cuisses', name: 'Presse à cuisses', en: 'Leg Press', kind: 'guided', chains: BF('likely'), looks: 'Siège incliné et grande plateforme pour les pieds, devant toi.' },
  { key: 'leg-extension', name: 'Leg extension', en: 'Leg Extension', kind: 'guided', chains: BF('sure'), looks: 'Siège avec un boudin devant les chevilles, qui monte quand tu tends les jambes.' },
  { key: 'leg-curl-assis', name: 'Leg curl assis', en: 'Seated Leg Curl', kind: 'guided', chains: BF('likely'), looks: 'Siège, jambes tendues sur un boudin, une barre qui bloque le haut des cuisses.' },
  { key: 'leg-curl-allonge', name: 'Leg curl allongé', en: 'Prone Leg Curl', kind: 'guided', chains: BF('verify'), looks: 'Banc sur lequel on s’allonge sur le ventre, boudin derrière les chevilles.' },
  { key: 'abducteurs-adducteurs', name: 'Abducteurs et adducteurs', en: 'Abductor / Adductor', kind: 'guided', chains: BF('likely'), looks: 'Siège avec deux bras rembourrés le long des cuisses ; un levier choisit écarter ou serrer.' },
  { key: 'fessiers-machine', name: 'Machine à fessiers', en: 'Glute', kind: 'guided', chains: BF('verify'), looks: 'Appui pour le buste et une plaque à pousser vers l’arrière avec un pied.' },
  { key: 'mollets-machine', name: 'Machine à mollets', en: 'Calf Raise', kind: 'guided', chains: BF('verify'), looks: 'Épaulières au-dessus des épaules et une marche sous l’avant des pieds.' },
  { key: 'chest-press', name: 'Développé assis (chest press)', en: 'Chest Press', kind: 'guided', chains: BF('likely'), looks: 'Siège avec dossier droit et deux poignées à hauteur de poitrine, poussées vers l’avant.' },
  { key: 'developpe-incline', name: 'Développé incliné à la machine', en: 'Incline Press', kind: 'guided', chains: BF('sure'), looks: 'Comme le développé assis, mais le dossier est incliné et les poignées montent en avant.' },
  { key: 'pec-deck', name: 'Pec deck (butterfly et oiseau)', en: 'Pec Fly / Rear Delt', kind: 'guided', chains: BF('likely'), looks: 'Siège et deux bras pivotants à hauteur d’épaules ; se fait face au dossier ou face à la machine.' },
  { key: 'shoulder-press', name: 'Développé épaules à la machine', en: 'Shoulder Press', kind: 'guided', chains: BF('sure'), looks: 'Siège droit, poignées au-dessus des épaules, poussées vers le haut.' },
  { key: 'elevations-laterales-machine', name: 'Élévations latérales à la machine', en: 'Lateral Raise', kind: 'guided', chains: BF('verify'), looks: 'Siège face à un appui pour la poitrine, deux coussins contre l’extérieur des bras.' },
  { key: 'lat-pulldown', name: 'Tirage vertical (lat pulldown)', en: 'Lat Pulldown', kind: 'guided', chains: BF('likely'), looks: 'Siège, boudins sur les cuisses, longue barre suspendue à un câble au-dessus de la tête.' },
  { key: 'seated-row', name: 'Rowing assis', en: 'Seated Row', kind: 'guided', chains: BF('likely'), looks: 'Siège ou banc, appui pour la poitrine ou les pieds, poignées tirées vers le ventre.' },
  { key: 'biceps-machine', name: 'Curl biceps à la machine', en: 'Biceps Curl', kind: 'guided', chains: BF('likely'), looks: 'Siège, pupitre incliné sous les bras, poignées à ramener vers les épaules.' },
  { key: 'triceps-machine', name: 'Triceps à la machine (dips assis)', en: 'Seated Dip', kind: 'guided', chains: BF('likely'), looks: 'Siège avec deux poignées sur les côtés, poussées vers le bas.' },
  { key: 'abdos-machine', name: 'Machine à abdominaux', en: 'Abdominal Crunch', kind: 'guided', chains: BF('likely'), looks: 'Siège avec des poignées ou des coussins au-dessus des épaules, on s’enroule vers l’avant.' },
  { key: 'lombaires-machine', name: 'Machine à lombaires', en: 'Back Extension', kind: 'guided', chains: BF('verify'), looks: 'Siège avec un dossier haut qui pivote vers l’arrière.' },
  { key: 'banc-lombaires', name: 'Banc à lombaires (45°)', en: 'Hyperextension', kind: 'guided', chains: BF('likely'), looks: 'Banc incliné, chevilles bloquées sous des rouleaux, bassin sur un coussin.' },
  { key: 'traction-dips-assistes', name: 'Tractions et dips assistés', en: 'Assisted Chin / Dip', kind: 'guided', chains: BF('verify'), looks: 'Grande machine avec une plateforme pour les genoux qui aide à monter, barres de traction et de dips.' },
  // Machines à disques
  { key: 'hack-squat', name: 'Hack squat', en: 'Hack Squat', kind: 'plate', chains: BF('verify'), looks: 'Dossier incliné et épaulières qui glissent sur des rails, plateforme au sol, disques sur les côtés.' },
  // Poulies
  { key: 'poulie-double', name: 'Double poulie réglable (vis-à-vis)', en: 'Cable Crossover', kind: 'cable', chains: BF('likely'), looks: 'Deux colonnes avec chacune une poulie qui coulisse de haut en bas ; poignées, corde, barre.' },
  // Smith machine
  { key: 'smith', name: 'Smith machine', en: 'Smith Machine', kind: 'smith', chains: BF('likely'), looks: 'Barre fixée sur deux rails verticaux, crochets pour la bloquer à chaque cran.' },
  // Cardio
  { key: 'tapis', name: 'Tapis de course', en: 'Treadmill', kind: 'cardio', chains: BF('sure'), looks: 'Tapis roulant avec console, vitesse et pente.' },
  { key: 'velo-elliptique', name: 'Vélo elliptique', en: 'Elliptical', kind: 'cardio', chains: BF('sure'), looks: 'Pédales en ovale et grandes poignées mobiles.' },
  { key: 'velo-droit', name: 'Vélo droit', en: 'Upright Bike', kind: 'cardio', chains: BF('likely'), looks: 'Vélo d’appartement classique, selle haute, guidon devant.' },
  { key: 'velo-allonge', name: 'Vélo semi-allongé', en: 'Recumbent Bike', kind: 'cardio', chains: BF('likely'), looks: 'Siège avec dossier, pédales devant toi.' },
  { key: 'rameur', name: 'Rameur', en: 'Rower', kind: 'cardio', chains: BF('likely'), looks: 'Long rail au sol, siège qui glisse, poignée reliée à un volant.' },
  { key: 'escalier', name: 'Escalier (stair climber)', en: 'Stair Climber', kind: 'cardio', chains: BF('verify'), looks: 'Marches qui défilent comme un escalator, rampes de chaque côté.' },
  { key: 'velo-air', name: 'Vélo à air (air bike)', en: 'Air Bike', kind: 'cardio', chains: BF('verify'), looks: 'Grand ventilateur à l’avant, poignées qui bougent avec les pédales.' },
  { key: 'skierg', name: 'SkiErg', en: 'SkiErg', kind: 'cardio', chains: BF('verify'), looks: 'Colonne verticale fixée au mur ou au sol, deux poignées à tirer vers le bas.' },
];

/**
 * Vue Basic-Fit (demande du fondateur, 26 novembre) : numéro de la machine dans le club, tel qu’affiché sur place.
 * Vide tant qu’il n’est pas relevé dans un club (liste à cocher, photos) ; si les numéros changent d’un club à l’autre,
 * ils passeront par club.
 */
export const CHAIN_NUMBERS: Readonly<Partial<Record<GymChain, Readonly<Record<string, string>>>>> = { 'basic-fit-be': {} };

/** « n° 12 · Leg Press », ou le seul nom anglais tant que le numéro n’est pas relevé. */
export function chainLabel(m: Pick<GymMachine, 'key' | 'en'>, chain: GymChain = 'basic-fit-be'): string {
  const n = CHAIN_NUMBERS[chain]?.[m.key];
  return n ? `n° ${n} · ${m.en}` : m.en;
}

const x = (
  key: string, name: string, machine: string, muscle: Muscle, muscles: string, level: MachineLevel,
  settings: string, cues: [string, string, string], mistake: string, alternative: string, cardio?: Machine,
): MachineExercise => ({ key, name, machine, muscle, muscles, level, settings, cues, mistake, alternative, ...(cardio ? { cardio } : {}) });

export const MACHINE_EXERCISES: MachineExercise[] = [
  // ---------- Presse à cuisses ----------
  x('presse-a-cuisses', 'Presse à cuisses', 'presse-cuisses', 'legs', 'Quadriceps, fessiers, ischio-jambiers', 1,
    'Dossier réglé pour qu’en bas les hanches restent collées au siège. Pieds au milieu de la plateforme, largeur de hanches. Déverrouille les sécurités une fois en place, reverrouille à la fin.',
    ['Pieds à plat, genoux dans l’axe des pointes de pieds.', 'Descends jusqu’à environ 90° aux genoux, le bas du dos reste collé.', 'Pousse dans tout le pied, sans verrouiller les genoux en haut.'],
    'Descendre trop bas : le bassin s’enroule et le bas du dos décolle du dossier.', 'squat-smith'),
  x('presse-pieds-hauts', 'Presse à cuisses pieds hauts', 'presse-cuisses', 'legs', 'Fessiers, ischio-jambiers, quadriceps', 2,
    'Pieds en haut de la plateforme, un peu plus larges que les hanches, pointes légèrement ouvertes.',
    ['Talons bien posés pendant tout le mouvement.', 'Descends en gardant les genoux ouverts vers les pointes.', 'Pousse par les talons et serre les fessiers en haut.'],
    'Laisser les talons décoller : la charge repart sur les genoux.', 'hip-thrust-smith'),
  x('presse-une-jambe', 'Presse à cuisses une jambe', 'presse-cuisses', 'legs', 'Quadriceps, fessiers (une jambe après l’autre)', 2,
    'Un pied au centre de la plateforme, l’autre posé au sol ou sur le cadre. Charge réduite de plus de moitié.',
    ['Genou dans l’axe du pied, sans rentrer vers l’intérieur.', 'Amplitude plus courte qu’à deux jambes, bassin immobile.', 'Toutes les répétitions d’un côté, puis l’autre.'],
    'Garder la charge des deux jambes : le bassin tourne pour compenser.', 'fente-smith'),
  x('mollets-presse', 'Mollets à la presse', 'presse-cuisses', 'legs', 'Mollets', 1,
    'Jambes tendues sans verrouiller, seul l’avant des pieds sur le bas de la plateforme. Sécurités verrouillées si la machine le permet.',
    ['Talons dans le vide, descends-les lentement.', 'Pousse sur l’avant des pieds le plus haut possible.', 'Marque une seconde en haut.'],
    'Plier les genoux pour aider : ce sont alors les cuisses qui poussent.', 'mollets-smith'),

  // ---------- Leg extension ----------
  x('leg-extension', 'Leg extension', 'leg-extension', 'legs', 'Quadriceps', 1,
    'Dossier réglé pour que le genou soit en face de l’axe de rotation (repère de couleur). Boudin juste au-dessus des chevilles.',
    ['Fesses au fond du siège, mains sur les poignées.', 'Tends les jambes en une seconde, marque l’arrêt en haut.', 'Redescends en deux ou trois secondes, sans laisser tomber la charge.'],
    'Genou décalé de l’axe de la machine : le mouvement tire sur le genou.', 'presse-a-cuisses'),
  x('leg-extension-une-jambe', 'Leg extension une jambe', 'leg-extension', 'legs', 'Quadriceps (une jambe après l’autre)', 1,
    'Mêmes réglages qu’à deux jambes, environ la moitié de la charge.',
    ['Une seule jambe sous le boudin, l’autre pliée.', 'Monte en contrôlant, sans élan du buste.', 'Compare les deux côtés : même nombre de répétitions.'],
    'Se servir du buste pour lancer la charge.', 'presse-une-jambe'),

  // ---------- Leg curl ----------
  x('leg-curl-assis', 'Leg curl assis', 'leg-curl-assis', 'legs', 'Ischio-jambiers', 1,
    'Genou en face de l’axe. Boudin bas sous les mollets, juste au-dessus des talons. Barre de maintien serrée sur le haut des cuisses.',
    ['Dos collé au dossier.', 'Ramène les talons sous le siège en une à deux secondes.', 'Remonte lentement jusqu’aux jambes presque tendues.'],
    'Barre de cuisses trop lâche : les hanches se soulèvent et le dos travaille.', 'leg-curl-allonge-ex'),
  x('leg-curl-allonge-ex', 'Leg curl allongé', 'leg-curl-allonge', 'legs', 'Ischio-jambiers', 1,
    'Allongé sur le ventre, genoux juste après le bord du banc, boudin sur l’arrière des chevilles.',
    ['Hanches plaquées contre le banc.', 'Ramène les talons vers les fesses sans à-coup.', 'Redescends en trois secondes.'],
    'Décoller les hanches pour finir le mouvement.', 'pont-fessier'),

  // ---------- Abducteurs et adducteurs ----------
  x('abduction-machine', 'Abducteurs à la machine', 'abducteurs-adducteurs', 'legs', 'Moyen fessier, haut des fessiers', 1,
    'Coussins contre l’extérieur des genoux. Levier de départ réglé jambes serrées.',
    ['Dos contre le dossier, mains sur les poignées.', 'Écarte les genoux en contrôlant, marque l’arrêt.', 'Reviens sans laisser les plaques se toucher.'],
    'Écarter d’un coup et laisser revenir sans freiner.', 'abduction-poulie'),
  x('adduction-machine', 'Adducteurs à la machine', 'abducteurs-adducteurs', 'legs', 'Adducteurs (intérieur des cuisses)', 1,
    'Coussins contre l’intérieur des genoux. Écartement de départ confortable, sans étirement forcé.',
    ['Dos contre le dossier.', 'Serre les genoux l’un vers l’autre en une seconde.', 'Ouvre lentement jusqu’à l’écartement de départ.'],
    'Régler un écartement de départ trop grand : on tire sur l’aine.', 'fente-smith'),

  // ---------- Fessiers et mollets ----------
  x('fessier-machine', 'Extension de hanche à la machine', 'fessiers-machine', 'legs', 'Grand fessier, ischio-jambiers', 1,
    'Buste sur l’appui, avant-bras sur les poignées, pied de travail à plat sur la plaque.',
    ['Dos plat, ventre serré.', 'Pousse vers l’arrière avec le talon jusqu’à la hanche tendue.', 'Ne cambre pas en fin de mouvement.'],
    'Monter la jambe trop haut en creusant le bas du dos.', 'kickback-fessier-poulie'),
  x('mollets-machine-ex', 'Mollets debout à la machine', 'mollets-machine', 'legs', 'Mollets', 1,
    'Épaulières à une hauteur où tu es jambes tendues, avant des pieds sur la marche.',
    ['Genoux tendus sans être verrouillés.', 'Descends les talons sous la marche.', 'Monte sur la pointe des pieds et marque l’arrêt.'],
    'Rebondir en bas au lieu de contrôler.', 'mollets-smith'),

  // ---------- Développé assis ----------
  x('developpe-machine', 'Développé assis à la machine', 'chest-press', 'push', 'Pectoraux, avant des épaules, triceps', 1,
    'Siège réglé pour que les poignées soient au milieu de la poitrine. Si la machine a une pédale, appuie dessus pour amener les poignées vers toi sans forcer.',
    ['Omoplates serrées et collées au dossier.', 'Pousse en soufflant jusqu’aux bras presque tendus.', 'Reviens lentement, coudes un peu sous les épaules.'],
    'Siège mal réglé : les épaules montent et s’enroulent vers l’avant.', 'developpe-couche-smith'),
  x('developpe-machine-un-bras', 'Développé assis un bras', 'chest-press', 'push', 'Pectoraux, épaules, triceps, gainage', 2,
    'Mêmes réglages, une seule poignée, la main libre sur la cuisse.',
    ['Le buste ne tourne pas.', 'Pousse droit devant toi.', 'Même nombre de répétitions de chaque côté.'],
    'Tourner le buste pour pousser plus loin.', 'pompes'),
  x('developpe-incline-machine', 'Développé incliné à la machine', 'developpe-incline', 'push', 'Haut des pectoraux, avant des épaules, triceps', 1,
    'Siège réglé pour que les poignées partent à hauteur du haut de la poitrine.',
    ['Dos et tête contre le dossier.', 'Pousse vers le haut et l’avant, poignets droits.', 'Reviens jusqu’à sentir l’étirement des pectoraux, pas plus.'],
    'Décoller les fesses du siège pour pousser.', 'developpe-incline-smith'),

  // ---------- Pec deck ----------
  x('butterfly', 'Écarté à la machine (butterfly)', 'pec-deck', 'push', 'Pectoraux', 1,
    'Siège réglé pour que les poignées soient à hauteur d’épaules. Bras ouverts sans dépasser la ligne du dos.',
    ['Coudes légèrement fléchis, toujours au même angle.', 'Ramène les mains l’une vers l’autre devant la poitrine.', 'Ouvre lentement sans tirer sur l’avant des épaules.'],
    'Ouvrir trop loin en arrière : l’avant de l’épaule force.', 'ecarte-poulies-haut-bas'),
  x('oiseau-machine', 'Oiseau à la machine (pec deck inversé)', 'pec-deck', 'pull', 'Arrière des épaules, haut du dos', 1,
    'Assis face au dossier, poitrine contre l’appui. Bras de la machine réglés en position avant.',
    ['Bras presque tendus, à hauteur d’épaules.', 'Ouvre les bras vers l’arrière en serrant les omoplates.', 'Reviens lentement devant toi.'],
    'Hausser les épaules : ce sont alors les trapèzes qui travaillent.', 'face-pull'),

  // ---------- Épaules ----------
  x('developpe-epaules-machine', 'Développé épaules à la machine', 'shoulder-press', 'push', 'Épaules, triceps', 1,
    'Siège réglé pour que les poignées partent à hauteur des épaules.',
    ['Dos collé au dossier, ventre serré.', 'Pousse vers le haut sans verrouiller les coudes.', 'Redescends à hauteur d’oreilles.'],
    'Cambrer le bas du dos pour pousser plus lourd.', 'developpe-militaire-smith'),
  x('elevations-laterales-machine-ex', 'Élévations latérales à la machine', 'elevations-laterales-machine', 'push', 'Milieu des épaules', 1,
    'Siège réglé pour que tes épaules soient en face des axes de la machine. Coussins contre l’extérieur des bras.',
    ['Poitrine contre l’appui.', 'Monte les coudes jusqu’à hauteur d’épaules.', 'Redescends en trois secondes.'],
    'Monter au-dessus des épaules en haussant les trapèzes.', 'elevation-laterale-poulie'),

  // ---------- Tirage vertical ----------
  x('tirage-vertical', 'Tirage vertical', 'lat-pulldown', 'pull', 'Grand dorsal, biceps, bas des trapèzes', 1,
    'Boudins calés sur le haut des cuisses, pieds à plat. Barre longue, mains un peu plus larges que les épaules.',
    ['Buste légèrement incliné en arrière, poitrine haute.', 'Tire la barre vers le haut de la poitrine en descendant les coudes.', 'Remonte jusqu’aux bras presque tendus, en contrôlant.'],
    'Se balancer en arrière pour tirer : c’est l’élan qui fait le travail.', 'traction-assistee'),
  x('tirage-vertical-serre', 'Tirage vertical prise serrée', 'lat-pulldown', 'pull', 'Grand dorsal, biceps', 1,
    'Poignée en V (prise neutre) à la place de la barre longue.',
    ['Coudes près du corps.', 'Tire la poignée vers le sternum.', 'Remonte lentement, épaules basses.'],
    'Enrouler les épaules vers l’avant en fin de mouvement.', 'rowing-poulie-un-bras'),
  x('tirage-vertical-supination', 'Tirage vertical prise inversée', 'lat-pulldown', 'pull', 'Grand dorsal, biceps', 2,
    'Barre longue, paumes vers toi, mains largeur d’épaules.',
    ['Poitrine haute.', 'Coudes vers les hanches, la barre vers le haut de la poitrine.', 'Remonte bras presque tendus.'],
    'Tirer avec les bras seulement, le dos reste passif.', 'rowing-assis'),

  // ---------- Rowing assis ----------
  x('rowing-assis', 'Rowing assis', 'seated-row', 'pull', 'Milieu du dos, grand dorsal, biceps', 1,
    'Siège réglé pour que les poignées soient à hauteur du bas de la poitrine ; appui poitrine à une distance où les bras sont tendus.',
    ['Buste droit, poitrine contre l’appui (ou dos droit sur la poulie basse).', 'Tire les coudes vers l’arrière en serrant les omoplates.', 'Reviens bras tendus, épaules qui avancent sans s’enrouler.'],
    'Basculer le buste en arrière à chaque répétition.', 'rowing-poulie-un-bras'),
  x('rowing-assis-large', 'Rowing assis prise large', 'seated-row', 'pull', 'Haut du dos, arrière des épaules', 2,
    'Poignées larges, coudes à hauteur d’épaules.',
    ['Coudes écartés.', 'Tire vers le haut de la poitrine.', 'Serre les omoplates une seconde.'],
    'Hausser les épaules en tirant.', 'oiseau-machine'),

  // ---------- Bras ----------
  x('curl-machine', 'Curl biceps à la machine', 'biceps-machine', 'pull', 'Biceps', 1,
    'Siège réglé pour que l’arrière des bras soit à plat sur le pupitre, coudes en face de l’axe.',
    ['Bras posés tout du long.', 'Monte les poignées sans décoller les coudes.', 'Redescends jusqu’aux bras presque tendus.'],
    'Siège trop haut : les épaules soulèvent la charge.', 'curl-poulie-basse'),
  x('triceps-machine-ex', 'Dips assis à la machine', 'triceps-machine', 'push', 'Triceps, bas des pectoraux', 1,
    'Siège réglé pour que les poignées soient à hauteur des côtes.',
    ['Dos contre le dossier, épaules basses.', 'Pousse vers le bas jusqu’aux bras tendus.', 'Remonte lentement jusqu’aux coudes à 90°.'],
    'Laisser remonter trop haut : les épaules partent vers l’avant.', 'extension-triceps-corde'),

  // ---------- Abdominaux et lombaires ----------
  x('crunch-machine', 'Crunch à la machine', 'abdos-machine', 'core', 'Grand droit de l’abdomen', 1,
    'Siège réglé pour que les poignées ou coussins soient à hauteur d’épaules. Charge légère pour commencer.',
    ['Pieds calés, dos contre le dossier.', 'Enroule le buste en soufflant, côtes vers le bassin.', 'Reviens lentement sans laisser la charge reposer.'],
    'Tirer avec les bras au lieu d’enrouler le ventre.', 'crunch-poulie'),
  x('extension-lombaires-machine', 'Extension lombaire à la machine', 'lombaires-machine', 'core', 'Muscles du bas du dos, fessiers', 1,
    'Dossier réglé à hauteur des omoplates, pieds calés. Charge légère.',
    ['Bras croisés sur la poitrine.', 'Pousse le dossier vers l’arrière jusqu’au buste droit.', 'Ne pas dépasser la position droite.'],
    'Aller loin en arrière en cambrant fort.', 'extension-lombaires-banc'),
  x('extension-lombaires-banc', 'Extension lombaire au banc à 45°', 'banc-lombaires', 'core', 'Bas du dos, fessiers, ischio-jambiers', 1,
    'Coussin réglé juste sous le pli de l’aine, chevilles calées sous les rouleaux.',
    ['Descends le buste dos plat.', 'Remonte jusqu’à l’alignement jambes-buste.', 'Serre les fessiers en haut, sans cambrer.'],
    'Remonter au-delà de l’alignement en creusant le dos.', 'bird-dog'),

  // ---------- Assistance ----------
  x('traction-assistee', 'Traction assistée', 'traction-dips-assistes', 'pull', 'Grand dorsal, biceps', 1,
    'Plus la charge est lourde, plus la machine t’aide. Genoux sur la plateforme une fois les mains sur la barre.',
    ['Mains un peu plus larges que les épaules.', 'Tire la poitrine vers la barre, coudes vers les hanches.', 'Redescends jusqu’aux bras tendus.'],
    'Monter et descendre vite : la plateforme rebondit et fait le travail.', 'tirage-vertical'),
  x('dips-assistes', 'Dips assistés', 'traction-dips-assistes', 'push', 'Triceps, bas des pectoraux, épaules', 2,
    'Charge d’assistance réglée, genoux sur la plateforme, mains sur les barres parallèles.',
    ['Buste légèrement penché en avant.', 'Descends jusqu’aux coudes à 90°, pas plus bas.', 'Pousse jusqu’aux bras tendus.'],
    'Descendre trop bas : l’avant de l’épaule force.', 'triceps-machine-ex'),

  // ---------- Hack squat ----------
  x('hack-squat-ex', 'Hack squat', 'hack-squat', 'legs', 'Quadriceps, fessiers', 2,
    'Épaulières à une hauteur où tu peux te glisser dessous jambes presque tendues. Pieds au milieu de la plateforme. Poignées de sécurité à tourner pour libérer la machine.',
    ['Dos et tête contre le dossier.', 'Descends jusqu’à 90° aux genoux, genoux dans l’axe des pieds.', 'Pousse dans tout le pied jusqu’aux jambes presque tendues.'],
    'Laisser les talons décoller en bas.', 'presse-a-cuisses'),

  // ---------- Poulies ----------
  x('ecarte-poulies-haut-bas', 'Écarté aux poulies de haut en bas', 'poulie-double', 'push', 'Bas et milieu des pectoraux', 2,
    'Deux poulies en position haute, poignées simples. Un pas en avant entre les colonnes.',
    ['Buste légèrement penché, un pied devant.', 'Ramène les mains devant le bas de la poitrine, coudes légèrement fléchis.', 'Ouvre lentement jusqu’à la ligne des épaules.'],
    'Plier les coudes de plus en plus : l’écarté devient un développé.', 'butterfly'),
  x('ecarte-poulies-bas-haut', 'Écarté aux poulies de bas en haut', 'poulie-double', 'push', 'Haut des pectoraux, avant des épaules', 2,
    'Deux poulies en position basse, poignées simples.',
    ['Paumes vers le haut, coudes légèrement fléchis.', 'Monte les mains jusqu’à hauteur du menton, l’une vers l’autre.', 'Redescends en contrôlant.'],
    'Monter les mains au-dessus de la tête.', 'developpe-incline-machine'),
  x('extension-triceps-corde', 'Extension des triceps à la corde', 'poulie-double', 'push', 'Triceps', 1,
    'Poulie en position haute, corde.',
    ['Coudes collés au corps, immobiles.', 'Pousse vers le bas et écarte les mains en fin de mouvement.', 'Remonte jusqu’aux coudes à 90°.'],
    'Laisser les coudes avancer : les épaules aident.', 'triceps-machine-ex'),
  x('extension-triceps-nuque', 'Extension des triceps au-dessus de la tête', 'poulie-double', 'push', 'Triceps (chef long)', 2,
    'Poulie en position basse, corde ; dos à la colonne.',
    ['Coudes près de la tête, pointés vers l’avant.', 'Tends les bras au-dessus de la tête.', 'Redescends derrière la tête lentement.'],
    'Écarter les coudes vers l’extérieur.', 'triceps-machine-ex'),
  x('curl-poulie-basse', 'Curl biceps à la poulie basse', 'poulie-double', 'pull', 'Biceps', 1,
    'Poulie en position basse, barre droite ou corde.',
    ['Coudes collés au corps.', 'Monte la barre sans balancer le buste.', 'Redescends jusqu’aux bras presque tendus.'],
    'Avancer les coudes en haut du mouvement.', 'curl-machine'),
  x('elevation-laterale-poulie', 'Élévation latérale à la poulie', 'poulie-double', 'push', 'Milieu des épaules', 2,
    'Poulie en position basse, poignée simple, câble devant le corps.',
    ['Debout de côté, bras légèrement fléchi.', 'Monte la main sur le côté jusqu’à hauteur d’épaule.', 'Redescends en trois secondes.'],
    'Pencher le buste pour aider.', 'elevations-laterales-machine-ex'),
  x('face-pull', 'Face pull', 'poulie-double', 'pull', 'Arrière des épaules, haut du dos, rotateurs', 1,
    'Poulie à hauteur du front, corde.',
    ['Recule d’un pas, bras tendus.', 'Tire la corde vers le front en écartant les mains, coudes hauts.', 'Reviens lentement.'],
    'Tirer vers le menton, coudes bas : les épaules tournent mal.', 'oiseau-machine'),
  x('tirage-bras-tendus', 'Tirage bras tendus à la poulie', 'poulie-double', 'pull', 'Grand dorsal', 2,
    'Poulie en position haute, barre droite ou corde.',
    ['Recule, buste légèrement penché, bras presque tendus.', 'Descends la barre vers les cuisses en arc de cercle.', 'Remonte jusqu’à hauteur du front.'],
    'Plier les coudes : l’exercice devient un tirage des triceps.', 'tirage-vertical'),
  x('rowing-poulie-un-bras', 'Rowing un bras à la poulie', 'poulie-double', 'pull', 'Grand dorsal, milieu du dos', 1,
    'Poulie à hauteur du ventre, poignée simple.',
    ['Pieds décalés, bassin face à la poulie.', 'Tire le coude vers la hanche.', 'Laisse l’épaule avancer en revenant.'],
    'Tourner le buste pour tirer.', 'rowing-assis'),
  x('bucheron', 'Bûcheron à la poulie', 'poulie-double', 'core', 'Obliques, gainage', 2,
    'Poulie en position haute, poignée simple tenue à deux mains, de côté par rapport à la colonne.',
    ['Bras presque tendus.', 'Descends en diagonale vers la hanche opposée en tournant le buste.', 'Pivote sur le pied arrière, reviens lentement.'],
    'Tirer avec les bras au lieu de tourner le buste.', 'planche-laterale'),
  x('pallof', 'Pallof press', 'poulie-double', 'core', 'Gainage anti-rotation, obliques', 1,
    'Poulie à hauteur de poitrine, poignée simple, de côté par rapport à la colonne.',
    ['Mains à la poitrine, pieds largeur d’épaules.', 'Pousse les mains droit devant sans laisser le buste tourner.', 'Tiens deux secondes, reviens.'],
    'Se placer trop près : pas assez de tension.', 'planche-laterale'),
  x('kickback-fessier-poulie', 'Extension de hanche à la poulie basse', 'poulie-double', 'legs', 'Grand fessier', 1,
    'Poulie en position basse, sangle de cheville.',
    ['Mains sur la colonne, buste légèrement penché.', 'Pousse la jambe vers l’arrière, genou presque tendu.', 'Arrête-toi avant de creuser le dos.'],
    'Cambrer pour monter la jambe plus haut.', 'fessier-machine'),
  x('abduction-poulie', 'Abduction de hanche à la poulie', 'poulie-double', 'legs', 'Moyen fessier', 1,
    'Poulie en position basse, sangle à la cheville extérieure.',
    ['Debout de côté, main sur la colonne.', 'Écarte la jambe sur le côté sans pencher le buste.', 'Reviens lentement.'],
    'Basculer le buste pour monter plus haut.', 'abduction-machine'),
  x('crunch-poulie', 'Crunch à genoux à la corde', 'poulie-double', 'core', 'Grand droit de l’abdomen', 2,
    'Poulie en position haute, corde ; à genoux face à la colonne.',
    ['Mains de chaque côté de la tête.', 'Enroule le buste vers les genoux en soufflant.', 'Les hanches restent immobiles.'],
    'S’asseoir sur les talons au lieu d’enrouler le dos.', 'crunch-machine'),
  x('pull-through', 'Pull-through à la poulie basse', 'poulie-double', 'legs', 'Fessiers, ischio-jambiers', 2,
    'Poulie en position basse, corde ; dos à la colonne, corde entre les jambes.',
    ['Recule de deux pas, genoux légèrement fléchis.', 'Pousse les fesses en arrière, dos plat.', 'Remonte en serrant les fessiers.'],
    'Plier les genoux comme un squat.', 'souleve-roumain-smith'),
  x('oiseau-poulies', 'Oiseau aux poulies croisées', 'poulie-double', 'pull', 'Arrière des épaules', 2,
    'Deux poulies à hauteur d’épaules, sans poignée (tiens le câble) ; câbles croisés devant toi.',
    ['Bras presque tendus.', 'Ouvre les bras vers l’arrière à hauteur d’épaules.', 'Reviens lentement en croisant.'],
    'Hausser les épaules.', 'oiseau-machine'),

  // ---------- Smith machine ----------
  x('squat-smith', 'Squat à la Smith machine', 'smith', 'legs', 'Quadriceps, fessiers', 2,
    'Barre à hauteur d’épaules. Pieds légèrement en avant de la barre, largeur d’épaules. Crochets de sécurité réglés juste sous la position basse.',
    ['Barre sur le haut du dos, pas sur la nuque.', 'Descends en poussant les fesses en arrière, genoux dans l’axe des pieds.', 'Remonte en poussant dans tout le pied.'],
    'Pieds sous la barre : les talons décollent et les genoux avancent trop.', 'presse-a-cuisses'),
  x('fente-smith', 'Fente à la Smith machine', 'smith', 'legs', 'Quadriceps, fessiers', 2,
    'Barre à hauteur d’épaules, un grand pas d’écart entre les pieds.',
    ['Buste droit sous la barre.', 'Descends le genou arrière vers le sol.', 'Pousse sur la jambe avant pour remonter.'],
    'Pas trop court : le genou avant dépasse largement la pointe.', 'fentes-arriere'),
  x('developpe-couche-smith', 'Développé couché à la Smith machine', 'smith', 'push', 'Pectoraux, épaules, triceps', 2,
    'Banc plat sous la barre, la barre au-dessus du bas de la poitrine. Crochets de sécurité réglés juste au-dessus de la poitrine.',
    ['Omoplates serrées, pieds au sol.', 'Descends la barre vers le bas de la poitrine.', 'Pousse jusqu’aux bras presque tendus.'],
    'Banc mal placé : la barre descend vers le cou.', 'developpe-machine'),
  x('developpe-incline-smith', 'Développé incliné à la Smith machine', 'smith', 'push', 'Haut des pectoraux, épaules', 2,
    'Banc incliné à 30°, barre au-dessus du haut de la poitrine.',
    ['Omoplates serrées.', 'Descends la barre vers le haut de la poitrine.', 'Pousse sans décoller les fesses.'],
    'Banc trop incliné : ce sont les épaules qui travaillent.', 'developpe-incline-machine'),
  x('developpe-militaire-smith', 'Développé épaules assis à la Smith machine', 'smith', 'push', 'Épaules, triceps', 2,
    'Banc à dossier droit, barre devant le visage.',
    ['Dos contre le dossier.', 'Descends la barre au niveau du menton.', 'Pousse au-dessus de la tête.'],
    'Descendre la barre derrière la nuque.', 'developpe-epaules-machine'),
  x('rowing-smith', 'Rowing buste penché à la Smith machine', 'smith', 'pull', 'Dos, arrière des épaules, biceps', 2,
    'Barre à hauteur de mi-cuisses.',
    ['Buste penché à 45°, dos plat.', 'Tire la barre vers le nombril.', 'Redescends bras tendus sans arrondir le dos.'],
    'Arrondir le dos en fin de série.', 'rowing-assis'),
  x('hip-thrust-smith', 'Hip thrust à la Smith machine', 'smith', 'legs', 'Grand fessier, ischio-jambiers', 2,
    'Banc perpendiculaire à la barre, haut du dos sur le banc, barre sur les hanches avec un coussin.',
    ['Pieds à plat, tibias verticaux en haut.', 'Monte le bassin en serrant les fessiers.', 'Menton rentré, côtes basses.'],
    'Cambrer en haut au lieu de serrer les fessiers.', 'hip-thrust'),
  x('souleve-roumain-smith', 'Soulevé de terre jambes tendues à la Smith machine', 'smith', 'legs', 'Ischio-jambiers, fessiers', 2,
    'Barre à hauteur de mi-cuisses, crochets de sécurité à mi-tibias.',
    ['Genoux légèrement fléchis.', 'Pousse les fesses en arrière, la barre frôle les cuisses.', 'Remonte en serrant les fessiers, dos plat.'],
    'Arrondir le dos pour descendre plus bas.', 'souleve-de-terre-jambes-tendues'),
  x('mollets-smith', 'Mollets debout à la Smith machine', 'smith', 'legs', 'Mollets', 1,
    'Barre sur le haut du dos, avant des pieds sur une marche ou un disque.',
    ['Jambes tendues sans verrouiller.', 'Descends les talons.', 'Monte sur la pointe des pieds, une seconde en haut.'],
    'Petits rebonds sans amplitude.', 'montees-de-mollets'),
  x('rowing-inverse-smith', 'Rowing inversé sous la barre', 'smith', 'pull', 'Dos, biceps, gainage', 1,
    'Barre bloquée à hauteur de hanches ; plus elle est haute, plus c’est facile.',
    ['Corps gainé de la tête aux talons.', 'Tire la poitrine vers la barre.', 'Redescends bras tendus.'],
    'Laisser tomber les hanches.', 'rowing-elastique'),
  x('pompes-inclinees-smith', 'Pompes mains sur la barre', 'smith', 'push', 'Pectoraux, triceps, gainage', 1,
    'Barre bloquée à hauteur de hanches ; plus elle est basse, plus c’est difficile.',
    ['Corps gainé.', 'Descends la poitrine vers la barre.', 'Pousse jusqu’aux bras tendus.'],
    'Laisser tomber les hanches.', 'pompes'),

  // ---------- Cardio ----------
  x('marche-inclinee', 'Marche inclinée sur tapis', 'tapis', 'cardio', 'Cœur, mollets, fessiers', 1,
    'Vitesse de marche (4 à 6 km/h), pente de 5 à 12 %. Pince de sécurité accrochée au vêtement.',
    ['Buste droit, sans te tenir aux barres.', 'Pas naturels, pied entier au sol.', 'Augmente la pente avant la vitesse.'],
    'Se tenir aux barres : l’effort chute.', 'escalier-ex', 'treadmill'),
  x('course-tapis', 'Course sur tapis', 'tapis', 'cardio', 'Cœur, jambes', 1,
    'Pente de 1 % pour rapprocher de la course dehors. Pince de sécurité accrochée.',
    ['Cours au centre du tapis.', 'Petits pas rapides, regard droit.', 'Change la vitesse avec les touches, sans sauter sur les côtés.'],
    'Courir trop près de la console : on raccourcit le pas.', 'velo-elliptique-ex', 'treadmill'),
  x('velo-droit-ex', 'Vélo droit', 'velo-droit', 'cardio', 'Cœur, quadriceps, fessiers', 1,
    'Selle à hauteur de hanche debout : jambe presque tendue en bas du coup de pédale. Pieds dans les cale-pieds.',
    ['Bassin stable sur la selle.', 'Cadence de 80 à 95 tours par minute.', 'Monte la résistance plutôt que la cadence.'],
    'Selle trop basse : les genoux remontent et fatiguent.', 'velo-allonge-ex', 'bike'),
  x('velo-allonge-ex', 'Vélo semi-allongé', 'velo-allonge', 'cardio', 'Cœur, quadriceps, fessiers', 1,
    'Siège avancé ou reculé pour que la jambe soit presque tendue en bas.',
    ['Dos contre le dossier.', 'Pousse les pédales sans décoller le bassin.', 'Cadence régulière.'],
    'Siège trop près : genoux très pliés.', 'velo-droit-ex', 'bike'),
  x('rameur-ex', 'Rameur', 'rameur', 'cardio', 'Cœur, jambes, dos, bras', 2,
    'Pieds calés, sangle sur le haut du pied. Volet de résistance (damper) entre 3 et 5.',
    ['Ordre : jambes, puis buste, puis bras.', 'Retour dans l’ordre inverse : bras, buste, jambes.', 'Le retour dure deux fois plus longtemps que la poussée.'],
    'Tirer avec les bras avant d’avoir poussé avec les jambes.', 'velo-air-ex', 'rower'),
  x('velo-elliptique-ex', 'Vélo elliptique', 'velo-elliptique', 'cardio', 'Cœur, jambes, bras', 1,
    'Résistance assez forte pour ne pas « tourner dans le vide ».',
    ['Pieds à plat sur les pédales.', 'Pousse et tire les poignées.', 'Buste droit, sans t’appuyer.'],
    'Résistance trop faible : les jambes s’emballent.', 'marche-inclinee', 'elliptical'),
  x('escalier-ex', 'Escalier', 'escalier', 'cardio', 'Cœur, fessiers, quadriceps, mollets', 2,
    'Niveau bas pour commencer (marches lentes).',
    ['Pied entier sur la marche.', 'Buste droit, mains légères sur les rampes.', 'Rythme régulier.'],
    'Se pencher sur les rampes en portant son poids.', 'marche-inclinee', 'stairs'),
  x('velo-air-ex', 'Vélo à air', 'velo-air', 'cardio', 'Cœur, corps entier', 2,
    'Selle réglée comme un vélo droit. Plus tu pédales fort, plus ça résiste.',
    ['Pousse et tire les poignées en rythme avec les jambes.', 'Bassin stable.', 'Pour les sprints : départ progressif sur deux à trois secondes.'],
    'Partir à fond dès la première seconde.', 'rameur-ex', 'other'),
  x('skierg-ex', 'SkiErg', 'skierg', 'cardio', 'Cœur, dos, bras, gainage', 2,
    'Volet de résistance entre 3 et 5. Pieds largeur de hanches.',
    ['Bras en haut, tire vers le bas en pliant légèrement les hanches.', 'Mains qui passent près des cuisses.', 'Remonte en te redressant.'],
    'Tirer seulement avec les bras, sans les hanches.', 'rameur-ex', 'skierg'),
];

const STARTER_NAMES: Readonly<Record<string, string>> = Object.fromEntries(STARTER_EXERCISES.map(([n]) => [starterKey(n), n]));
const BY_KEY: ReadonlyMap<string, MachineExercise> = new Map(MACHINE_EXERCISES.map((e) => [e.key, e]));
const MACHINE_BY_KEY: ReadonlyMap<string, GymMachine> = new Map(GYM_MACHINES.map((m) => [m.key, m]));

export const machineExercise = (key: string | null | undefined): MachineExercise | null => (key ? BY_KEY.get(key) ?? null : null);
export const gymMachine = (key: string): GymMachine | null => MACHINE_BY_KEY.get(key) ?? null;

/** Nom lisible d’une alternative (exercice de ce catalogue ou exercice de départ). */
export function alternativeName(key: string): string | null {
  return BY_KEY.get(key)?.name ?? STARTER_NAMES[key] ?? null;
}

/** Bibliothèque rangée par type de machine, puis par machine. */
export function machineLibrary(): { kind: MachineKind; label: string; machines: { machine: GymMachine; exercises: MachineExercise[] }[] }[] {
  return MACHINE_KINDS.map((kind) => ({
    kind, label: MACHINE_KIND_LABELS[kind],
    machines: GYM_MACHINES.filter((m) => m.kind === kind).map((machine) => ({ machine, exercises: MACHINE_EXERCISES.filter((e) => e.machine === machine.key) })),
  })).filter((g) => g.machines.length);
}

/** Consignes écrites d’un exercice de machine, telles qu’elles entrent dans la bibliothèque du coach (1 500 caractères au plus). */
export function machineInstructions(e: MachineExercise): string {
  const alt = alternativeName(e.alternative);
  return [
    `Réglages : ${e.settings}`,
    e.cues.map((c, i) => `${i + 1}. ${c}`).join('\n'),
    `Erreur fréquente : ${e.mistake}`,
    alt ? `Si la machine est prise : ${alt}.` : null,
  ].filter(Boolean).join('\n').slice(0, 1500);
}

/**
 * Fiche d’un exercice de la bibliothèque du coach venu des machines : réglages, consignes, erreur et alternative
 * affichés en clair tant que le coach n’a pas réécrit les consignes ; sinon, son texte prime (`structured` faux).
 */
export function machineHowTo(e: { starterKey?: string | null; instructions: string | null }): { machine: MachineExercise; structured: boolean } | null {
  const m = machineExercise(e.starterKey);
  if (!m) return null;
  return { machine: m, structured: !e.instructions || e.instructions.trim() === machineInstructions(m) };
}
