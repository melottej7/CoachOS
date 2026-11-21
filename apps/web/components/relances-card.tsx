'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ADHERENCE_LABELS, RELANCE_LABELS, type AdherenceStatus, type RelanceKind } from '@coachos/domain';
import { mutate, newKey } from './api-client';

export interface RelanceItem {
  athleteId: string; name: string; first: string; status: AdherenceStatus; reason: string; relance: RelanceKind | null;
  draft: string | null; waitingSince: string | null; workoutId: string | null;
}

/**
 * D-103 · Relances du jour : qui contacter, pourquoi, et un message déjà rédigé que le coach relit, modifie et
 * envoie lui-même dans la conversation de l’élève. Une relance envoyée passe « en attente de réponse ».
 */
export function RelancesCard({ wid, items }: { wid: string; items: RelanceItem[] }) {
  const todo = items.filter((i) => i.relance && i.relance !== 'bravo' && !i.waitingSince);
  const waiting = items.filter((i) => i.relance && i.relance !== 'bravo' && i.waitingSince);
  const bravo = items.filter((i) => i.relance === 'bravo' && !i.waitingSince);
  return (
    <section className="card relances" aria-labelledby="relances-title">
      <div className="card-head">
        <h2 id="relances-title">Relances {todo.length ? <span className="count" aria-label={`${todo.length} à faire`}>{todo.length}</span> : null}</h2>
        <span className="muted">Message prêt, tu relis et tu envoies · <Link href={`/coach/${wid}/settings#relances`}>Mes modèles</Link></span>
      </div>
      <div className="card-body stack">
        {todo.length ? (
          <ul className="plain rl-list">{todo.map((i) => <RelanceRow key={i.athleteId} wid={wid} item={i} />)}</ul>
        ) : <p className="muted">{!items.length ? 'Pas encore d’élève actif.' : waiting.length ? 'Rien d’autre à relancer aujourd’hui.' : 'Personne à relancer aujourd’hui : tout le monde donne des nouvelles 👍'}</p>}
        {waiting.length ? (
          <p className="muted rl-waiting">En attente de réponse : {waiting.map((i, k) => <span key={i.athleteId}>{k ? ', ' : ''}<Link href={`/coach/${wid}/messages/${i.athleteId}`}>{i.first}</Link></span>)} (relancé{waiting.length > 1 ? 's' : ''} ces 3 derniers jours).</p>
        ) : null}
        {bravo.length ? (
          <details className="rl-bravo">
            <summary>👏 Encourager ({bravo.length}) <span className="muted">· toutes leurs séances faites ces 7 derniers jours</span></summary>
            <ul className="plain rl-list">{bravo.map((i) => <RelanceRow key={i.athleteId} wid={wid} item={i} />)}</ul>
          </details>
        ) : null}
      </div>
    </section>
  );
}

function RelanceRow({ wid, item }: { wid: string; item: RelanceItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(item.draft ?? '');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(newKey);

  async function send() {
    if (!text.trim()) return;
    setState('sending'); setError(null);
    const c = await mutate<{ id: string }>('POST', `/api/v1/workspaces/${wid}/athletes/${item.athleteId}/conversations`, {}, newKey());
    if (!c.ok) { setState('idle'); setError('Connexion perdue. Ton message est gardé : réessaie.'); return; }
    const r = await mutate('POST', `/api/v1/workspaces/${wid}/conversations/${c.data.id}/messages`, { body: text.trim(), workoutId: item.relance === 'no_feedback' || item.relance === 'missed' ? item.workoutId : null }, key);
    if (!r.ok) { setState('idle'); setError(r.kind === 'error' ? (r.fields[0]?.rule ?? r.message) : 'Connexion perdue. Ton message est gardé : réessaie.'); return; }
    setState('sent');
    router.refresh();
  }

  return (
    <li className={`rl ${item.status}`}>
      <div className="rl-head">
        <Link className="rl-name" href={`/coach/${wid}/athletes/${item.athleteId}`}>{item.name}</Link>
        <span className={`pill rl-pill ${item.status}`}>{ADHERENCE_LABELS[item.status]}</span>
        <span className="muted rl-reason">{item.reason}</span>
      </div>
      {state === 'sent' ? (
        <p className="rl-sent" role="status">Envoyé à {item.first} ✓ <Link href={`/coach/${wid}/messages/${item.athleteId}`}>Voir la conversation</Link></p>
      ) : open ? (
        <div className="rl-edit">
          <label className="visually-hidden" htmlFor={`rl-${item.athleteId}`}>Message à {item.first}</label>
          <textarea id={`rl-${item.athleteId}`} rows={4} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <div className="actions">
            <button type="button" className="btn primary" disabled={state === 'sending' || !text.trim()} onClick={() => void send()}>{state === 'sending' ? 'Envoi…' : `Envoyer à ${item.first}`}</button>
            <button type="button" className="btn ghost" onClick={() => { setOpen(false); setText(item.draft ?? ''); }}>Annuler</button>
          </div>
        </div>
      ) : (
        <div className="actions rl-actions">
          <button type="button" className="btn small" onClick={() => setOpen(true)}>✍️ {item.relance ? RELANCE_LABELS[item.relance] : 'Écrire'} : préparer le message</button>
        </div>
      )}
    </li>
  );
}
