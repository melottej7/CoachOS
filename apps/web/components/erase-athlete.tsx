'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorSummary } from './feedback-banners';
import { useIntent } from './use-intent';

/**
 * D-115 · Effacement définitif du dossier d’un élève par le propriétaire de l’espace. Confirmation en tapant le prénom :
 * l’action supprime séances, retours, échanges, bilan, et le compte s’il n’est lié à aucun autre espace.
 */
export function EraseAthlete({ wid, aid, name, requested }: { wid: string; aid: string; name: string; requested: boolean }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ erased: boolean; accountDeleted: boolean }>();
  const [open, setOpen] = useState(requested);
  const [typed, setTyped] = useState('');
  const first = name.split(' ')[0] ?? name;
  const ok = typed.trim().toLocaleLowerCase('fr') === first.toLocaleLowerCase('fr');

  async function erase() {
    if (!ok) return;
    const r = await run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/erase`, {});
    if (r) router.push(`/coach/${wid}/athletes?notice=${r.accountDeleted ? 'erased-account' : 'erased'}`);
  }

  if (!open) return <button type="button" className="link-btn" onClick={() => setOpen(true)}>Effacer définitivement les données de {first}…</button>;
  return (
    <div className="stack">
      <ErrorSummary error={error} onRetry={() => void erase()} />
      <p className="banner warn">Cette action supprime tout le dossier de {name} : séances, retours, échanges, bilan, rendez-vous, notes. Elle ne peut pas être annulée.</p>
      <div className="field">
        <label htmlFor="erase-confirm">Pour confirmer, écris le prénom « {first} »</label>
        <input id="erase-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </div>
      <div className="actions">
        <button type="button" className="btn primary" disabled={!ok || pending} onClick={() => void erase()}>{pending ? 'Effacement…' : `Effacer les données de ${first}`}</button>
        <button type="button" className="link-btn" disabled={pending} onClick={() => { setOpen(false); setTyped(''); }}>Annuler</button>
      </div>
    </div>
  );
}
