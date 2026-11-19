'use client';

import type { FieldError } from '@coachos/domain';

export type MutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: 'network' }
  | { ok: false; kind: 'error'; status: number; code: string; message: string; fields: FieldError[]; details: Record<string, unknown> | null };

/**
 * Appel de mutation /api/v1. L’appelant garde la même Idempotency-Key pour une intention
 * jusqu’au succès : une reprise après coupure réseau ne crée pas de doublon (C06-07).
 */
export async function mutate<T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body: unknown, idempotencyKey: string): Promise<MutationResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    return { ok: false, kind: 'network' };
  }
  const payload = (await res.json().catch(() => null)) as
    | (T & { error?: undefined })
    | { error: { code: string; message: string; fields?: FieldError[] | null; details?: Record<string, unknown> } }
    | null;
  if (res.ok && payload) return { ok: true, data: payload as T };
  const err = payload && 'error' in payload && payload.error ? payload.error : null;
  return {
    ok: false,
    kind: 'error',
    status: res.status,
    code: err?.code ?? 'TEMPORARILY_UNAVAILABLE',
    message: err?.message ?? 'Service momentanément indisponible. Réessaie.',
    fields: err?.fields ?? [],
    details: err?.details ?? null,
  };
}

export function newKey(): string {
  // randomUUID n’existe que sur une page sécurisée (https ou localhost) ; un téléphone qui ouvre l’adresse réseau
  // du Mac en http ne l’a pas (D-070). getRandomValues, lui, est toujours disponible : UUID v4 construit à la main.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
