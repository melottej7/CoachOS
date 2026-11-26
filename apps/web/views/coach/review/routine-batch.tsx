'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { mutate, newKey } from '@/components/api-client';
import { Banner, Button, Card, Stack, Text } from '@/design';

export interface RoutineItem { athleteId: string; workoutId: string; revision: number }

/**
 * Bilan produit (fluidité) · traiter d’un geste les retours sans signal (séance réalisée, effort sous 8/10, sans commentaire,
 * élève à 100 %), puis « Annuler » tant que le bandeau reste affiché : rien ne part chez l’élève, aucune fenêtre de confirmation.
 * Un retour corrigé par l’élève entre-temps est laissé dans la file (version différente).
 */
export function RoutineBatch({ wid, items }: { wid: string; items: RoutineItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<RoutineItem[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [failed, setFailed] = useState(false);
  const url = (i: RoutineItem) => `/api/v1/workspaces/${wid}/athletes/${i.athleteId}/workouts/${i.workoutId}/feedback/review`;

  async function markAll() {
    setBusy(true);
    setFailed(false);
    const ok: RoutineItem[] = [];
    let miss = 0;
    for (const i of items) {
      const r = await mutate('POST', url(i), { expectedRevision: i.revision }, newKey());
      if (r.ok) ok.push(i); else miss++;
    }
    setDone(ok);
    setSkipped(miss);
    setBusy(false);
    router.refresh();
  }

  async function undo() {
    if (!done) return;
    setBusy(true);
    let bad = false;
    for (const i of done) if (!(await mutate('DELETE', url(i), {}, newKey())).ok) bad = true;
    setBusy(false);
    setFailed(bad);
    setDone(null);
    router.refresh();
  }

  if (done) {
    return (
      <Banner tone="success" title={`${done.length} retour${done.length > 1 ? 's' : ''} marqué${done.length > 1 ? 's' : ''} comme traité${done.length > 1 ? 's' : ''}`}
        action={done.length ? <Button size="sm" variant="secondary" loading={busy} onClick={() => void undo()}>Annuler</Button> : undefined}>
        {skipped ? `${skipped} retour${skipped > 1 ? 's' : ''} laissé${skipped > 1 ? 's' : ''} dans la file : l’élève l’a corrigé entre-temps, relis-le. ` : ''}
        Aucun message n’est parti chez tes élèves.
      </Banner>
    );
  }
  if (!items.length) return failed ? <Banner tone="danger">L’annulation n’a pas abouti pour certains retours : recharge la page et vérifie la file.</Banner> : null;
  return (
    <Card pad={4} tinted>
      <Stack gap={3}>
        <Text>
          <strong>{items.length} retour{items.length > 1 ? 's' : ''} sans signal</strong> : séance réalisée, effort sous 8/10, sans commentaire, élève à 100 %.
        </Text>
        <div><Button variant="coach" icon="check" loading={busy} onClick={() => void markAll()}>Tout marquer traité</Button></div>
        <Text size="sm" muted>Aucun message n’est envoyé. Tu pourras annuler juste après.</Text>
      </Stack>
    </Card>
  );
}
