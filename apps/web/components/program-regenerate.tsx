'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ProgramTweaks } from '@coachos/domain';
import { useIntent } from './use-intent';

// D-063 : le coach lit les différences et les risques, puis applique. Tout reste en brouillons ; rien n’est publié.

export function ProgramRegenerate({ wid, aid, planId, fromWeek, toWeek, days, seen, counts, needsAccept, validated, calendarHref, tweaks = null, suggestionId = null }: {
  tweaks?: ProgramTweaks | null; suggestionId?: string | null;
  wid: string; aid: string; planId: string; fromWeek: number; toWeek: number; days: number[]; seen: { id: string; revision: number }[];
  counts: { changed: number; added: number; removed: number }; needsAccept: boolean; validated: boolean; calendarHref: string;
}) {
  const router = useRouter();
  const { run, pending, error } = useIntent<unknown>();
  const [accept, setAccept] = useState(false);
  const n = counts.changed + counts.added + counts.removed;
  if (!validated) return <p className="banner warn">Valide d’abord l’objectif dans la fiche (Faisabilité → Ta décision).</p>;
  if (!n) return <p className="muted">Rien à changer dans ces semaines avec ces jours.</p>;
  return (
    <div className="stack">
      {needsAccept ? (
        <label className="check"><input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
          <span>J’ai lu les risques signalés et je décide de régénérer ces semaines.</span></label>
      ) : null}
      {error ? <p className="field-error" role="alert">{error.kind === 'error' ? (error.fields[0]?.rule ?? error.message) : 'Connexion perdue. Réessaie.'}</p> : null}
      <div className="actions">
        <button type="button" className="btn primary" disabled={pending || (needsAccept && !accept)}
          onClick={async () => {
            const r = await run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/plans/${planId}/regenerate`, { fromWeek, toWeek, days, seen, acceptRisks: accept, tweaks, suggestionId });
            if (r) router.push(calendarHref);
          }}>
          {pending ? 'Application…' : `Appliquer les ${n} changement${n > 1 ? 's' : ''} en brouillons`}
        </button>
        <span className="muted">Rien n’est envoyé à l’élève : tu relis, puis publies semaine par semaine.</span>
      </div>
    </div>
  );
}
