'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  describeBlock, describeTotals, LIBRARY_CATEGORIES, LIBRARY_CATEGORY_LABELS, SPORT_LABELS, SPORTS, structureTotals, todayIn,
  type LibraryCategory, type LibraryWorkout, type Sport,
} from '@coachos/domain';
import { mutate, newKey } from './api-client';

export interface LibraryCard { id: string; revision: number; category: LibraryCategory; workout: LibraryWorkout; meta?: { source: 'foulee'; tier: number; tiers: number; calculated?: boolean } | null }

/** Bibliothèque : recherche, filtres, et pour chaque séance « Utiliser », « Modifier », « Dupliquer », « Archiver ». */
export function LibraryBrowser({ wid, items, athletes, preselect, teams = [] }: {
  wid: string; items: LibraryCard[]; athletes: { id: string; name: string; timeZone: string }[]; preselect?: string;
  /** Groupes avec au moins un élève : « Pour le groupe … » (D-042). */
  teams?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sport, setSport] = useState<Sport | ''>('');
  const [cat, setCat] = useState<LibraryCategory | ''>('');
  const [use, setUse] = useState<string | null>(null);
  const [who, setWho] = useState(preselect ?? athletes[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const shown = items.filter((i) => (!q || norm(i.workout.title).includes(norm(q))) && (!sport || i.workout.sport === sport) && (!cat || i.category === cat));
  const athlete = athletes.find((a) => a.id === who);
  const [date, setDate] = useState(() => todayIn(athlete?.timeZone ?? 'Europe/Brussels'));

  async function act(method: 'POST' | 'PATCH', url: string, body: unknown) {
    setBusy(true);
    await mutate(method, url, body, newKey());
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="library">
      <div className="filters lib-filters">
        <label className="visually-hidden" htmlFor="lib-q">Rechercher une séance</label>
        <input id="lib-q" className="input" type="search" placeholder="Rechercher une séance" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="visually-hidden" htmlFor="lib-sport">Sport</label>
        <select id="lib-sport" className="select small" value={sport} onChange={(e) => setSport(e.target.value as Sport | '')}>
          <option value="">Tous les sports</option>{SPORTS.map((s) => <option key={s} value={s}>{SPORT_LABELS[s]}</option>)}
        </select>
        <div className="pick-row" role="group" aria-label="Catégorie">
          <button type="button" className={`pick${cat === '' ? ' on' : ''}`} onClick={() => setCat('')}>Toutes</button>
          {LIBRARY_CATEGORIES.filter((c) => items.some((i) => i.category === c)).map((c) => (
            <button key={c} type="button" className={`pick${cat === c ? ' on' : ''}`} aria-pressed={cat === c} onClick={() => setCat(c)}>{LIBRARY_CATEGORY_LABELS[c]}</button>
          ))}
        </div>
      </div>
      {shown.length ? (
        <ul className="lib-grid">
          {shown.map((i) => {
            const t = structureTotals(i.workout.intervals, { sport: i.workout.sport });
            return (
              <li key={i.id} className="lib-card">
                <div className="lib-top">
                  <span className="lib-cat">{LIBRARY_CATEGORY_LABELS[i.category]}</span>
                  {i.meta?.source === 'foulee' ? <span className="lib-src" title="Repère pour toi seul, jamais montré à l’élève">Foulée · palier {i.meta.tier}/{i.meta.tiers}{i.meta.calculated ? ' · calculé' : ''}</span> : null}
                  <span className="muted">{SPORT_LABELS[i.workout.sport]}</span>
                </div>
                <h3>{i.workout.title}</h3>
                <p className="lib-total">{i.workout.intervals.length ? describeTotals(t) : i.workout.durationSeconds ? `${Math.round(i.workout.durationSeconds / 60)} min` : 'Durée libre'}</p>
                {i.workout.intervals.length ? (
                  <ol className="lib-blocks">{i.workout.intervals.slice(0, 4).map((b, k) => <li key={k}>{describeBlock(b, i.workout.sport)}</li>)}{i.workout.intervals.length > 4 ? <li>…</li> : null}</ol>
                ) : i.workout.instructions ? <p className="lib-blocks">{i.workout.instructions.slice(0, 140)}</p> : null}
                {use === i.id ? (
                  <form className="lib-use" onSubmit={(e) => { e.preventDefault(); router.push(`/coach/${wid}/athletes/${who}/workouts/new?date=${date}&template=${i.id}`); }}>
                    <label className="visually-hidden" htmlFor={`who-${i.id}`}>Pour</label>
                    <select id={`who-${i.id}`} className="select small" value={who} onChange={(e) => setWho(e.target.value)}>{athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                    <label className="visually-hidden" htmlFor={`date-${i.id}`}>Date</label>
                    <input id={`date-${i.id}`} className="pick-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                    <button className="btn primary small" type="submit" disabled={!who}>Continuer</button>
                    <button className="link-btn" type="button" onClick={() => setUse(null)}>Annuler</button>
                  </form>
                ) : (
                  <div className="lib-actions">
                    <button type="button" className="btn primary small" onClick={() => setUse(i.id)} disabled={!athletes.length}>Utiliser pour un élève</button>
                    <a className="btn small" href={`/coach/${wid}/library/${i.id}`}>Modifier</a>
                    <details className="b-more">
                      <summary className="icon-btn" aria-label={`Plus d’actions pour ${i.workout.title}`}>⋯</summary>
                      <div className="b-menu">
                        {teams.map((t) => <a key={t.id} href={`/coach/${wid}/groups/${t.id}/sessions/new?modele=${i.id}`}>Pour le groupe « {t.name} »</a>)}
                        <button type="button" disabled={busy} onClick={() => void act('POST', `/api/v1/workspaces/${wid}/templates`, { category: i.category, workout: { ...i.workout, title: `${i.workout.title} (copie)`.slice(0, 120) } })}>Dupliquer</button>
                        <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Archiver « ${i.workout.title} » ? Les séances déjà créées ne changent pas.`)) void act('PATCH', `/api/v1/workspaces/${wid}/templates/${i.id}`, { expectedRevision: i.revision, archive: true }); }}>Archiver</button>
                      </div>
                    </details>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : <p className="empty">{items.length ? 'Aucune séance ne correspond.' : 'Ta bibliothèque est vide.'}</p>}
    </div>
  );
}

/** Ajouter les séances de départ. */
export function StarterButton({ wid }: { wid: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className="btn" disabled={busy} onClick={async () => {
      setBusy(true);
      await mutate('POST', `/api/v1/workspaces/${wid}/templates/starter`, {}, newKey());
      setBusy(false);
      router.refresh();
    }}>{busy ? 'Ajout…' : '✨ Ajouter les séances de départ'}</button>
  );
}

/** D-068 : importer la bibliothèque Foulée (324 séances en 79 familles, par paliers). Rien n’est doublé. */
export function FouleeButton({ wid }: { wid: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | string>('idle');
  return (
    <span className="actions">
      <button type="button" className="btn" disabled={state === 'busy'} onClick={async () => {
        if (!window.confirm('Importer la bibliothèque Foulée (324 séances de course en 79 familles, par paliers) dans ta bibliothèque ? Les séances déjà présentes ne sont pas doublées.')) return;
        setState('busy');
        const r = await mutate<{ added: number; skipped: number }>('POST', `/api/v1/workspaces/${wid}/templates/foulee`, {}, newKey());
        setState(r.ok ? `${r.data.added} séance${r.data.added > 1 ? 's' : ''} ajoutée${r.data.added > 1 ? 's' : ''}${r.data.skipped ? `, ${r.data.skipped} déjà là` : ''}.` : 'Import impossible. Réessaie.');
        router.refresh();
      }}>{state === 'busy' ? 'Import…' : '🏃 Importer la bibliothèque Foulée'}</button>
      {state !== 'idle' && state !== 'busy' ? <span className="muted" role="status">{state}</span> : null}
    </span>
  );
}

