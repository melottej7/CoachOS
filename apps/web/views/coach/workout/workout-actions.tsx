'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LIBRARY_CATEGORIES, LIBRARY_CATEGORY_LABELS, type LibraryCategory } from '@coachos/domain';
import { mutate, newKey } from '@/components/api-client';
import { useIntent } from '@/components/use-intent';
import { Button, Cluster, LinkButton, MenuItem, Popover, Stack, Text } from '@/design';
import { ErrorSummary } from '@/views/error-summary';

/** Publication explicite d’une révision précise (X22). Désactivé pendant l’envoi (double clic). */
export function PublishButton({ wid, aid, sid, revision, label }: { wid: string; aid: string; sid: string; revision: number; label: string }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ items: { id: string; revision: number }[] }>();
  async function publish() {
    const done = await run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/publications`, { changes: [{ id: sid, revision }] });
    if (done) { router.replace(`/coach/${wid}/athletes/${aid}/workouts/${sid}?notice=published`); router.refresh(); }
  }
  return (
    <Stack gap={3}>
      <ErrorSummary error={error} onRetry={() => void publish()} retryLabel="Réessayer la publication" />
      {error?.kind === 'error' && error.code === 'CONFLICT_OR_QUOTA' ? <Cluster><Button variant="ghost" onClick={() => router.refresh()}>Recharger la séance</Button></Cluster> : null}
      <Cluster><Button variant="primary" icon="send" loading={pending} onClick={() => void publish()}>{label}</Button></Cluster>
    </Stack>
  );
}

/** Ajouter la séance à la bibliothèque du coach (D-035), dans une catégorie. */
export function SaveToLibrary({ wid, aid, sid }: { wid: string; aid: string; sid: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  if (state === 'done') return <LinkButton href={`/coach/${wid}/library`} icon="check" size="sm">Dans la bibliothèque</LinkButton>;
  async function save(category: LibraryCategory) {
    setState('sending');
    const r = await mutate('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/workouts/${sid}/template`, { category }, newKey());
    setState(r.ok ? 'done' : 'error');
  }
  return (
    <>
      <Popover label="Ajouter à la bibliothèque" text="Ajouter à la bibliothèque" icon="library" align="start">
        {(close) => (
          <>
            <Text size="sm" muted>Dans quelle catégorie ?</Text>
            {LIBRARY_CATEGORIES.map((c) => <MenuItem key={c} disabled={state === 'sending'} onClick={() => { close(); void save(c); }}>{LIBRARY_CATEGORY_LABELS[c]}</MenuItem>)}
          </>
        )}
      </Popover>
      {state === 'error' ? <Text size="sm" tone="danger" role="alert">Ajout impossible. Réessaie.</Text> : null}
    </>
  );
}
