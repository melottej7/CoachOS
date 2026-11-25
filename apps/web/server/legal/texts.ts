import type { NoticeSection } from '../privacy/notice';
import { billingEnabled, trialDays } from '../offers';

/**
 * D-174 · Conditions d’utilisation et mentions légales de CoachOS.
 * BROUILLON À FAIRE RELIRE PAR UN PROFESSIONNEL (D-120) avant l’ouverture des abonnements : le texte décrit ce que le
 * code fait réellement ; le droit applicable et l’identité de l’éditeur sont à confirmer par le fondateur.
 */

export const TERMS_VERSION = '1 · 25 novembre 2026';

type Env = Record<string, string | undefined>;

export function termsSections(env: Env = process.env): NoticeSection[] {
  const billing = billingEnabled(env);
  return [
    {
      id: 'objet',
      title: 'Ce que couvrent ces conditions',
      paragraphs: [
        'CoachOS est un outil en ligne qui permet à un coach sportif de préparer les séances de ses élèves, de lire leurs retours et d’échanger avec eux. Ces conditions s’appliquent à chaque compte, coach ou élève.',
        'Créer un compte ou l’utiliser vaut acceptation de ces conditions et de la politique de confidentialité.',
      ],
    },
    {
      id: 'comptes',
      title: 'Les comptes',
      paragraphs: ['Un coach crée son compte lui-même. Un élève reçoit une invitation de son coach et crée son compte depuis ce lien.'],
      items: [
        'Ton adresse e-mail et ton mot de passe sont personnels : ne les partage pas.',
        'Les informations de ton compte doivent être exactes ; tu peux les corriger à tout moment depuis ton profil.',
        'En cas d’accès suspect, change ton mot de passe et préviens l’opérateur.',
      ],
    },
    {
      id: 'coach',
      title: 'Le rôle du coach et celui de CoachOS',
      paragraphs: [
        'Le coach décide des séances, des conseils et des messages qu’il adresse à ses élèves, et des données qu’il leur demande : il en est responsable. CoachOS fournit l’outil, ne prescrit rien et ne donne aucun avis médical.',
        'Rien n’est publié ni envoyé à un élève sans une action explicite de son coach.',
        'Le sport comporte des risques. En cas de douleur, de malaise ou de doute sur ta santé, arrête et consulte un professionnel de santé. CoachOS ne recueille aucune donnée de santé : n’y dépose pas de certificat, de diagnostic ni de résultat médical.',
      ],
    },
    {
      id: 'usage',
      title: 'Ce qui n’est pas permis',
      paragraphs: ['Utiliser CoachOS pour :'],
      items: [
        'déposer un contenu illicite, haineux, ou qui porte atteinte aux droits d’autrui (images, vidéos, textes dont tu n’as pas les droits) ;',
        'inviter une personne sans son accord ou lui écrire contre sa volonté ;',
        'tenter d’accéder aux données d’un autre espace, de contourner les limites ou de perturber le service.',
      ],
    },
    {
      id: 'contenus',
      title: 'Tes contenus',
      paragraphs: [
        'Le coach reste propriétaire de ses séances, programmes, textes et vidéos ; l’élève, de ses retours et messages. CoachOS les héberge et les affiche aux seules personnes autorisées de l’espace, sans autre usage.',
      ],
    },
    {
      id: 'service',
      title: 'Disponibilité',
      paragraphs: [
        'CoachOS fait le nécessaire pour que le service reste disponible et que les données soient sauvegardées, sans pouvoir garantir une disponibilité continue. Une interruption pour maintenance est annoncée quand c’est possible. Les séances déjà ouvertes sur le téléphone restent lisibles hors connexion.',
      ],
    },
    {
      id: 'offres',
      title: 'Prix et abonnement',
      paragraphs: billing
        ? [
          `Les offres, leurs prix hors taxes et leur nombre d’élèves actifs sont affichés sur la page Offres. Chaque nouvel espace commence par un essai gratuit de ${trialDays(env)} jours, sans carte bancaire. Les élèves ne paient rien.`,
          'L’abonnement est mensuel, payé d’avance par le coach, et se résilie à tout moment : il prend fin au terme de la période payée. Un changement de prix est annoncé au moins 30 jours à l’avance et ne s’applique qu’à la période suivante.',
          'En cas de paiement manqué, l’espace reste ouvert 14 jours ; ensuite le coach garde la lecture et l’export de ses données, et ses élèves l’accès à leur historique. Un impayé ne supprime rien.',
        ]
        : ['Pendant la phase pilote, CoachOS est gratuit. Avant toute facturation, les offres, leurs prix et ces conditions seront publiés, et chaque coach en sera prévenu : rien ne sera facturé sans son accord. Les élèves ne paient rien.'],
    },
    {
      id: 'fin',
      title: 'Partir avec tes données',
      paragraphs: [
        'Tu peux à tout moment exporter tes données ou demander l’effacement de ton compte depuis ton profil (rubrique « Mes données »). Les règles de conservation sont détaillées dans la politique de confidentialité.',
        'Un compte qui enfreint ces conditions peut être suspendu, après un avertissement sauf urgence ; ses données restent exportables.',
      ],
    },
    {
      id: 'responsabilite',
      title: 'Responsabilité',
      paragraphs: [
        'CoachOS répond des fautes qui lui sont imputables dans la fourniture de l’outil. Il ne répond pas du contenu des séances et des conseils du coach, ni de la pratique sportive de l’élève. Rien dans ces conditions ne limite les droits que la loi reconnaît aux consommateurs.',
      ],
    },
    {
      id: 'changements',
      title: 'Changements et droit applicable',
      paragraphs: [
        'Ces conditions peuvent évoluer ; la version en vigueur est datée en haut de cette page et tout changement important est annoncé dans l’application avant de s’appliquer.',
        'Ces conditions sont soumises au droit belge. En cas de litige, une solution amiable est recherchée d’abord ; à défaut, les tribunaux compétents sont ceux du siège de l’éditeur, sans préjudice des règles protectrices du consommateur.',
      ],
    },
  ];
}

export interface Imprint {
  /** Lignes saisies par le fondateur (nom ou société, adresse, numéro d’entreprise), ou null tant qu’elles manquent. */
  publisher: string[] | null;
  contact: string | null;
}

/** Identité de l’éditeur : `COACHOS_LEGAL_PUBLISHER`, lignes séparées par « | » (ex. « Nom | Rue 1, 1000 Bruxelles | BCE 0123.456.789 »). */
export function imprint(env: Env = process.env): Imprint {
  const lines = (env.COACHOS_LEGAL_PUBLISHER ?? '').split('|').map((l) => l.trim()).filter(Boolean).slice(0, 6);
  const contact = (env.COACHOS_CONTACT_EMAIL ?? '').trim();
  return { publisher: lines.length ? lines : null, contact: contact.includes('@') ? contact : null };
}

export const HOSTS: { name: string; role: string; site: string }[] = [
  { name: 'Vercel Inc.', role: 'Hébergement de l’application (serveurs en Irlande, Dublin)', site: 'https://vercel.com' },
  { name: 'Supabase Inc.', role: 'Base de données, comptes et fichiers (Irlande)', site: 'https://supabase.com' },
  { name: 'Resend', role: 'Envoi des e-mails (invitations, mot de passe)', site: 'https://resend.com' },
];
