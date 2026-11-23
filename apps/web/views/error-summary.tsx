'use client';

import { useEffect, useRef } from 'react';
import { Banner, Button, Stack } from '@/design';
import { blockLabel, FIELD_IDS, FIELD_LABELS } from '@/components/feedback-banners';
import type { IntentError } from '@/components/use-intent';

/**
 * Résumé d’erreurs en tête de formulaire (refonte Chrono) : reçoit le focus à son apparition, chaque champ en cause
 * est un lien vers lui. Réseau coupé : la saisie reste en place et l’action se rejoue avec la même clé.
 */
export function ErrorSummary({ error, onRetry, retryLabel = 'Réessayer' }: { error: IntentError | null; onRetry?: () => void; retryLabel?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error) ref.current?.focus(); }, [error]);
  if (!error) return null;

  let body;
  if (error.kind === 'network' || error.status === 503) {
    body = (
      <Banner tone="warning" title="Connexion interrompue" action={onRetry ? <Button size="sm" onClick={onRetry}>{retryLabel}</Button> : null}>
        Ta saisie est conservée. Rien n’a été envoyé en double.
      </Banner>
    );
  } else if (error.code === 'AUTH_REQUIRED_OR_INVALID_SIGNATURE') {
    body = <Banner tone="danger" title="Session expirée">{error.message} <a href="/login">Se reconnecter</a>. Ta saisie reste dans cet onglet.</Banner>;
  } else {
    body = (
      <Banner tone="danger" title={error.code === 'INVALID_FIELDS' ? 'À corriger' : 'Action impossible'}>
        {error.fields.length ? (
          <Stack as="ul" gap={1}>
            {error.fields.map((f) => (
              <li key={f.path + f.rule}>
                <a href={`#${FIELD_IDS[f.path.split('.')[0]!] ?? FIELD_IDS[f.path] ?? ''}`}>{FIELD_LABELS[f.path] ?? blockLabel(f.path) ?? FIELD_LABELS[f.path.split('.')[0]!] ?? f.path}</a> : {f.rule}
              </li>
            ))}
          </Stack>
        ) : error.message}
      </Banner>
    );
  }
  return <div ref={ref} tabIndex={-1}>{body}</div>;
}
