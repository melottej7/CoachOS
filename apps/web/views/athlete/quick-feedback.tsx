'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { INTENT_LABELS, intentOfRpe, QUICK_EFFORTS, quickFeedbackBody, type Intent, type ResultState } from '@coachos/domain';
import { Badge, Banner, Button, Cluster, Grid, Stack, Text } from '@/design';
import { useIntent } from '@/components/use-intent';

/**
 * Retour en 15 secondes (CE-C-03, D-039 ; refonte D-129) : Faite / En partie / Pas faite, puis le ressenti,
 * comparé à l’intention de la séance. « Pas faite » part tout de suite. Le détail reste facultatif.
 */
export function QuickFeedback({ wid, aid, sid, revision, intent, detailHref, when }: {
  wid: string; aid: string; sid: string; revision: number; intent: Intent | null; detailHref: string; when: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<ResultState | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const { run, pending, error } = useIntent<{ item: { id: string } }>();

  async function send(s: ResultState, rpe: number | null, key: string) {
    setSending(key);
    const ok = await run('PUT', `/api/v1/workspaces/${wid}/athletes/${aid}/workouts/${sid}/feedback`, quickFeedbackBody(revision, s, rpe));
    setSending(null);
    if (ok) router.refresh();
  }

  return (
    <Stack gap={3} aria-live="polite">
      {state === null ? (
        <Stack gap={2}>
          <Text strong size="md">Ta séance {when} ?</Text>
          <Grid cols={3} gap={2}>
            <Button size="lg" icon="check" disabled={pending} onClick={() => setState('completed')}>Faite</Button>
            <Button size="lg" icon="half" disabled={pending} onClick={() => setState('partial')}>En partie</Button>
            <Button size="lg" icon="close" loading={sending === 'missed'} disabled={pending} onClick={() => void send('missed', null, 'missed')}>Pas faite</Button>
          </Grid>
        </Stack>
      ) : (
        <Stack gap={2}>
          <Cluster between align="baseline">
            <Text strong size="md">Comment l’as-tu ressentie ?</Text>
            {intent ? <Text size="sm" muted>visé : séance {INTENT_LABELS[intent]}</Text> : null}
          </Cluster>
          <Grid min={96} gap={2}>
            {QUICK_EFFORTS.map((e) => (
              <Button key={e.rpe} size="lg" variant={intent && intentOfRpe(e.rpe) === intent ? 'coach' : 'secondary'} loading={sending === String(e.rpe)} disabled={pending}
                onClick={() => void send(state, e.rpe, String(e.rpe))}>{e.label}</Button>
            ))}
          </Grid>
          <Cluster between>
            <Button variant="ghost" size="sm" icon="chevronLeft" disabled={pending} onClick={() => setState(null)}>Retour</Button>
            <Button variant="ghost" size="sm" loading={sending === 'none'} disabled={pending} onClick={() => void send(state, null, 'none')}>Envoyer sans ressenti</Button>
          </Cluster>
        </Stack>
      )}
      {error ? (
        <Banner tone="danger" title={error.kind === 'error' ? error.message : 'Connexion perdue.'}>
          Ta réponse n’est pas partie. Réessaie, ou <Link href={detailHref}>ouvre le retour complet</Link>.
        </Banner>
      ) : null}
      <Text size="sm" muted><Link href={detailHref}>Raconter en détail</Link> : durée, distance, ce qui a changé, un mot pour ton coach.</Text>
    </Stack>
  );
}

/** Retour déjà envoyé : rappel du ressenti par rapport à l’intention, et lien pour compléter. */
export function FeedbackSent({ stateLabel, gap, intent, detailHref }: { stateLabel: string; gap: -1 | 0 | 1 | null; intent: Intent | null; detailHref: string }) {
  const gapText = gap === null || !intent ? null : gap < 0 ? 'Plus facile que prévu.' : gap > 0 ? 'Plus dur que prévu : ton coach le verra.' : 'Ressenti conforme à l’objectif.';
  return (
    <Banner tone="success" title={<Cluster gap={2}><span>Retour envoyé</span><Badge tone="success">{stateLabel}</Badge></Cluster>}
      action={<Link href={detailHref}>Compléter</Link>}>
      {gapText ? `${gapText} (visé : séance ${INTENT_LABELS[intent!]})` : 'Ton coach le verra dans sa boîte de réception.'}
    </Banner>
  );
}
