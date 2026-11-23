'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PRIVACY_REQUEST_KIND_LABELS, PRIVACY_REQUEST_STATE_LABELS, type PrivacyRequestKind, type PrivacyRequestState } from '@coachos/domain';
import { ErrorSummary } from './feedback-banners';
import { useIntent } from './use-intent';

export interface PrivacyRequestView {
  id: string;
  kind: PrivacyRequestKind;
  state: PrivacyRequestState;
  createdAt: string;
  dueAt: string;
}

const fmt = (iso: string) => new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));

/**
 * D-115 · « Mes données » : export immédiat (accès et portabilité) et demande d’effacement traitée par le responsable
 * de l’espace sous 30 jours. Un coach propriétaire voit que sa demande concerne tout son espace.
 */
export function PrivacyPanel({ wid, role, owner = false, requests }: { wid: string; role: 'athlete' | 'coach'; owner?: boolean; requests: PrivacyRequestView[] }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ id: string; state: string; dueAt: string }>();
  const [downloading, setDownloading] = useState(false);
  const erasure = requests.find((r) => r.kind === 'erase' && (r.state === 'open' || r.state === 'verifying' || r.state === 'processing'));

  async function download() {
    setDownloading(true);
    const r = await run('POST', `/api/v1/workspaces/${wid}/privacy/requests`, { kind: 'portability' });
    setDownloading(false);
    if (!r) return;
    window.location.assign(`/api/v1/workspaces/${wid}/privacy/requests/${r.id}/download`);
    router.refresh();
  }

  async function askErasure() {
    const text = owner
      ? 'Demander l’effacement de ton espace entier (élèves, séances, échanges) ? La demande est consignée et traitée par l’opérateur de CoachOS sous 30 jours, après vérification avec toi.'
      : role === 'coach'
        ? 'Demander l’effacement de tes données de coach dans cet espace ? Le propriétaire de l’espace reçoit la demande et dispose de 30 jours.'
        : 'Demander l’effacement de tes données ? Ton coach reçoit la demande et dispose de 30 jours pour effacer ton dossier : séances, retours, échanges, bilan. Tu ne pourras pas les récupérer.';
    if (!window.confirm(text)) return;
    const r = await run('POST', `/api/v1/workspaces/${wid}/privacy/requests`, { kind: 'erase' });
    if (r) router.refresh();
  }

  return (
    <section className="card" style={{ marginTop: 18 }} aria-labelledby="mes-donnees" id="donnees">
      <div className="card-head"><h2 id="mes-donnees">Mes données</h2><Link href="/confidentialite" className="link-btn">Confidentialité</Link></div>
      <div className="card-body stack">
        <ErrorSummary error={error} onRetry={() => void download()} />
        <p className="muted">
          {role === 'athlete'
            ? 'Tu peux télécharger tout ce que CoachOS garde sur toi dans cet espace, ou demander à ton coach d’effacer ton dossier.'
            : owner
              ? 'Tu peux télécharger tes données de coach (bibliothèque, méthode, notes, tâches) ou demander l’effacement de ton espace.'
              : 'Tu peux télécharger tes données de coach dans cet espace ou demander au propriétaire de les effacer.'}
        </p>
        <div className="actions" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn" disabled={pending || downloading} onClick={() => void download()}>{downloading ? 'Préparation…' : 'Télécharger mes données'}</button>
          {erasure
            ? <span className="muted">Effacement demandé le {fmt(erasure.createdAt)} · {PRIVACY_REQUEST_STATE_LABELS[erasure.state]} · réponse avant le {fmt(erasure.dueAt)}</span>
            : <button type="button" className="link-btn" disabled={pending} onClick={() => void askErasure()}>Demander l’effacement de mes données</button>}
        </div>
        {requests.length ? (
          <details>
            <summary className="muted">Mes demandes ({requests.length})</summary>
            <ul className="plain stack" style={{ marginTop: 8 }}>
              {requests.map((r) => (
                <li key={r.id} className="muted">{PRIVACY_REQUEST_KIND_LABELS[r.kind]} · {fmt(r.createdAt)} · {PRIVACY_REQUEST_STATE_LABELS[r.state]}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </section>
  );
}
