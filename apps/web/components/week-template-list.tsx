'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatClock, structureTotals, WEEKDAY_SHORT, type WeekDay } from '@coachos/domain';
import { useIntent } from './use-intent';

// D-051 : semaines types de la bibliothèque. On les applique depuis la semaine d’un élève (Séances → Semaine).

export interface WeekTemplateRow { id: string; revision: number; title: string; days: WeekDay[] }

function minutes(d: WeekDay): number {
  const t = structureTotals(d.workout.intervals ?? [], { sport: d.workout.sport });
  return t.seconds || d.workout.durationSeconds || 0;
}

export function WeekTemplateList({ wid, items }: { wid: string; items: WeekTemplateRow[] }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<unknown>();
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState('');

  async function patch(t: WeekTemplateRow, body: Record<string, unknown>) {
    const r = await run('PATCH', `/api/v1/workspaces/${wid}/week-templates/${t.id}`, { expectedRevision: t.revision, ...body });
    if (r) { setEditing(null); router.refresh(); }
  }

  if (!items.length) {
    return <p className="empty">Aucune semaine type. Dans <Link href={`/coach/${wid}/calendar`}>Séances → Semaine</Link>, prépare la semaine d’un élève puis « 💾 Enregistrer comme semaine type ».</p>;
  }
  return (
    <ul className="plain wtl">
      {items.map((t) => {
        const total = t.days.reduce((n, d) => n + minutes(d), 0);
        return (
          <li key={t.id} className="wtl-row">
            {editing === t.id ? (
              <form className="wtl-edit" onSubmit={(e) => { e.preventDefault(); void patch(t, { title }); }}>
                <label className="visually-hidden" htmlFor={`wtl-${t.id}`}>Nom</label>
                <input id={`wtl-${t.id}`} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
                <button className="btn primary small" type="submit" disabled={pending || !title.trim()}>Renommer</button>
                <button className="link-btn" type="button" onClick={() => setEditing(null)}>Annuler</button>
              </form>
            ) : <h3>{t.title}</h3>}
            <p className="muted">{t.days.length} séance{t.days.length > 1 ? 's' : ''}{total ? ` · ${formatClock(Math.round(total / 60) * 60)} prévues` : ''}</p>
            <ol className="wtl-days" aria-label={`Séances de « ${t.title} »`}>
              {t.days.map((d, i) => <li key={i}><strong>{WEEKDAY_SHORT[d.offset]}</strong> {d.workout.title}</li>)}
            </ol>
            {editing === t.id ? null : (
              <span className="wtl-actions">
                <button type="button" className="link-btn" onClick={() => { setEditing(t.id); setTitle(t.title); }}>Renommer</button>
                <button type="button" className="link-btn" disabled={pending} onClick={() => void patch(t, { archive: true })}>Archiver</button>
              </span>
            )}
          </li>
        );
      })}
      {error ? <li className="field-error" role="alert">{error.kind === 'error' ? error.message : 'Connexion perdue. Réessaie.'}</li> : null}
    </ul>
  );
}
