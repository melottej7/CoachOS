/**
 * D-115 · Politique de confidentialité de CoachOS, version unique pour tous les espaces (texte en code, versionné).
 * Décrit ce que le code fait réellement : rien de plus, rien de moins. À relire par le fondateur avant de vrais élèves.
 * Les tables privacy_notices et privacy_notice_views du contrat restent réservées à un texte propre à chaque espace.
 */

export const PRIVACY_VERSION = '1 · 23 novembre 2026';

export interface NoticeSection {
  id: string;
  title: string;
  paragraphs: string[];
  items?: string[];
}

/** Adresse de contact de l’opérateur (réglage du serveur), sinon le contact passe par le coach. */
export function privacyContact(): string | null {
  const v = (process.env.COACHOS_CONTACT_EMAIL ?? '').trim();
  return v.includes('@') ? v : null;
}

export const PRIVACY_SECTIONS: NoticeSection[] = [
  {
    id: 'qui',
    title: 'Qui traite tes données',
    paragraphs: [
      'CoachOS est un outil utilisé par ton coach pour préparer tes séances, lire tes retours et échanger avec toi. Ton coach est responsable des données de son espace : c’est lui qui décide de ce qu’il te demande et qui répond à tes questions sur tes données.',
      'CoachOS héberge et fait fonctionner l’outil pour le compte de ton coach. L’équipe technique n’ouvre tes données que pour résoudre un problème ou à la demande de ton coach, jamais pour autre chose.',
    ],
  },
  {
    id: 'donnees',
    title: 'Les données que CoachOS garde',
    paragraphs: ['Uniquement ce qui sert à ton suivi sportif :'],
    items: [
      'Ton compte : nom, adresse e-mail, mot de passe (chiffré, jamais lisible), langue, fuseau horaire.',
      'Ton profil sportif et ton bilan : sport, niveau, expérience, disponibilités, matériel, objectifs, contraintes pratiques, et les réponses que tu donnes à ton coach.',
      'Tes séances et tes retours : ce que ton coach prévoit, ce que tu as réalisé, durée, distance, effort perçu, ressenti, commentaires, séries et charges en musculation.',
      'Les fichiers de montre que tu importes toi-même : durée, distance et allure sont lus ; la fréquence cardiaque est ignorée.',
      'Tes échanges avec ton coach et ton groupe : messages écrits et vocaux (3 minutes au plus), rendez-vous, notifications.',
      'Un journal technique : qui a fait quelle action et quand, sans le contenu.',
    ],
  },
  {
    id: 'sante',
    title: 'Aucune donnée de santé',
    paragraphs: [
      'CoachOS ne te pose aucune question sur ta santé (douleur, blessure, aptitude, fréquence cardiaque maximale) et n’enregistre pas ces informations. Si tu en parles dans un message, elles restent dans l’échange avec ton coach et ne sont pas exploitées par l’outil.',
    ],
  },
  {
    id: 'pourquoi',
    title: 'Pourquoi',
    paragraphs: [
      'Pour que ton coach puisse te suivre : c’est la seule finalité. Pas de publicité, pas de revente, pas de profil commercial, pas de mesure d’audience. CoachOS n’utilise aucun traceur : seuls les cookies de session, nécessaires pour te reconnaître, sont posés.',
    ],
  },
  {
    id: 'acces',
    title: 'Qui voit tes données',
    paragraphs: ['Ton coach et les coachs qu’il affecte à ton suivi, et toi. Pour faire fonctionner l’outil, CoachOS s’appuie sur des prestataires qui n’utilisent ces données que pour ce service :'],
    items: [
      'Supabase (Irlande, Union européenne) : base de données et comptes.',
      'Vercel (serveurs à Dublin, Union européenne ; réseau mondial pour la diffusion des pages) : hébergement de l’application.',
      'Resend : envoi des e-mails (invitation, mot de passe oublié, notifications sans le contenu des messages).',
      'Anthropic (États-Unis) : uniquement si ton coach active l’assistant de programme. Il ne reçoit ni ton nom, ni ton adresse, ni tes messages : seulement le sport, la distance visée, ton niveau, le nombre de semaines et de jours d’entraînement.',
    ],
  },
  {
    id: 'duree',
    title: 'Combien de temps',
    paragraphs: [
      'Tant que ton compte est lié à l’espace de ton coach. Quand ton coach efface tes données, ou à ta demande, elles disparaissent de l’application ; les copies de sauvegarde sont renouvelées sous 30 jours.',
    ],
  },
  {
    id: 'droits',
    title: 'Tes droits',
    paragraphs: ['Depuis ton Profil dans l’espace de ton coach, section « Mes données » :'],
    items: [
      'Télécharger tes données (accès et portabilité) : un fichier lisible, immédiat.',
      'Corriger ton nom, ta langue, ton fuseau et ton bilan toi-même, à tout moment.',
      'Demander l’effacement : ton coach reçoit la demande et dispose de 30 jours pour effacer tes données. Si ton compte n’est lié à aucun autre espace, il est supprimé.',
      'T’opposer à un traitement ou le limiter : écris à ton coach ou à l’adresse de contact ci-dessous.',
    ],
  },
  {
    id: 'securite',
    title: 'Sécurité',
    paragraphs: [
      'Connexion chiffrée (https), mots de passe jamais stockés en clair, droits vérifiés dans la base pour chaque lecture, liens d’invitation signés et à usage unique, journal des actions sans contenu.',
    ],
  },
  {
    id: 'reclamation',
    title: 'Réclamation',
    paragraphs: [
      'Si tu estimes que tes données ne sont pas traitées correctement, parle-en d’abord à ton coach. Tu peux aussi saisir l’autorité de protection des données de ton pays (en Belgique, l’Autorité de protection des données ; en France, la CNIL).',
    ],
  },
];

/** Résumé court pour l’API (readNotice du contrat : body de 2000 caractères au plus). */
export function privacySummary(): string {
  const lines = [
    'CoachOS garde uniquement ce qui sert à ton suivi sportif : compte, profil et bilan, séances et retours, fichiers de montre importés, échanges avec ton coach, journal technique sans contenu.',
    'Aucune donnée de santé n’est demandée ni enregistrée. Aucune publicité, aucune revente, aucun traceur.',
    'Tes données sont vues par ton coach, les coachs qu’il affecte et toi. Prestataires : Supabase et Vercel (Union européenne), Resend (e-mails), Anthropic seulement si le coach active l’assistant, sans ton nom.',
    'Tu peux télécharger tes données, corriger ton profil et demander l’effacement depuis Profil › Mes données. Texte complet : /confidentialite.',
  ];
  const body = lines.join('\n');
  return body.length > 2000 ? body.slice(0, 2000) : body;
}
