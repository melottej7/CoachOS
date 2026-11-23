import { z } from 'zod';
import { notificationText, type NotificationKind, type NotificationRole } from './notifications';

/**
 * D-118 · Rappels push (Web Push). Un abonnement = un appareil (navigateur) dans un espace. Le rappel reprend la phrase
 * de la notification, sans contenu de message, et ouvre l’écran utile par le résolveur (/n/…), qui revérifie les droits.
 */

/** Types poussés sur l’appareil, selon le rôle du destinataire. */
export const PUSH_KINDS: Record<NotificationRole, NotificationKind[]> = {
  athlete: ['workouts_published', 'message', 'group_message'],
  coach: ['message', 'feedback', 'bilan_submitted', 'group_message'],
};

const https = (u: string) => u.startsWith('https://');

export const pushSubscriptionSchema = z
  .object({
    endpoint: z.string().trim().max(2000).refine(https, { message: 'Adresse de notification invalide' }),
    keys: z.object({ p256dh: z.string().min(1).max(300), auth: z.string().min(1).max(100) }).strict(),
  })
  .strict();

export const pushUnsubscribeSchema = z.object({ endpoint: z.string().trim().min(1).max(2000) }).strict();

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** Contenu d’un rappel : le titre de l’app, la phrase de la notification, le lien à ouvrir. Rien d’autre. */
export function pushPayload(kind: NotificationKind, role: NotificationRole, o: { athleteName?: string | null; count?: number; teamName?: string | null; url: string }): PushPayload {
  return { title: 'CoachOS', body: notificationText(kind, role, o), url: o.url, tag: kind };
}
