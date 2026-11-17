'use client';

import { useCallback, useRef, useState } from 'react';
import { mutate, newKey, type MutationResult } from './api-client';

export type IntentError = Exclude<MutationResult<unknown>, { ok: true }>;

/**
 * Une intention utilisateur = une Idempotency-Key.
 * - réseau coupé ou 503 : la clé est conservée, « Réessayer » rejoue sans doublon ;
 * - erreur définitive (4xx) : nouvelle clé, car la saisie corrigée sera un autre contenu ;
 * - double clic : ignoré tant que la requête est en cours.
 */
export function useIntent<T>() {
  const keyRef = useRef(newKey());
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<IntentError | null>(null);

  const run = useCallback(async (method: 'POST' | 'PUT' | 'PATCH', url: string, body: unknown): Promise<T | null> => {
    if (busy.current) return null;
    busy.current = true;
    setPending(true);
    setError(null);
    const result = await mutate<T>(method, url, body, keyRef.current);
    busy.current = false;
    setPending(false);
    if (result.ok) {
      keyRef.current = newKey();
      return result.data;
    }
    const retryable = result.kind === 'network' || result.status === 503;
    if (!retryable) keyRef.current = newKey();
    setError(result);
    return null;
  }, []);

  return { run, pending, error, setError };
}

export function fieldError(error: IntentError | null, path: string): string | undefined {
  if (!error || error.kind !== 'error') return undefined;
  return error.fields.find((f) => f.path === path || f.path.startsWith(path + '.'))?.rule;
}
