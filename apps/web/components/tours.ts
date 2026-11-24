// Visites du guide CoachOS (CE-C-01, D-028) sur les vrais écrans.
// Chaque étape vise un élément marqué data-tour="…" sur une page donnée.

export type TourId = 'athlete' | 'coach' | 'coach-empty';

export interface TourStep {
  /** Page attendue : motif avec :wid et :id (segments), ou « any » pour toute page de l’espace. */
  path: string;
  /** Éléments visés, le premier présent l’emporte. Sans cible : bulle seule. */
  targets?: string[];
  text: string;
  /** Texte propre à une cible de repli (ex. séance sans blocs). */
  textFor?: Record<string, string>;
  mood?: 'happy' | 'wink' | 'cheer';
  /** L’étape avance quand l’élève ou le coach touche l’élément visé. */
  action?: 'click';
  /** Passer l’étape si la page ou l’élément ne s’y prête pas (ex. pas de séance aujourd’hui). */
  optional?: boolean;
  /** Page où reprendre si la visite se trouve ailleurs. */
  href?: (wid: string) => string;
}

const A = '/athlete/:wid';
const C = '/coach/:wid';

export const TOURS: Record<TourId, TourStep[]> = {
  athlete: [
    { path: `${A}/today`, text: 'Salut ! Je suis ton guide CoachOS. En une minute, je te montre comment t’entraîner ici avec ton coach.', mood: 'cheer', href: (w) => `/athlete/${w}/today` },
    { path: `${A}/today`, targets: ['install'], optional: true, text: 'D’abord, installe CoachOS sur ton téléphone : tu l’ouvriras d’un toucher, comme une appli. Cette carte te donne les étapes exactes pour ton appareil. Tu peux les suivre après la visite.', href: (w) => `/athlete/${w}/today` },
    { path: `${A}/today`, targets: ['today-card', 'today-empty'], text: 'Chaque jour, cet écran te montre la séance préparée par ton coach, avec sa durée.', textFor: { 'today-empty': 'Chaque jour, cet écran te montre la séance préparée par ton coach. Aujourd’hui, c’est repos.' }, href: (w) => `/athlete/${w}/today` },
    { path: `${A}/today`, targets: ['today-open'], action: 'click', optional: true, text: 'Touche « Voir la séance » pour l’ouvrir. Je te suis.' },
    { path: `${A}/workouts/:id`, targets: ['structure', 'workout-details'], optional: true, text: 'Voici le déroulé, bloc par bloc : ce qu’il faut faire, combien de temps, et à quelle intensité.', textFor: { 'workout-details': 'Ici, la durée prévue, puis les consignes de ton coach juste en dessous.' } },
    { path: `${A}/workouts/:id`, targets: ['feedback-cta'], optional: true, text: 'Après ta séance, donne ton retour ici. Il faut moins de trente secondes, et ton coach le lit.', mood: 'wink' },
    { path: 'any', targets: ['tab-schedule'], text: 'Programme : toute ta semaine, et les semaines suivantes dès que ton coach les publie.' },
    { path: 'any', targets: ['tab-progress'], text: 'Progression : ton objectif, ta régularité et ton volume d’entraînement, semaine après semaine.' },
    { path: 'any', targets: ['tab-messages'], text: 'Échanges : écris à ton coach ou envoie-lui un vocal. Tu y retrouves aussi tes groupes.' },
    // D-129, D-141 : chez l’élève, le personnage n’a plus de bouton permanent ; la visite se relance depuis le Profil.
    { path: 'any', targets: ['tab-profile'], text: 'Profil : ton bilan, tes réglages et la présentation de ton coach. C’est aussi là que tu peux revoir cette visite. Bonne séance !', mood: 'cheer' },
  ],
  coach: [
    { path: `${C}/planning`, text: 'Bonjour ! Je suis ton guide CoachOS. En une minute, je te montre comment organiser ton travail et suivre tes élèves.', mood: 'cheer', href: (w) => `/coach/${w}/planning` },
    { path: `${C}/planning`, targets: ['planning-todo'], text: 'Ton Accueil commence par ce qui demande ton attention : en retard, aujourd’hui, cette semaine. Chaque ligne dit pourquoi, et « Ouvrir » mène à l’action.', href: (w) => `/coach/${w}/planning` },
    { path: `${C}/planning`, targets: ['planning-agenda'], optional: true, text: 'À côté, ta semaine : rendez-vous, échéances et séances publiées pour tes élèves.' },
    { path: `${C}/planning`, targets: ['planning-add'], text: 'Ajoute une tâche ou planifie un appel ou une visio avec un élève.', mood: 'wink' },
    { path: `${C}/planning`, targets: ['nav-calendar'], action: 'click', text: 'Touche « Calendrier » pour préparer la semaine d’un élève. Je te suis.', href: (w) => `/coach/${w}/planning` },
    { path: `${C}/calendar`, targets: ['athlete-select'], optional: true, text: 'Choisis ici l’élève dont tu prépares la semaine.' },
    { path: `${C}/calendar`, targets: ['day-add'], action: 'click', text: 'Touche « + Ajouter » pour créer une séance ce jour-là. Je te suis.', href: (w) => `/coach/${w}/calendar` },
    { path: `${C}/athletes/:id/workouts/new`, targets: ['builder'], text: 'Construis la séance bloc par bloc : échauffement, efforts, répétitions et séries, retour au calme.' },
    { path: `${C}/athletes/:id/workouts/new`, targets: ['presets'], text: 'Pour aller plus vite, pars d’un modèle rapide et ajuste-le.', mood: 'wink' },
    { path: `${C}/athletes/:id/workouts/new`, targets: ['save-draft'], text: 'Enregistre : la séance reste un brouillon invisible pour l’élève tant que tu ne cliques pas sur Publier.' },
    { path: 'any', targets: ['nav-athletes'], text: 'Élèves : tes groupes, et chaque élève classé par groupe, niveau ou urgence, avec sa fiche complète.' },
    { path: 'any', targets: ['nav-review'], text: 'Boîte de réception : les retours de tes élèves (le prévu face au réalisé, puis « traité »), tes messages privés et de groupe, et tes notifications.' },
    { path: 'any', targets: ['nav-library'], text: 'Bibliothèque : tes séances types, tes exercices et ta méthode, à réutiliser pour tous tes élèves.' },
    { path: 'any', targets: ['nav-settings'], text: 'Paramètres : ta présentation, tes spécialités, ton logo et la couleur de ton espace.' },
    // D-143 : plus de bouton permanent ; la visite se relance depuis le menu du compte.
    { path: 'any', targets: ['account-menu'], text: 'Ton menu : ton compte, tes autres espaces, et de quoi revoir cette visite. Bon coaching !', mood: 'cheer' },
  ],
  'coach-empty': [
    { path: `${C}/planning`, text: 'Bonjour ! Je suis ton guide CoachOS. En quatre pas, tu passes de ta liste d’élèves à leur premier retour.', mood: 'cheer', href: (w) => `/coach/${w}/planning` },
    // D-169 : les premiers pas remplacent le seul bouton « Ajouter un élève » ; la liste se colle d’un coup.
    { path: `${C}/planning`, targets: ['first-steps'], text: 'Tes premiers pas, dans l’ordre : ajoute tes élèves (colle ta liste depuis Google Docs ou un tableur), publie une première séance, envoie les invitations, traite un premier retour. Chaque pas a son bouton.', href: (w) => `/coach/${w}/planning` },
    { path: 'any', targets: ['nav-planning'], text: 'Ensuite, ton Accueil t’indique chaque jour quoi faire : retours à examiner, séances à préparer, appels prévus.' },
    { path: 'any', targets: ['nav-calendar'], text: 'Dans Calendrier, tu prépares ses séances bloc par bloc et tu les publies.' },
    { path: 'any', targets: ['nav-athletes'], text: 'Dans Élèves, tu ranges tes élèves par groupes et tu retrouves leur fiche.' },
    { path: 'any', targets: ['account-menu'], text: 'Ton menu : ton compte, tes autres espaces, et de quoi revoir cette visite. Bon coaching !', mood: 'cheer' },
  ],
};

/** Nom de la page attendue, pour dire où la visite continue. */
export function placeName(path: string): string {
  if (path.endsWith('/today')) return 'Aujourd’hui';
  if (path.endsWith('/planning')) return 'Accueil';
  if (path.endsWith('/calendar')) return 'Calendrier';
  if (path.endsWith('/workouts/new')) return 'Nouvelle séance';
  if (path.endsWith('/athletes/new')) return 'Ajouter un élève';
  if (path.endsWith('/workouts/:id')) return 'la page d’une séance';
  return 'une autre page';
}

/** /athlete/:wid/workouts/:id correspond à /athlete/123/workouts/456. */
export function matchPath(pattern: string, pathname: string, root: string): boolean {
  if (pattern === 'any') return pathname.startsWith(root);
  const re = new RegExp('^' + pattern.replace(/:[a-z]+/g, '[^/]+') + '/?$');
  return re.test(pathname);
}
