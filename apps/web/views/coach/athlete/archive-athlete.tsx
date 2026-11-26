'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { mutate, newKey } from '@/components/api-client';
import { Banner, Button, Cluster, Stack, Text } from '@/design';

const url = (wid: string, aid: string) => `/api/v1/workspaces/${wid}/athletes/${aid}/archive`;

/**
 * Bilan produit · « Retirer de ma liste » : un toucher, sans fenêtre de confirmation ; « Annuler » s’affiche ensuite sur la
 * liste des élèves. Rien n’est effacé (l’effacement définitif reste dans l’onglet Données).
 */
export function ArchiveAthlete({ wid, aid, first }: { wid: string; aid: string; first: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function archive() {
    setBusy(true);
    const r = await mutate('POST', url(wid, aid), {}, newKey());
    setBusy(false);
    if (r.ok) router.push(`/coach/${wid}/athletes?retire=${aid}`); else setFailed(true);
  }
  return (
    <Stack gap={2}>
      {failed ? <Banner tone="danger">Le retrait n’a pas abouti. Réessaie ; si cela persiste, recharge la page.</Banner> : null}
      <Cluster><Button variant="ghost" icon="trash" loading={busy} onClick={() => void archive()}>Retirer {first} de ma liste</Button></Cluster>
      <Text size="sm" muted>{first} disparaît de tes listes et n’accède plus à ton espace ; ses séances et retours sont gardés. Tu pourras annuler juste après, ou le rétablir plus tard.</Text>
    </Stack>
  );
}

/** « Annuler » juste après un retrait, ou « Rétablir » depuis la liste des élèves retirés. */
export function RestoreAthlete({ wid, aid, label, variant = 'secondary' }: { wid: string; aid: string; label: string; variant?: 'secondary' | 'ghost' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function restore() {
    setBusy(true);
    const r = await mutate('DELETE', url(wid, aid), {}, newKey());
    setBusy(false);
    if (r.ok) router.replace(`/coach/${wid}/athletes/${aid}`);
    else setError(r.kind === 'error' ? r.message : 'Pas de réseau : réessaie dans un instant.');
  }
  return (
    <Stack gap={1}>
      <Cluster><Button size="sm" variant={variant} loading={busy} onClick={() => void restore()}>{label}</Button></Cluster>
      {error ? <Text size="sm" tone="danger">{error}</Text> : null}
    </Stack>
  );
}
