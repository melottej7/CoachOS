import { z } from 'zod';

// Messagerie coach élève (CE-H-07, CE-E-02, D-033). Tout envoi reste explicite : jamais de message automatique.

export const sendMessageSchema = z
  .object({
    body: z
      .string({ message: 'Message : texte attendu' })
      .transform((v) => v.trim())
      .pipe(z.string().min(1, { message: 'Écris un message avant d’envoyer' }).max(2000, { message: 'Message : 2000 caractères au plus' })),
  })
  .strict();

export const receiptSchema = z.object({ messageId: z.uuid() }).strict();

/** Réponses rapides sous un retour (CE-H-08) : proposées au coach, envoyées seulement sur son geste. */
export const QUICK_REPLIES = [
  'Bravo ! 👏',
  'Bien joué, continue comme ça.',
  'Merci pour ton retour, j’ajuste la suite en conséquence.',
  'Bien noté. Écoute tes sensations et lève le pied si besoin.',
] as const;

/** Extrait d’un message pour une liste. */
export function excerpt(body: string, max = 90): string {
  const one = body.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one;
}

// ---------- Vocaux (CE-H-09) ----------

export const VOICE_MAX_BYTES = 3 * 1024 * 1024;
export const VOICE_MAX_SECONDS = 180;
export type VoiceType = 'audio/webm' | 'audio/ogg' | 'audio/mp4';

/** Format reconnu d’après les premiers octets (WebM/Matroska, Ogg, MP4/M4A), jamais d’après le type déclaré. */
export function detectAudioType(b: Uint8Array): VoiceType | null {
  if (b.length < 12) return null;
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'audio/webm';
  if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return 'audio/ogg';
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'audio/mp4';
  return null;
}

/** « 1:05 ». */
export function formatVoiceDuration(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
