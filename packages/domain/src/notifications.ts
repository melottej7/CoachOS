import { z } from 'zod';

/**
 * Notifications (D-067, C25-01, C25-07, C25-08, C25-09, CE-E-06 en partie). Personnelles, sans contenu de message :
 * le type, l’objet et un nombre. Elles s’ouvrent sur l’écran utile après contrôle des droits au moment du clic.
 */

export const NOTIFICATION_KINDS = ['workouts_published', 'message', 'feedback', 'bilan_submitted'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export type NotificationRole = 'coach' | 'athlete';

/** Types envoyés aussi par e-mail avec le réglage « essentiels », selon le rôle du destinataire. */
export const EMAIL_KINDS: Record<NotificationRole, NotificationKind[]> = {
  athlete: ['workouts_published', 'message'],
  coach: ['message', 'feedback'],
};
/** Un seul e-mail par type et par personne dans cette fenêtre (C25-07) ; les suivants restent dans l’application. */
export const EMAIL_WINDOW_HOURS = 3;

export const EMAIL_PREFERENCES = ['essentials', 'none'] as const;
export type EmailPreference = (typeof EMAIL_PREFERENCES)[number];
export const EMAIL_PREFERENCE_LABELS: Record<EmailPreference, string> = {
  essentials: 'L’essentiel par e-mail (au plus un par type toutes les 3 heures)',
  none: 'Aucun e-mail : seulement dans l’application',
};
export const notificationSettingsSchema = z.object({ email: z.enum(EMAIL_PREFERENCES) }).strict();

/** Phrase de la notification, sans contenu de message (le coach ou l’élève l’ouvre dans l’application). */
export function notificationText(kind: NotificationKind, role: NotificationRole, o: { athleteName?: string | null; count?: number }): string {
  const n = o.count ?? 1;
  const who = o.athleteName ?? 'Ton élève';
  switch (kind) {
    case 'workouts_published': return n > 1 ? `Ton coach a publié ${n} séances` : 'Ton coach a publié une séance';
    case 'message': return role === 'athlete' ? 'Nouveau message de ton coach' : `Nouveau message de ${who}`;
    case 'feedback': return `${who} a envoyé un retour de séance`;
    case 'bilan_submitted': return `${who} a envoyé son bilan`;
  }
}

/** E-mail court : une phrase et un lien, jamais le texte d’un message ni une donnée de séance. */
export function notificationEmail(kind: NotificationKind, role: NotificationRole, o: { athleteName?: string | null; count?: number; workspaceName: string; link: string }): { subject: string; text: string } {
  const what = notificationText(kind, role, o);
  return {
    subject: `${what} · ${o.workspaceName}`,
    text: [`${what} dans l’espace « ${o.workspaceName} ».`, '', `Ouvrir CoachOS : ${o.link}`, '',
      'Tu reçois cet e-mail selon tes réglages de notifications (Profil ou Paramètres), modifiables à tout moment.'].join('\n'),
  };
}
