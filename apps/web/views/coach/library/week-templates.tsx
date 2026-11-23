'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatClock, structureTotals, templateDayLabel, type WeekDay } from '@coachos/domain';
import { useIntent } from '@/components/use-intent';
import { Button, Cluster, Disclosure, Input, Text } from '@/design';
import s from './library.module.css';

// D-051, refonte Chrono (D-154) : semaines types et programmes types. On les applique depuis la semaine d’un élève.

export interface WeekTemplateRow { id: string; revision: number; title: string; days: WeekDay[]; weeks: number; notes?: string | null }

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
    return <Text muted>Aucune semaine type. Dans le <Link href={`/coach/${wid}/calendar`}>calendrier d’un élève</Link>, prépare sa semaine puis « Enregistrer comme semaine type ». Un ancien programme s’importe aussi en entier.</Text>;
  }
  return (
    <>
      <ul className={s.list}>
        {items.map((t) => {
          const total = t.days.reduce((n, d) => n + minutes(d), 0);
          return (
            <li key={t.id} className={s.row}>
              <div className={s.rowMain}>
                {editing === t.id ? (
                  <form onSubmit={(e) => { e.preventDefault(); void patch(t, { title }); }}>
                    <Cluster gap={2}>
                      <Input id={`wtl-${t.id}`} aria-label="Nouveau nom" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
                      <Button type="submit" size="sm" variant="primary" loading={pending} disabled={!title.trim()}>Renommer</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Annuler</Button>
                    </Cluster>
                  </form>
                ) : <h3 className={s.rowTitle}>{t.title}</h3>}
                <Text size="sm" muted>{t.weeks > 1 ? `${t.weeks} semaines · ` : ''}{t.days.length} séance{t.days.length > 1 ? 's' : ''}{total ? ` · ${formatClock(Math.round(total / 60) * 60)} prévues` : ''}</Text>
                <Disclosure summary={`Voir les ${t.days.length} séance${t.days.length > 1 ? 's' : ''}`}>
                  <ol className={s.days} aria-label={`Séances de « ${t.title} »`}>
                    {t.days.map((d, i) => <li key={i}><strong>{templateDayLabel(d.offset, t.weeks > 1)}</strong> {d.workout.title}</li>)}
                  </ol>
                </Disclosure>
                {t.notes ? (
                  <Disclosure summary="Consignes du programme">
                    <Text prose size="sm">{t.notes}</Text>
                    <Text size="sm" muted>Ajoutées à la première séance quand tu l’appliques à un élève.</Text>
                  </Disclosure>
                ) : null}
              </div>
              {editing === t.id ? null : (
                <Cluster gap={1}>
                  <Button size="sm" variant="ghost" icon="edit" onClick={() => { setEditing(t.id); setTitle(t.title); }}>Renommer</Button>
                  <Button size="sm" variant="ghost" icon="trash" disabled={pending}
                    onClick={() => { if (window.confirm(`Archiver « ${t.title} » ? Les séances déjà données ne changent pas.`)) void patch(t, { archive: true }); }}>Archiver</Button>
                </Cluster>
              )}
            </li>
          );
        })}
      </ul>
      {error ? <Text size="sm" tone="danger" role="alert">{error.kind === 'error' ? error.message : 'Connexion perdue. Réessaie.'}</Text> : null}
    </>
  );
}
