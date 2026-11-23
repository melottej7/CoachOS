'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PRIVACY_REQUEST_KIND_LABELS, PRIVACY_REQUEST_STATE_LABELS } from '@coachos/domain';
import { useIntent } from '@/components/use-intent';
import type { PrivacyRequestView } from '@/components/privacy-panel';
import { Button, Cluster, Disclosure, Stack, Text } from '@/design';
import { ErrorSummary } from '@/views/error-summary';

const fmt = (iso: string) => new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));

/**
 * D-115, refonte Chrono (D-136) · « Mes données » de l’élève : export immédiat (accès et portabilité) et demande
 * d’effacement traitée par le coach sous 30 jours, après confirmation explicite.
 */
export function PrivacyPanel({ wid, requests }: { wid: string; requests: PrivacyRequestView[] }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ id: string; state: string; dueAt: string }>();
  const [downloading, setDownloading] = useState(false);
  const erasure = requests.find((r) => r.kind === 'erase' && (r.state === 'open' || r.state === 'verifying' || r.state === 'processing'));

  async function download() {
    setDownloading(true);
    const r = await run('POST', `/api/v1/workspaces/${wid}/privacy/requests`, { kind: 'portability' });
    setDownloading(false);
    if (!r) return;
    window.location.assign(`/api/v1/workspaces/${wid}/privacy/requests/${r.id}/download`);
    router.refresh();
  }

  async function askErasure() {
    if (!window.confirm('Demander l’effacement de tes données ? Ton coach reçoit la demande et dispose de 30 jours pour effacer ton dossier : séances, retours, échanges, bilan. Tu ne pourras pas les récupérer.')) return;
    const r = await run('POST', `/api/v1/workspaces/${wid}/privacy/requests`, { kind: 'erase' });
    if (r) router.refresh();
  }

  return (
    <Stack gap={3}>
      <ErrorSummary error={error} onRetry={() => void download()} />
      <Text size="sm" muted>Tu peux télécharger tout ce que CoachOS garde sur toi dans cet espace, ou demander à ton coach d’effacer ton dossier. <a href="/confidentialite">Politique de confidentialité</a>.</Text>
      <Cluster gap={2}>
        <Button icon="download" loading={downloading} disabled={pending} onClick={() => void download()}>{downloading ? 'Préparation…' : 'Télécharger mes données'}</Button>
        {erasure ? null : <Button variant="ghost" disabled={pending} onClick={() => void askErasure()}>Demander l’effacement</Button>}
      </Cluster>
      {erasure ? <Text size="sm">Effacement demandé le {fmt(erasure.createdAt)} · {PRIVACY_REQUEST_STATE_LABELS[erasure.state]} · réponse avant le {fmt(erasure.dueAt)}.</Text> : null}
      {requests.length ? (
        <Disclosure summary={`Mes demandes (${requests.length})`}>
          <Stack as="ul" gap={1}>
            {requests.map((r) => <li key={r.id}><Text size="sm" muted>{PRIVACY_REQUEST_KIND_LABELS[r.kind]} · {fmt(r.createdAt)} · {PRIVACY_REQUEST_STATE_LABELS[r.state]}</Text></li>)}
          </Stack>
        </Disclosure>
      ) : null}
    </Stack>
  );
}
