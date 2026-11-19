'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatClock, formatShortDate, PROPOSAL_INFO, WEEKDAY_SHORT, type ProposalKind, type WeekProposal } from '@coachos/domain';
import { useIntent } from './use-intent';

// CE-P-05 (D-056), sur le modèle de l’éditeur de semaine de Foulée : propositions de la plus prudente à la plus
// exigeante, volume avant → après, séances barrées et remplacées, conséquence probable, application en brouillons.

const dur = (s: number) => (s ? formatClock(Math.round(s / 60) * 60) : '—');
const dayIdx = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;

export function WeekAdapt({ wid, aid, monday, first, proposals, seen }: {
  wid: string; aid: string; monday: string; first: string; proposals: WeekProposal[]; seen: { id: string; revision: number }[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<ProposalKind | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { run, pending, error } = useIntent<{ updated: { canceled: boolean }[] }>();
  const changed = proposals[0]?.changes.length ?? 0;
  const locked = proposals[0]?.locked ?? 0;

  async function apply() {
    if (!kind) return;
    const r = await run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/week-proposals`, { monday, kind, seen });
    if (r) {
      setDone(`« ${PROPOSAL_INFO[kind].title} » appliquée : ${r.updated.length} séance${r.updated.length > 1 ? 's' : ''} en brouillon. Relis-les, puis « Publier la semaine » pour que ${first} les voie.`);
      setKind(null);
      router.refresh();
    }
  }

  return (
    <details className="wa">
      <summary><strong>Adapter la semaine</strong> <span className="muted">· propositions de la plus prudente à la plus exigeante</span></summary>
      {done ? <p className="banner ok" role="status">{done}</p> : null}
      {!changed ? <p className="muted">Aucune séance à adapter : celles de cette semaine sont faites, passées ou annulées.</p> : (
        <fieldset className="wa-list">
          <legend className="visually-hidden">Choisir une proposition</legend>
          <p className="muted">Compare avec la semaine actuelle, puis choisis. {locked ? `${locked} séance${locked > 1 ? 's' : ''} faite${locked > 1 ? 's' : ''}, passée${locked > 1 ? 's' : ''} ou annulée${locked > 1 ? 's' : ''} ne change${locked > 1 ? 'nt' : ''} pas. ` : ''}Rien n’est visible pour {first} avant la publication.</p>
          {proposals.map((p) => {
            const info = PROPOSAL_INFO[p.kind];
            return (
              <label key={p.kind} className={`wa-card${kind === p.kind ? ' on' : ''}`}>
                <span className="wa-head">
                  <input type="radio" name="proposal" checked={kind === p.kind} onChange={() => setKind(p.kind)} />
                  <strong>{info.title}</strong>
                  <span className="wa-vol">{dur(p.beforeSeconds)} → <strong>{dur(p.afterSeconds)}</strong></span>
                </span>
                <span className="wa-sum">{info.summary}</span>
                <ul className="wa-changes">
                  {p.changes.map((c) => (
                    <li key={c.id}>
                      <span className="wa-day">{WEEKDAY_SHORT[dayIdx(c.localDate)]} {formatShortDate(c.localDate).replace(/\.$/, '')}</span>
                      <span><s>{c.before.title} ({dur(c.before.seconds)})</s>{' → '}
                        {c.after ? <strong>{c.after.title}{c.after.title === c.before.title ? ', raccourcie' : ''} ({dur(c.after.seconds)})</strong> : <strong>retirée cette semaine</strong>}</span>
                    </li>
                  ))}
                </ul>
                <span className="wa-cons"><strong>Conséquence probable :</strong> {info.consequence}</span>
              </label>
            );
          })}
          {error ? <p className="field-error" role="alert">{error.kind === 'error' ? error.message : 'Connexion perdue. Réessaie.'}</p> : null}
          <div className="actions">
            <button type="button" className="btn primary" disabled={!kind || pending} onClick={() => void apply()}>
              {pending ? 'Application…' : kind ? `Appliquer « ${PROPOSAL_INFO[kind].title} » en brouillons` : 'Choisis une proposition'}
            </button>
          </div>
        </fieldset>
      )}
    </details>
  );
}
