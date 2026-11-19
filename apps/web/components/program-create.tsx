'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useIntent } from './use-intent';

// D-061 : le coach lit les risques, les accepte s’il y en a, puis crée les séances en brouillons (rien n’est publié).

export function ProgramCreate({ wid, aid, goalId, startMonday, days, sessions, needsAccept, validated }: {
  wid: string; aid: string; goalId: string; startMonday: string; days: number[]; sessions: number; needsAccept: boolean; validated: boolean;
}) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ planId: string; workouts: number }>();
  const [accept, setAccept] = useState(false);
  if (!validated) return <p className="banner warn">Valide d’abord l’objectif dans la fiche (Faisabilité → Ta décision) : le programme est construit à partir de ta décision.</p>;
  return (
    <div className="stack">
      {needsAccept ? (
        <label className="check"><input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
          <span>J’ai lu les risques signalés et je décide de créer ce programme.</span></label>
      ) : null}
      {error ? <p className="field-error" role="alert">{error.kind === 'error' ? (error.fields[0]?.rule ?? error.message) : 'Connexion perdue. Réessaie.'}</p> : null}
      <div className="actions">
        <button type="button" className="btn primary" disabled={pending || (needsAccept && !accept)}
          onClick={async () => {
            const r = await run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/goals/${goalId}/program`, { startMonday, days, acceptRisks: accept });
            if (r) router.push(`/coach/${wid}/calendar?athlete=${aid}&week=${startMonday}&notice=program`);
          }}>
          {pending ? 'Création…' : `Créer les ${sessions} séances en brouillons`}
        </button>
        <span className="muted">Rien n’est envoyé à l’élève : tu relis, ajustes, puis publies semaine par semaine.</span>
      </div>
    </div>
  );
}
