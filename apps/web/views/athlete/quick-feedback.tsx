'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { INTENT_LABELS, intentOfRpe, QUICK_EFFORTS, quickFeedbackBody, type Intent, type ResultState } from '@coachos/domain';
import { Badge, Banner, Button, Cluster, Grid, Stack, Text } from '@/design';
import { useIntent } from '@/components/use-intent';

/**
 * Retour en 15 secondes (CE-C-03, D-039 ; refonte D-129) : Faite / En partie / Pas faite, puis le ressenti,
 * comparé à l’intention de la séance. « Pas faite » part après 5 s, avec « Annuler » (D-178). Le détail reste facultatif.
 */
const MISSED_DELAY = 5;

export function QuickFeedback({ wid, aid, sid, revision, intent, detailHref, when }: {
  wid: string; aid: string; sid: string; revision: number; intent: Intent | null; detailHref: string; when: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<ResultState | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const { run, pending, error } = useIntent<{ item: { id: string } }>();
  // D-178 · « Pas faite » : compte à rebours avant l’envoi, pour rattraper un mauvais toucher.
  const [missedIn, setMissedIn] = useState<number | null>(null);
  useEffect(() => {
    if (missedIn === null) return;
    if (missedIn === 0) { setMissedIn(null); void send('missed', null, 'missed'); return; }
    const t = setTimeout(() => setMissedIn((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(t);
  }, [missedIn]);

  async function send(s: ResultState, rpe: number | null, key: string) {
    setSending(key);
    const ok = await run('PUT', `/api/v1/workspaces/${wid}/athletes/${aid}/workouts/${sid}/feedback`, quickFeedbackBody(revision, s, rpe));
    setSending(null);
    if (ok) router.refresh();
  }

  return (
    <Stack gap={3} aria-live="polite">
      {missedIn !== null || sending === 'missed' ? (
        <Stack gap={2}>
          <Text strong size="md">Séance marquée « Pas faite »</Text>
          <Text size="sm" muted>{sending === 'missed' ? 'Envoi à ton coach…' : `Envoi à ton coach dans ${missedIn} s.`}</Text>
          <Cluster gap={2}>
            <Button size="lg" icon="chevronLeft" disabled={sending === 'missed'} onClick={() => setMissedIn(null)}>Annuler</Button>
            <Button size="lg" variant="ghost" loading={sending === 'missed'} disabled={pending} onClick={() => setMissedIn(0)}>Envoyer maintenant</Button>
          </Cluster>
        </Stack>
      ) : state === null ? (
        <Stack gap={2}>
          <Text strong size="md">Ta séance {when} ?</Text>
          <Grid cols={3} gap={2}>
            <Button size="lg" icon="check" disabled={pending} onClick={() => setState('completed')}>Faite</Button>
            <Button size="lg" icon="half" disabled={pending} onClick={() => setState('partial')}>En partie</Button>
            <Button size="lg" icon="close" disabled={pending} onClick={() => setMissedIn(MISSED_DELAY)}>Pas faite</Button>
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
