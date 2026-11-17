import { createHash, createHmac, randomBytes } from 'node:crypto';
import { normalizeEmail } from '@coachos/domain';

/** Jeton d’invitation : 32 octets aléatoires, envoyés une seule fois, jamais stockés ni journalisés. */
export function newInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

const DEV_KEY = 'coachos-dev-only-invitation-hmac-key';

function hmacKey(): string {
  const key = process.env.COACHOS_INVITE_HMAC_KEY;
  if (key && key.length >= 32) return key;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('COACHOS_INVITE_HMAC_KEY (32 caractères ou plus) est requis en production');
  }
  return DEV_KEY;
}

/** Empreinte de l’adresse invitée : permet de vérifier l’identité sans stocker l’e-mail en clair. */
export function emailHmac(email: string): Buffer {
  return createHmac('sha256', hmacKey()).update(normalizeEmail(email)).digest();
}
