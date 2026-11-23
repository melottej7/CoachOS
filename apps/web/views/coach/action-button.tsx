'use client';

import type { ReactNode } from 'react';
import { Button, Text, type ButtonSize, type ButtonVariant, type IconName } from '@/design';
import { useAction } from '@/views/coach/use-action';

type Method = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Geste simple (archiver, retirer, déplacer…) : une intention idempotente, une confirmation si demandée, puis la page se relit. */
export function ActionButton({ method, url, body, children, confirm, label, variant = 'ghost', size = 'sm', icon }: {
  method: Method; url: string; body?: unknown; children: ReactNode; confirm?: string; label?: string; variant?: ButtonVariant; size?: ButtonSize; icon?: IconName;
}) {
  const { act, pending, error } = useAction();
  return (
    <>
      <Button variant={variant} size={size} icon={icon} loading={pending} aria-label={label}
        onClick={() => { if (confirm && !window.confirm(confirm)) return; void act(method, url, body ?? {}); }}>
        {children}
      </Button>
      {error ? <Text as="span" size="sm" tone="danger" role="alert">{error.kind === 'error' ? error.fields[0]?.rule ?? error.message : 'Connexion perdue. Réessaie.'}</Text> : null}
    </>
  );
}
