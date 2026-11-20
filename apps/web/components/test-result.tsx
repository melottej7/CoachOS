'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useIntent } from './use-intent';

/**
 * D-090 : résultat d’un test (« Test 5 km ») vu par le coach. Deux gestes explicites, le coach décide :
 * l’ajouter aux résultats de référence (faisabilité, équivalences) et/ou mettre à jour la VMA (zones et allures).
 */
export function TestResultActions({ wid, aid, sport, name, meters, seconds, doneOn, vmaKmh, currentVma }: {
  wid: string; aid: string; sport: string; name: string; meters: number; seconds: number; doneOn: string; vmaKmh: number | null; currentVma: number | null;
}) {
  const router = useRouter();
  const perf = useIntent<unknown>();
  const vma = useIntent<unknown>();
  const [saved, setSaved] = useState<{ perf?: boolean; vma?: boolean }>({});
  const vmaText = (v: number) => `${String(v).replace('.', ',')} km/h`;
  return (
    <div className="stack">
      <div className="actions">
        <button type="button" className="btn small" disabled={perf.pending || saved.perf}
          onClick={async () => { if (await perf.run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/performances`, { sport, kind: 'test', name, distanceM: meters, durationS: seconds, doneOn })) { setSaved((s) => ({ ...s, perf: true })); router.refresh(); } }}>
          {saved.perf ? 'Ajouté aux résultats de référence' : 'Ajouter aux résultats de référence'}
        </button>
        {vmaKmh && vmaKmh !== currentVma ? (
          <button type="button" className="btn small primary" disabled={vma.pending || saved.vma}
            onClick={async () => { if (await vma.run('PUT', `/api/v1/workspaces/${wid}/athletes/${aid}/references`, { vmaKmh })) { setSaved((s) => ({ ...s, vma: true })); router.refresh(); } }}>
            {saved.vma ? `VMA mise à ${vmaText(vmaKmh)}` : `Mettre la VMA à ${vmaText(vmaKmh)}`}
          </button>
        ) : null}
      </div>
      {perf.error || vma.error ? <p className="field-error" role="alert">{(perf.error ?? vma.error)!.kind === 'error' ? ((perf.error ?? vma.error) as { message: string }).message : 'Connexion perdue. Réessaie.'}</p> : null}
    </div>
  );
}
