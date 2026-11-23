'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ProgramTweaks } from '@coachos/domain';
import { useIntent } from '@/components/use-intent';
import { Banner, Button, Checkbox, Cluster, Stack, Text } from '@/design';

// D-061, refonte Chrono (D-157) : le coach lit les risques, les accepte s’il y en a, puis crée les séances en brouillons.

export function ProgramCreate({ wid, aid, goalId, startMonday, days, sessions, needsAccept, validated, tweaks = null, suggestionId = null }: {
  wid: string; aid: string; goalId: string; startMonday: string; days: number[]; sessions: number; needsAccept: boolean; validated: boolean;
  tweaks?: ProgramTweaks | null; suggestionId?: string | null;
}) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ planId: string; workouts: number }>();
  const [accept, setAccept] = useState(false);
  if (!validated) return <Banner tone="warning" title="Objectif pas encore validé">Valide d’abord l’objectif dans la fiche (Progression › Faisabilité › Ta décision) : le programme est construit à partir de ta décision.</Banner>;
  return (
    <Stack gap={3}>
      {needsAccept ? <Checkbox id="accept-risks" checked={accept} onChange={setAccept} label="J’ai lu les risques signalés et je décide de créer ce programme." /> : null}
      {error ? <Text size="sm" tone="danger" role="alert">{error.kind === 'error' ? (error.fields[0]?.rule ?? error.message) : 'Connexion perdue. Réessaie.'}</Text> : null}
      <Cluster gap={3}>
        <Button variant="primary" icon="check" loading={pending} disabled={needsAccept && !accept}
          onClick={async () => {
            const r = await run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/goals/${goalId}/program`, { startMonday, days, acceptRisks: accept, tweaks, suggestionId });
            if (r) router.push(`/coach/${wid}/calendar?athlete=${aid}&week=${startMonday}&notice=program`);
          }}>
          {`Créer les ${sessions} séances en brouillons`}
        </Button>
        <Text as="span" size="sm" muted>Rien n’est envoyé à l’élève : tu relis, ajustes, puis publies semaine par semaine.</Text>
      </Cluster>
    </Stack>
  );
}
