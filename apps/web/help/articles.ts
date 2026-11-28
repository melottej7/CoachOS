/**
 * D-194 · Centre d’aide intégré : des articles courts, écrits avec les mots de l’écran, pour qu’un coach ou un élève
 * trouve seul comment faire. Chaque article mène à la bonne page (« Y aller »). Le contenu vit ici, dans le code :
 * il change avec l’app, dans le même commit.
 */

export type HelpAudience = 'coach' | 'athlete';

export interface HelpArticle {
  slug: string;
  audience: HelpAudience;
  theme: string;
  title: string;
  /** Une phrase : ce que l’article permet de faire. */
  summary: string;
  /** Mots qu’on pourrait chercher, synonymes compris. */
  keywords: string;
  steps?: string[];
  /** « Bon à savoir ». */
  tips?: string[];
  /** Chemin dans l’espace (« athletes/new ») ou chemin absolu (« /profile »). */
  links?: { label: string; to: string }[];
}

export const HELP_ARTICLES: readonly HelpArticle[] = [
  // ---------- Coach · Démarrer ----------
  {
    slug: 'demarrer', audience: 'coach', theme: 'Démarrer',
    title: 'Bien démarrer avec CoachOS',
    summary: 'Les quatre premiers gestes : régler ton espace, ajouter tes élèves, publier une séance, traiter un retour.',
    keywords: 'debut commencer premiers pas installation espace reglages mode simple visite guidee',
    steps: [
      'Dans Paramètres, présente ton espace : nom, logo, couleur et sports encadrés.',
      'Dans Élèves, ajoute tes élèves un par un, ou plusieurs d’un coup en collant ta liste.',
      'Prépare une séance pour un élève, puis touche « Publier » : elle apparaît sur son téléphone.',
      'Quand l’élève dit ce qu’il a fait, son retour arrive dans ta Boîte de réception : lis, réponds si besoin, marque-le traité.',
    ],
    tips: [
      'L’Accueil affiche « Premiers pas » tant que ces quatre gestes ne sont pas faits.',
      'Le mode simple cache ce qui ne sert pas au début ; tu peux l’enlever dans Paramètres.',
      '« Revoir la visite guidée » est dans le menu de ton compte, en bas à gauche sur ordinateur, en haut à droite sur téléphone.',
    ],
    links: [{ label: 'Paramètres de l’espace', to: 'settings' }, { label: 'Accueil', to: 'planning' }],
  },
  {
    slug: 'installer-coach', audience: 'coach', theme: 'Démarrer',
    title: 'Installer CoachOS sur ton téléphone',
    summary: 'Une icône sur l’écran d’accueil, l’app en plein écran, et les notifications.',
    keywords: 'installer application telephone iphone android icone ecran accueil notification actualiser rafraichir',
    steps: [
      'Sur iPhone : ouvre CoachOS dans Safari, touche le bouton Partager, puis « Sur l’écran d’accueil ».',
      'Sur Android : dans Chrome, touche « Installer l’application » (ou le menu ⋮, puis « Ajouter à l’écran d’accueil »).',
      'Ouvre ensuite CoachOS depuis sa nouvelle icône.',
    ],
    tips: [
      'Dans l’app installée, tire la page vers le bas pour l’actualiser.',
      'La petite flèche en haut à gauche ramène à la page précédente.',
    ],
  },
  {
    slug: 'palette', audience: 'coach', theme: 'Démarrer',
    title: 'Tout trouver avec ⌘K',
    summary: 'Une recherche unique pour aller à un élève, sa semaine, une page ou une action.',
    keywords: 'recherche rechercher raccourci clavier palette commande cmd k aller vite',
    steps: [
      'Sur ordinateur, appuie sur ⌘K (Ctrl K sur Windows) ; sur téléphone, touche la loupe en haut.',
      'Tape quelques lettres : un élève, « semaine », « exercices », « aide »…',
      'Choisis avec les flèches et Entrée, ou touche la ligne.',
    ],
  },

  // ---------- Coach · Élèves ----------
  {
    slug: 'inviter-eleves', audience: 'coach', theme: 'Élèves',
    title: 'Ajouter et inviter tes élèves',
    summary: 'Créer la fiche d’un élève, lui envoyer son lien, ou en ajouter plusieurs d’un coup.',
    keywords: 'inviter invitation eleve ajouter lien email whatsapp liste plusieurs groupe relancer renvoyer',
    steps: [
      'Élèves › « Ajouter un élève » : son nom, son fuseau, puis « Créer la fiche et le lien ».',
      'Choisis « Je l’envoie moi-même » pour copier le lien et l’envoyer par message, ou laisse CoachOS l’envoyer par e-mail.',
      'Plusieurs élèves : « Ajouter plusieurs élèves », colle ta liste (tableur, Google Docs), groupes compris.',
      'L’élève crée son compte avec ce lien : sa fiche passe de « Invité·e » à active.',
    ],
    tips: [
      'Lien perdu ou expiré : ouvre la fiche de l’élève, section Invitation, « Renvoyer l’invitation ».',
      'Tu peux préparer et publier des séances avant qu’il rejoigne l’espace : il les verra en arrivant.',
      'Touche n’importe où sur la carte d’un élève pour ouvrir son dossier.',
    ],
    links: [{ label: 'Ajouter un élève', to: 'athletes/new' }, { label: 'Ajouter plusieurs élèves', to: 'athletes/import' }],
  },
  {
    slug: 'dossier-eleve', audience: 'coach', theme: 'Élèves',
    title: 'Le dossier d’un élève',
    summary: 'Vue d’ensemble, progression, bilan et notes privées, en onglets ; ce qu’il reste à faire pour lui.',
    keywords: 'dossier fiche eleve bilan progression notes taches a faire niveau objectifs vma reperes',
    steps: [
      'Élèves › touche la carte de l’élève.',
      'Vue d’ensemble : sa semaine, « À faire pour… », ses prochaines séances et ses derniers retours.',
      'Progression : suivi de l’entraînement, charges, niveaux, objectifs et repères (VMA…).',
      'Bilan : ce qu’il a déclaré à son arrivée ; confirme-le une fois relu.',
    ],
    tips: [
      'Le bouton d’une tâche (« Y aller », « Ouvrir ») mène directement au bon onglet.',
      'Les notes privées ne sont visibles que par toi.',
    ],
    links: [{ label: 'Mes élèves', to: 'athletes' }],
  },
  {
    slug: 'groupes', audience: 'coach', theme: 'Élèves',
    title: 'Groupes et séances de groupe',
    summary: 'Classer tes élèves par groupe et donner la même séance à tout un groupe.',
    keywords: 'groupe groupes club equipe seance collective meme seance plusieurs eleves',
    steps: [
      'Élèves › « Nouveau groupe » : donne-lui un nom (ex. « Préparation marathon »), puis « Créer ».',
      'Ajoute un élève à un groupe depuis son dossier (section Groupes). Un élève peut être dans plusieurs groupes.',
      'Séances de groupe : prépare une séance une fois, elle part chez tous les élèves du groupe à la publication.',
    ],
    links: [{ label: 'Séances de groupe', to: 'group-sessions' }],
  },

  // ---------- Coach · Séances ----------
  {
    slug: 'ecrire-seance', audience: 'coach', theme: 'Séances',
    title: 'Écrire une séance',
    summary: 'Les blocs de l’éditeur : exercice en séries, circuit, cardio sur machine, étapes et répétitions.',
    keywords: 'seance ecrire creer editeur bloc exercice serie circuit cardio machine palier repetition recuperation brouillon',
    steps: [
      'Ouvre la semaine d’un élève (Calendrier) et touche un jour, ou « Nouvelle séance ».',
      'Musculation : « Exercice » (séries, répétitions ou durée, charge, récupération), « Circuit » (plusieurs exercices en tours), « Cardio » (une machine en paliers), « Machines » (choisir dans la salle).',
      'Endurance : « Étape » (durée ou distance, zone) et « Répétition » (fractionné).',
      '« Enregistrer le brouillon » garde la séance sans la montrer ; « Publier pour… » l’envoie à l’élève.',
    ],
    tips: [
      'Rien n’est visible par l’élève tant que tu n’as pas publié.',
      'Une carte écrite se réduit d’un toucher sur son chevron ; en ajouter une replie les précédentes. « Tout réduire » et « Tout déplier » sont au-dessus de la liste.',
      'Glisse une carte par sa poignée pour changer l’ordre.',
    ],
    links: [{ label: 'Calendrier', to: 'calendar' }],
  },
  {
    slug: 'series-charges', audience: 'coach', theme: 'Séances',
    title: 'Changer la charge d’une série à l’autre',
    summary: 'Une pyramide (12 × 10 kg, 10 × 12 kg, 8 × 14 kg) ou une charge qui monte à chaque série.',
    keywords: 'charge poids kg serie pyramide progressive repetitions differentes varier augmenter',
    steps: [
      'Dans la carte de l’exercice : au moins deux séries, « Intensité » sur « Charge (kg) ».',
      'Touche « Varier d’une série à l’autre » : un tableau s’ouvre, une ligne par série.',
      'Règle les répétitions et la charge de chaque série, ou utilise « +2,5 kg par série » et « +5 kg par série ».',
      '« Mêmes réglages pour toutes » revient à des séries identiques.',
    ],
    tips: [
      'L’élève voit la charge de chaque série ; pendant la récupération, son écran affiche « Prépare 12 kg » et la voix le dit.',
      'En texte : « 3×12/10/8 Tirage 10/12/14kg R1\'30 ».',
    ],
  },
  {
    slug: 'ecrire-texte', audience: 'coach', theme: 'Séances',
    title: 'Écrire une séance en texte',
    summary: 'Taper la séance comme dans un carnet : CoachOS la transforme en blocs.',
    keywords: 'notation vite taper coller carnet fractionne 10x400 4x10 presse',
    steps: [
      'Dans l’éditeur, ouvre « Écrire la séance en texte ».',
      'Écris par exemple : « 15\' + 10×400m Z5 R1\' + 10\' » (course) ou « 4×10 presse 60kg R2\' » (musculation).',
      'Vérifie l’aperçu, puis crée les blocs ; tu peux les retoucher ensuite.',
    ],
  },
  {
    slug: 'planifier-semaine', audience: 'coach', theme: 'Séances',
    title: 'Planifier et publier la semaine',
    summary: 'Déplacer, copier, annuler, et ce que voit l’élève après publication.',
    keywords: 'calendrier semaine planifier publier deplacer glisser copier coller annuler republier semaines a preparer',
    steps: [
      'Calendrier › choisis l’élève : sa semaine s’affiche.',
      'Glisse une séance d’un jour à l’autre ; copie-colle-la sur un autre jour ; « Annuler » défait le dernier geste.',
      'Publie : l’élève reçoit la séance sur son téléphone.',
    ],
    tips: [
      'Une séance déjà publiée qu’on déplace attend d’être republiée : l’élève ne voit rien changer avant.',
      '« Semaines à préparer » liste les élèves dont la semaine prochaine est vide.',
    ],
    links: [{ label: 'Calendrier', to: 'calendar' }, { label: 'Semaines à préparer', to: 'to-plan' }],
  },
  {
    slug: 'bibliotheque', audience: 'coach', theme: 'Séances',
    title: 'Séances types, exercices et vidéos',
    summary: 'Réutiliser tes séances, tenir ta liste d’exercices et filmer tes propres démonstrations.',
    keywords: 'bibliotheque seance type modele exercice video filmer demonstration machine basic-fit importer',
    steps: [
      'Bibliothèque › Séances types : garde une séance pour la réutiliser chez n’importe quel élève.',
      'Exercices : consignes, matériel et vidéo de chaque exercice.',
      '« Ajouter ma vidéo (filmée au téléphone) » : une minute au plus (50 Mio) ; seuls toi et tes élèves la voient.',
    ],
    tips: ['Les exercices sur machine ont une animation dessinée ; l’élève la voit pendant sa séance.'],
    links: [{ label: 'Séances types', to: 'library' }, { label: 'Exercices', to: 'exercises' }],
  },

  // ---------- Coach · Suivi ----------
  {
    slug: 'retours', audience: 'coach', theme: 'Suivi',
    title: 'Traiter les retours de tes élèves',
    summary: 'Lire ce que l’élève a réalisé, lui répondre et marquer le retour traité.',
    keywords: 'retour feedback boite reception traiter repondre ressenti realise message',
    steps: [
      'Boîte de réception › Retours à traiter.',
      'Ouvre un retour : séance prévue, ce qu’il a fait, son ressenti.',
      'Réponds si besoin, puis marque-le traité.',
    ],
    tips: ['Les messages de tes élèves et tes notifications sont dans la même Boîte de réception.'],
    links: [{ label: 'Retours à traiter', to: 'review' }],
  },
  {
    slug: 'suivi-eleve', audience: 'coach', theme: 'Suivi',
    title: 'Ce que vit ton élève pendant la séance',
    summary: 'Le mode « Suivre la séance » : chrono, pause, écran entre deux exercices, machine prise.',
    keywords: 'suivre seance chrono minuterie pause eleve telephone voix bips machine prise remplacement',
    steps: [
      'Sur sa séance du jour, l’élève touche « Suivre la séance », puis « C’est parti ».',
      'Chaque étape s’affiche en grand, avec son chrono, des bips et une voix.',
      'Entre deux exercices, un écran attend qu’il soit prêt ; il peut mettre en pause à tout moment.',
      '« Machine prise ? » propose un autre ordre ou un remplacement, repris dans son retour.',
    ],
  },

  // ---------- Coach · Compte ----------
  {
    slug: 'abonnement', audience: 'coach', theme: 'Compte et données',
    title: 'Abonnement et essai',
    summary: 'Où voir ton offre, tes élèves actifs et, quand les abonnements seront ouverts, payer.',
    keywords: 'abonnement offre prix tarif essai gratuit paiement payer carte bancaire cb facture eleves actifs limite pilote',
    steps: [
      'Paramètres › Abonnement (propriétaire de l’espace).',
      'Tu y vois ta situation (phase pilote gratuite, essai, offre) et tes élèves actifs.',
    ],
    tips: [
      'Un élève actif a accepté son invitation et n’est pas archivé ; tes élèves ne paient rien.',
      'Pendant la phase pilote, CoachOS est gratuit et sans limite ; tu seras prévenu avant toute facturation.',
    ],
    links: [{ label: 'Abonnement', to: 'settings?onglet=abonnement' }],
  },
  {
    slug: 'donnees-coach', audience: 'coach', theme: 'Compte et données',
    title: 'Tes données et celles de tes élèves',
    summary: 'Exporter, demander l’effacement, effacer le dossier d’un élève.',
    keywords: 'donnees rgpd export telecharger effacer supprimer confidentialite vie privee',
    steps: [
      'Paramètres › Mes données : exporte tout ce que tu peux lire dans l’espace, ou demande l’effacement.',
      'Pour un élève qui part : dans son dossier, onglet Données (propriétaire), effacement définitif.',
    ],
    links: [{ label: 'Mes données', to: 'settings?onglet=donnees' }, { label: 'Confidentialité', to: '/confidentialite' }],
  },
  {
    slug: 'mode-sombre', audience: 'coach', theme: 'Compte et données',
    title: 'Passer en mode sombre',
    summary: 'Clair ou sombre en un geste, gardé sur cet appareil.',
    keywords: 'mode sombre clair theme apparence nuit noir fonce couleurs ecran',
    steps: [
      'Touche ton avatar : en bas à gauche sur ordinateur, en haut à droite sur téléphone.',
      'Active ou coupe l’interrupteur « Mode sombre ».',
    ],
    tips: ['« Automatique » (comme ton ordinateur ou ton téléphone) se choisit dans Mon compte › Apparence.'],
    links: [{ label: 'Mon compte', to: '/profile' }],
  },

  // ---------- Élève ----------
  {
    slug: 'installer', audience: 'athlete', theme: 'Démarrer',
    title: 'Installer CoachOS sur ton téléphone',
    summary: 'Une icône sur ton écran d’accueil, et ta séance en un toucher.',
    keywords: 'installer application telephone iphone android icone ecran accueil notification actualiser',
    steps: [
      'Sur iPhone : ouvre CoachOS dans Safari, touche le bouton Partager, puis « Sur l’écran d’accueil ».',
      'Sur Android : dans Chrome, touche « Installer l’application » (ou le menu ⋮, puis « Ajouter à l’écran d’accueil »).',
      'Ouvre ensuite CoachOS depuis sa nouvelle icône.',
    ],
    tips: ['Lien ouvert dans WhatsApp ou Instagram : ouvre-le d’abord dans Safari ou Chrome.', 'Tire la page vers le bas pour l’actualiser.'],
    links: [{ label: 'Aujourd’hui', to: 'today' }],
  },
  {
    slug: 'suivre-seance', audience: 'athlete', theme: 'Ma séance',
    title: 'Suivre ta séance pas à pas',
    summary: 'Le chrono, les bips, la pause, l’écran entre deux exercices.',
    keywords: 'suivre seance chrono minuterie pause reprendre quitter exercice suivant passer machine prise',
    steps: [
      'Aujourd’hui › ta séance › « Suivre la séance », puis « C’est parti ».',
      'Chaque étape s’affiche en grand ; le chrono part après 5 secondes pour te mettre en place.',
      'Le bouton pause, en bas, arrête tout ; « Reprendre » te redonne 5 secondes.',
      'Entre deux exercices, prends ton temps : touche « C’est parti » quand tu es prêt·e.',
      'À la fin, « Donner mon retour ».',
    ],
    tips: [
      '« Quitter » met la séance en pause : « Reprendre la séance » la retrouve où tu l’avais laissée.',
      'Machine prise : « Machine prise ? » te propose un autre ordre ou un remplacement.',
      'Le « Déroulé » (en haut) montre toutes les étapes et permet d’aller à l’une d’elles.',
    ],
    links: [{ label: 'Aujourd’hui', to: 'today' }],
  },
  {
    slug: 'son-voix', audience: 'athlete', theme: 'Ma séance',
    title: 'Pas de bips ni de voix ?',
    summary: 'Les réglages à vérifier quand ta séance reste muette.',
    keywords: 'son bips voix muet silencieux volume iphone ecran veille allume',
    steps: [
      'Sur iPhone, vérifie le bouton silencieux sur le côté : en mode silencieux, les bips ne sortent pas.',
      'Monte le volume pendant la séance.',
      'En haut de l’écran de suivi, « Bips » et « Voix » doivent être allumés.',
    ],
    tips: ['L’écran reste allumé pendant la séance quand le téléphone le permet ; touche l’écran s’il s’éteint.'],
  },
  {
    slug: 'retour', audience: 'athlete', theme: 'Ma séance',
    title: 'Dire à ton coach ce que tu as fait',
    summary: 'Ton retour en moins d’une minute : fait, ressenti, et ce qui a changé.',
    keywords: 'retour feedback ressenti fait pas faite duree charges series coach',
    steps: [
      'Après ta séance (ou depuis Aujourd’hui) : « Donner mon retour ».',
      'Dis si tu l’as faite, comme prévu ou non, ton ressenti, et ajoute un mot si tu veux.',
      'Les séries notées pendant le suivi sont reprises ; la durée vient du chrono.',
    ],
    tips: ['Ton coach reçoit ton retour aussitôt.'],
  },
  {
    slug: 'messages', audience: 'athlete', theme: 'Mon coach',
    title: 'Écrire à ton coach',
    summary: 'Un message écrit ou vocal, quand tu veux.',
    keywords: 'message ecrire coach vocal discussion question echanges',
    steps: ['Échanges › ta conversation avec ton coach.', 'Écris, ou garde le micro appuyé pour un message vocal.'],
    links: [{ label: 'Échanges', to: 'messages' }],
  },
  {
    slug: 'profil', audience: 'athlete', theme: 'Mon coach',
    title: 'Ton profil et ton bilan',
    summary: 'Ce que tu as dit à ton coach à ton arrivée, et comment le mettre à jour.',
    keywords: 'profil bilan questionnaire niveau objectif disponibilites materiel',
    steps: ['Touche ta photo en haut à droite.', 'Mets à jour ton bilan quand ta situation change : ton coach le voit.'],
    links: [{ label: 'Mon profil', to: 'setup' }],
  },
  {
    slug: 'mode-sombre', audience: 'athlete', theme: 'Mon coach',
    title: 'Passer en mode sombre',
    summary: 'Clair ou sombre en un geste, gardé sur ce téléphone.',
    keywords: 'mode sombre clair theme apparence nuit noir fonce couleurs ecran lune soleil',
    steps: ['Touche la lune en haut de l’écran : l’app passe en sombre.', 'Le soleil, au même endroit, la remet en clair.'],
    tips: ['« Automatique » (comme ton téléphone) se choisit dans ton profil : touche ta photo, puis Apparence.'],
    links: [{ label: 'Mon profil', to: 'setup' }],
  },
  {
    slug: 'donnees', audience: 'athlete', theme: 'Mon coach',
    title: 'Tes données',
    summary: 'Télécharger ce que CoachOS garde sur toi, ou demander l’effacement.',
    keywords: 'donnees rgpd export telecharger effacer supprimer confidentialite',
    steps: ['Mon compte › Mes données : télécharge tes données, ou demande leur effacement.'],
    links: [{ label: 'Mon compte', to: '/profile' }, { label: 'Confidentialité', to: '/confidentialite' }],
  },
];

/** Minuscules, sans accents ni ponctuation : « Écrire » et « ecrire » se trouvent pareil. */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Recherche : chaque mot tapé doit se trouver quelque part ; le titre compte plus que les mots-clés, eux-mêmes plus
 * que le texte. Sans recherche, l’ordre des thèmes.
 */
export function searchHelp(query: string, audience: HelpAudience, list: readonly HelpArticle[] = HELP_ARTICLES): HelpArticle[] {
  const mine = list.filter((a) => a.audience === audience);
  const words = fold(query).split(' ').filter((w) => w.length > 1);
  if (!words.length) return mine;
  const scored = mine.map((a, i) => {
    const title = fold(a.title);
    const keys = fold(`${a.keywords} ${a.theme}`);
    const text = fold([a.summary, ...(a.steps ?? []), ...(a.tips ?? [])].join(' '));
    let score = 0;
    for (const w of words) {
      const s = (title.includes(w) ? 6 : 0) + (keys.includes(w) ? 3 : 0) + (text.includes(w) ? 1 : 0);
      if (!s) return { a, i, score: -1 };
      score += s;
    }
    return { a, i, score };
  });
  return scored.filter((x) => x.score > 0).sort((x, y) => y.score - x.score || x.i - y.i).map((x) => x.a);
}

export const helpArticle = (audience: HelpAudience, slug: string) => HELP_ARTICLES.find((a) => a.audience === audience && a.slug === slug) ?? null;

/** Lien d’un article vers l’app : chemin de l’espace, ou chemin absolu. */
export const helpHref = (base: string, to: string) => (to.startsWith('/') ? to : `${base}/${to}`);
