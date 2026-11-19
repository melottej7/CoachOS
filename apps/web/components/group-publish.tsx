'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GROUP_ROW_LABELS, type GroupSessionRowState } from '@coachos/domain';
import { useIntent } from './use-intent';

// Lot G2 (D-042) : chaque élève et l’état de sa séance ; on choisit qui reçoit la publication.
// Les exceptions (non cochés, élèves sans séance) et les adaptations sont rappelées avant l’envoi.

export interface PublishRow {
  athleteId: string; name: string; workoutId: string; revision: number; state: GroupSessionRowState; title: string; base: boolean; editHref: string; viewHref: string;
}

const TONE: Record<GroupSessionRowState, string> = { draft: 'neutral', adapted: 'attn', published: '', changed: 'attn' };

export function GroupPublish({ wid, gid, rows, without }: { wid: string; gid: string; rows: PublishRow[]; without: string[] }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ published: number }>();
  const open = rows.filter((r) => r.state !== 'published');
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(open.map((r) => r.workoutId)));
  const [done, setDone] = useState<number | null>(null);
  const toggle = (id: string) => setChosen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const picked = open.filter((r) => chosen.has(r.workoutId));
  const skipped = open.filter((r) => !chosen.has(r.workoutId));
  const adapted = picked.filter((r) => !r.base);
  const first = (n: string) => n.split(' ')[0];

  async function publish() {
    const r = await run('POST', `/api/v1/workspaces/${wid}/group-sessions/${gid}/publish`, {
      items: picked.map((x) => ({ athleteId: x.athleteId, workoutId: x.workoutId, revision: x.revision })),
    });
    if (r) { setDone(r.published); router.refresh(); }
  }

  return (
    <div className="gp">
      <ul className="plain gp-list">
        {rows.map((r) => (
          <li key={r.workoutId} className="gp-row">
            {r.state !== 'published' ? (
              <input type="checkbox" aria-label={`Publier pour ${r.name}`} checked={chosen.has(r.workoutId)} onChange={() => toggle(r.workoutId)} />
            ) : <span className="gp-check" aria-hidden="true">✓</span>}
            <div className="gp-main">
              <p className="gp-name"><strong>{r.name}</strong> <span className={`pill ${TONE[r.state]}`}>{GROUP_ROW_LABELS[r.state]}</span></p>
              <p className="muted gp-title">{r.base ? 'Séance de base' : `Adaptée : ${r.title}`}</p>
            </div>
            <span className="gp-actions">
              <Link className="btn small" href={r.editHref}>Adapter</Link>
              <Link className="link-btn" href={r.viewHref}>Voir</Link>
            </span>
          </li>
        ))}
      </ul>
      {open.length ? (
        <div className="gp-summary" aria-live="polite">
          <p><strong>Publier pour {picked.length} élève{picked.length > 1 ? 's' : ''}</strong>{picked.length ? ` : ${picked.map((r) => first(r.name)).join(', ')}` : ''}.</p>
          {adapted.length ? <p>Dont {adapted.length} séance{adapted.length > 1 ? 's' : ''} adaptée{adapted.length > 1 ? 's' : ''} : {adapted.map((r) => first(r.name)).join(', ')} (publiée{adapted.length > 1 ? 's' : ''} telle{adapted.length > 1 ? 's' : ''} quelle{adapted.length > 1 ? 's' : ''}).</p> : null}
          {skipped.length || without.length ? (
            <p className="gp-except">Exceptions : {[...skipped.map((r) => `${first(r.name)} (non cochée)`), ...without.map((n) => `${first(n)} (pas de séance)`)].join(', ')}.</p>
          ) : <p className="muted">Aucune exception.</p>}
          <div className="actions">
            <button type="button" className="btn primary" disabled={pending || !picked.length} onClick={() => void publish()}>
              {pending ? 'Publication…' : `Publier pour ${picked.length} élève${picked.length > 1 ? 's' : ''}`}
            </button>
          </div>
          {error ? <p className="field-error" role="alert">{error.kind === 'error' ? error.message : 'Connexion perdue. Réessaie.'}</p> : null}
        </div>
      ) : <p className="banner ok" role="status">Toutes les séances sont publiées.{done ? ` ${done} publiée${done > 1 ? 's' : ''} à l’instant.` : ''}</p>}
      {done && open.length ? <p className="banner ok" role="status">{done} séance{done > 1 ? 's' : ''} publiée{done > 1 ? 's' : ''}.</p> : null}
    </div>
  );
}
