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
    { path: `${A}/today`, targets: ['today-card', 'today-empty'], text: 'Chaque jour, cet écran te montre la séance préparée par ton coach, avec sa durée.', textFor: { 'today-empty': 'Chaque jour, cet écran te montre la séance préparée par ton coach. Aujourd’hui, c’est repos.' }, href: (w) => `/athlete/${w}/today` },
    { path: `${A}/today`, targets: ['today-open'], action: 'click', optional: true, text: 'Touche « Voir la séance » pour l’ouvrir. Je te suis.' },
    { path: `${A}/workouts/:id`, targets: ['structure', 'workout-details'], optional: true, text: 'Voici le déroulé, bloc par bloc : durée ou distance, et l’intensité à viser.', textFor: { 'workout-details': 'Ici, la durée prévue, puis les consignes de ton coach juste en dessous.' } },
    { path: `${A}/workouts/:id`, targets: ['feedback-cta'], optional: true, text: 'Après ta séance, donne ton retour ici. Il faut moins de trente secondes, et ton coach le lit.', mood: 'wink' },
    { path: 'any', targets: ['tab-schedule'], text: 'Programme : toute ta semaine, et les semaines suivantes dès que ton coach les publie.' },
    { path: 'any', targets: ['tab-messages'], text: 'Échanges : écris à ton coach ou envoie-lui un vocal. Tu y retrouves aussi tes groupes.' },
    { path: 'any', targets: ['tab-profile'], text: 'Profil : tes réglages, ton profil sportif et la présentation de ton coach.' },
    { path: 'any', targets: ['guide-help'], text: 'Je reste ici, en bas de l’écran. Touche-moi pour revoir la visite. Bonne séance !', mood: 'cheer' },
  ],
  coach: [
    { path: `${C}/planning`, text: 'Bonjour ! Je suis ton guide CoachOS. En une minute, je te montre comment organiser ton travail et suivre tes élèves.', mood: 'cheer', href: (w) => `/coach/${w}/planning` },
    { path: `${C}/planning`, targets: ['planning-todo'], text: 'Ton Planning commence par ce qui demande ton attention : en retard, aujourd’hui, cette semaine. Chaque ligne dit pourquoi, et « Ouvrir » mène à l’action.', href: (w) => `/coach/${w}/planning` },
    { path: `${C}/planning`, targets: ['planning-agenda'], optional: true, text: 'À côté, ta semaine : rendez-vous, échéances et séances publiées pour tes élèves.' },
    { path: `${C}/planning`, targets: ['planning-add'], text: 'Ajoute une tâche ou planifie un appel ou une visio avec un élève.', mood: 'wink' },
    { path: `${C}/planning`, targets: ['nav-calendar'], action: 'click', text: 'Touche « Séances » pour préparer la semaine d’un élève. Je te suis.', href: (w) => `/coach/${w}/planning` },
    { path: `${C}/calendar`, targets: ['athlete-select'], optional: true, text: 'Choisis ici l’élève dont tu prépares la semaine.' },
    { path: `${C}/calendar`, targets: ['day-add'], action: 'click', text: 'Touche « + Ajouter » pour créer une séance ce jour-là. Je te suis.', href: (w) => `/coach/${w}/calendar` },
    { path: `${C}/athletes/:id/workouts/new`, targets: ['builder'], text: 'Construis la séance bloc par bloc : échauffement, efforts, répétitions et séries, retour au calme.' },
    { path: `${C}/athletes/:id/workouts/new`, targets: ['presets'], text: 'Pour aller plus vite, pars d’un modèle rapide et ajuste-le.', mood: 'wink' },
    { path: `${C}/athletes/:id/workouts/new`, targets: ['save-draft'], text: 'Enregistre : la séance reste un brouillon invisible pour l’élève tant que tu ne cliques pas sur Publier.' },
    { path: 'any', targets: ['nav-messages'], text: 'Messages : une conversation privée par élève et un fil par groupe, en texte ou en vocal. Un message reçu apparaît dans ton Planning.' },
    { path: 'any', targets: ['nav-athletes'], text: 'Élèves : tes groupes, et chaque élève classé par groupe, niveau ou urgence, avec sa fiche complète.' },
    { path: 'any', targets: ['nav-review'], text: 'Retours : ce que tes élèves ont fait et ressenti. Compare le prévu et le réalisé, puis marque le retour comme traité.' },
    { path: 'any', targets: ['nav-settings'], text: 'Paramètres : ta présentation, tes spécialités, ton logo et la couleur de ton espace.' },
    { path: 'any', targets: ['guide-help'], text: 'Je reste ici, en bas de l’écran. Touche-moi pour revoir la visite.', mood: 'cheer' },
  ],
  'coach-empty': [
    { path: `${C}/planning`, text: 'Bonjour ! Je suis ton guide CoachOS. Commençons par l’essentiel : inviter ton premier élève.', mood: 'cheer', href: (w) => `/coach/${w}/planning` },
    { path: `${C}/planning`, targets: ['add-athlete'], action: 'click', text: 'Touche « + Ajouter un élève ». Je te suis.', href: (w) => `/coach/${w}/planning` },
    { path: `${C}/athletes/new`, targets: ['athlete-form'], text: 'Son nom, son fuseau et son adresse : il reçoit un lien personnel pour créer son compte.' },
    { path: 'any', targets: ['nav-planning'], text: 'Ensuite, ton Planning t’indique chaque jour quoi faire : retours à examiner, séances à préparer, appels prévus.' },
    { path: 'any', targets: ['nav-calendar'], text: 'Dans Séances, tu prépares ses séances bloc par bloc et tu les publies.' },
    { path: 'any', targets: ['nav-athletes'], text: 'Dans Élèves, tu ranges tes élèves par groupes et tu retrouves leur fiche.' },
    { path: 'any', targets: ['guide-help'], text: 'Je reste ici, en bas de l’écran. Touche-moi pour revoir la visite.', mood: 'cheer' },
  ],
};

/** Nom de la page attendue, pour dire où la visite continue. */
export function placeName(path: string): string {
  if (path.endsWith('/today')) return 'Aujourd’hui';
  if (path.endsWith('/planning')) return 'Planning';
  if (path.endsWith('/calendar')) return 'Séances';
  if (path.endsWith('/workouts/new')) return 'Nouvelle séance';
  if (path.endsWith('/athletes/new')) return 'Ajouter un athlète';
  if (path.endsWith('/workouts/:id')) return 'la page d’une séance';
  return 'une autre page';
}

/** /athlete/:wid/workouts/:id correspond à /athlete/123/workouts/456. */
export function matchPath(pattern: string, pathname: string, root: string): boolean {
  if (pattern === 'any') return pathname.startsWith(root);
  const re = new RegExp('^' + pattern.replace(/:[a-z]+/g, '[^/]+') + '/?$');
  return re.test(pathname);
}
