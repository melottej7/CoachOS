'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { INTENT_LABELS, intentOfRpe, QUICK_EFFORTS, quickFeedbackBody, type Intent, type ResultState } from '@coachos/domain';
import { useIntent } from './use-intent';

// CE-C-03 (D-039) : retour en deux gestes depuis Aujourd’hui. 1) Faite / En partie / Pas faite ; 2) ressenti,
// comparé à l’intention de la séance. Le détail reste facultatif (formulaire complet).

const STATES: { state: ResultState; label: string; icon: string }[] = [
  { state: 'completed', label: 'Faite', icon: '✓' },
  { state: 'partial', label: 'En partie', icon: '◐' },
  { state: 'missed', label: 'Pas faite', icon: '✕' },
];

export function QuickFeedback({ wid, aid, sid, revision, intent, detailHref, when }: {
  wid: string; aid: string; sid: string; revision: number; intent: Intent | null; detailHref: string;
  /** « aujourd’hui » ou « hier » : intégré à la question. */
  when: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<ResultState | null>(null);
  const { run, pending, error } = useIntent<{ item: { id: string } }>();

  async function send(s: ResultState, rpe: number | null) {
    const ok = await run('PUT', `/api/v1/workspaces/${wid}/athletes/${aid}/workouts/${sid}/feedback`, quickFeedbackBody(revision, s, rpe));
    if (ok) router.refresh();
  }

  return (
    <div className="qf" aria-live="polite">
      {state === null ? (
        <fieldset className="qf-step">
          <legend className="qf-q">Ta séance {when} ?</legend>
          <div className="qf-row">
            {STATES.map((x) => (
              <button key={x.state} type="button" className={`qf-btn qf-${x.state}`} disabled={pending}
                onClick={() => (x.state === 'missed' ? void send('missed', null) : setState(x.state))}>
                <span aria-hidden="true" className="qf-icon">{x.icon}</span>{x.label}
              </button>
            ))}
          </div>
        </fieldset>
      ) : (
        <fieldset className="qf-step">
          <legend className="qf-q">Comment l’as-tu ressentie ?{intent ? <span className="qf-intent">Visé par ton coach : séance {INTENT_LABELS[intent]}</span> : null}</legend>
          <div className="qf-row efforts">
            {QUICK_EFFORTS.map((e) => (
              <button key={e.rpe} type="button" className={`qf-btn effort${intent && intentOfRpe(e.rpe) === intent ? ' aimed' : ''}`} disabled={pending}
                onClick={() => void send(state, e.rpe)}>{e.label}</button>
            ))}
          </div>
          <p className="qf-foot">
            <button type="button" className="link-btn" disabled={pending} onClick={() => setState(null)}>← Retour</button>
            <button type="button" className="link-btn" disabled={pending} onClick={() => void send(state, null)}>Envoyer sans ressenti</button>
          </p>
        </fieldset>
      )}
      {error ? (
        <p className="field-error" role="alert">
          {error.kind === 'error' ? error.message : 'Connexion perdue. Réessaie.'} <Link href={detailHref}>Ouvrir le retour complet</Link>
        </p>
      ) : null}
      <p className="qf-detail"><Link href={detailHref}>Raconter en détail</Link> (durée, distance, ce qui a changé, commentaire)</p>
    </div>
  );
}
