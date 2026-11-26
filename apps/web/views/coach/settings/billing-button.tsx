'use client';

import { useState } from 'react';
import { mutate, newKey } from '@/components/api-client';
import { Button, Text, type IconName } from '@/design';

/**
 * D-188 · Bouton qui ouvre une page de Stripe (paiement ou portail client) : CoachOS demande l’adresse au serveur, puis
 * le navigateur s’y rend. La carte se saisit chez Stripe, jamais dans CoachOS.
 */
export function BillingButton({ wid, kind, offer, children, variant = 'primary', icon }: {
  wid: string; kind: 'checkout' | 'portal'; offer?: string; children: React.ReactNode; variant?: 'primary' | 'coach' | 'secondary' | 'ghost'; icon?: IconName;
}) {
  const [state, setState] = useState<'idle' | 'busy'>('idle');
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setState('busy'); setError(null);
    const r = await mutate<{ url: string }>('POST', `/api/v1/workspaces/${wid}/billing/${kind}`, kind === 'checkout' ? { offer } : {}, newKey());
    if (r.ok) { window.location.assign(r.data.url); return; }
    setError(r.kind === 'error' ? r.message : 'Connexion perdue. Réessaie.');
    setState('idle');
  }
  return (
    <span>
      <Button variant={variant} icon={icon} loading={state === 'busy'} disabled={state === 'busy'} onClick={() => void go()}>{children}</Button>
      {error ? <Text size="sm" role="alert">{error}</Text> : null}
    </span>
  );
}
