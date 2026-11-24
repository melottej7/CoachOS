'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  describeBlock, describeTotals, LIBRARY_CATEGORIES, LIBRARY_CATEGORY_LABELS, SPORT_LABELS, SPORTS, structureTotals, todayIn,
  type LibraryCategory, type LibraryWorkout, type Sport,
} from '@coachos/domain';
import { mutate, newKey } from '@/components/api-client';
import { Badge, Button, ChipChoice, Cluster, Disclosure, EmptyState, Field, Input, LinkButton, MenuItem, Popover, Select, Stack, Text } from '@/design';
import s from './library.module.css';

export interface LibraryCard { id: string; revision: number; category: LibraryCategory; workout: LibraryWorkout; meta?: { source: 'foulee'; tier: number; tiers: number; calculated?: boolean } | null }

const norm = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * CE-B-01, refonte Chrono (D-154) : séances types du coach. Recherche, sport, catégorie ; pour chacune « Utiliser pour un élève »
 * (élève et date, puis l’éditeur prérempli), « Modifier », et dans « Plus » : pour un groupe (D-042), dupliquer, archiver.
 */
export function LibraryBrowser({ wid, items, athletes, preselect, teams = [] }: {
  wid: string; items: LibraryCard[]; athletes: { id: string; name: string; timeZone: string }[]; preselect?: string;
  /** Groupes avec au moins un élève : « Pour le groupe … » (D-042). */
  teams?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sport, setSport] = useState<Sport | ''>('');
  const [cat, setCat] = useState<LibraryCategory | null>(null);
  const [use, setUse] = useState<string | null>(null);
  const [who, setWho] = useState(preselect ?? athletes[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const shown = items.filter((i) => (!q || norm(i.workout.title).includes(norm(q))) && (!sport || i.workout.sport === sport) && (!cat || i.category === cat));
  const athlete = athletes.find((a) => a.id === who);
  const [date, setDate] = useState(() => todayIn(athlete?.timeZone ?? 'Europe/Brussels'));
  const cats = LIBRARY_CATEGORIES.filter((c) => items.some((i) => i.category === c));

  async function act(method: 'POST' | 'PATCH', url: string, body: unknown) {
    setBusy(true);
    await mutate(method, url, body, newKey());
    setBusy(false);
    router.refresh();
  }

  if (!items.length) {
    return (
      <EmptyState icon="library" title="Ta bibliothèque est vide">
        Ajoute les séances de départ (fractionné, tempo, côtes, sortie longue, vélo, natation…) puis adapte-les, crée ta première séance,
        ou importe ta base existante. Une séance déjà créée pour un élève s’ajoute aussi depuis sa page : « Ajouter à la bibliothèque ».
      </EmptyState>
    );
  }

  return (
    <Stack gap={4}>
      <label className="ds-visually-hidden" htmlFor="lib-q">Rechercher une séance</label>
      <Input id="lib-q" type="search" placeholder="Rechercher une séance" value={q} onChange={(e) => setQ(e.target.value)} />
      <Disclosure summary={sport || cat ? 'Filtres actifs' : 'Filtrer par sport ou catégorie'} open={Boolean(sport || cat)}>
        <Stack gap={3}>
          <Field id="lib-sport" label="Sport">
            <Select id="lib-sport" value={sport} onChange={(e) => setSport(e.target.value as Sport | '')}>
              <option value="">Tous les sports</option>{SPORTS.map((x) => <option key={x} value={x}>{SPORT_LABELS[x]}</option>)}
            </Select>
          </Field>
          {cats.length > 1 ? (
            <ChipChoice legend="Catégorie" name="lib-cat" value={cat} onChange={setCat} clearLabel="Toutes"
              options={cats.map((c) => ({ value: c, label: LIBRARY_CATEGORY_LABELS[c] }))} />
          ) : null}
        </Stack>
      </Disclosure>
      <Text size="sm" muted role="status">{shown.length === items.length ? `${items.length} séance${items.length > 1 ? 's' : ''}` : `${shown.length} sur ${items.length}`}</Text>
      {shown.length ? (
        <ul className={s.grid}>
          {shown.map((i) => {
            const t = structureTotals(i.workout.intervals, { sport: i.workout.sport });
            return (
              <li key={i.id} className={s.card}>
                <div className={s.cardTop}>
                  <Badge tone="coach">{LIBRARY_CATEGORY_LABELS[i.category]}</Badge>
                  <span>{SPORT_LABELS[i.workout.sport]}</span>
                  {i.meta?.source === 'foulee' ? <span className={s.src} title="Repère pour toi seul, jamais montré à l’élève">Foulée · palier {i.meta.tier}/{i.meta.tiers}{i.meta.calculated ? ' · calculé' : ''}</span> : null}
                </div>
                <h3 className={s.title}>{i.workout.title}</h3>
                <span className={s.total}>{i.workout.intervals.length ? describeTotals(t) : i.workout.durationSeconds ? `${Math.round(i.workout.durationSeconds / 60)} min` : 'Durée libre'}</span>
                {i.workout.intervals.length ? (
                  <ol className={s.blocks}>{i.workout.intervals.slice(0, 4).map((b, k) => <li key={k}>{describeBlock(b, i.workout.sport)}</li>)}{i.workout.intervals.length > 4 ? <li>…</li> : null}</ol>
                ) : i.workout.instructions ? <p className={s.blocksText}>{i.workout.instructions.slice(0, 140)}{i.workout.instructions.length > 140 ? '…' : ''}</p> : null}
                {use === i.id ? (
                  <form className={s.use} aria-label={`Utiliser « ${i.workout.title} »`} onSubmit={(e) => { e.preventDefault(); router.push(`/coach/${wid}/athletes/${who}/workouts/new?date=${date}&template=${i.id}`); }}>
                    <Select id={`who-${i.id}`} aria-label="Pour quel élève" value={who} onChange={(e) => setWho(e.target.value)}>{athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
                    <Input id={`date-${i.id}`} aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                    <Cluster gap={2}>
                      <Button type="submit" size="sm" variant="primary" iconRight="arrowRight" disabled={!who}>Continuer</Button>
                      <Button size="sm" variant="ghost" onClick={() => setUse(null)}>Annuler</Button>
                    </Cluster>
                  </form>
                ) : (
                  <div className={s.cardActions}>
                    <Button size="sm" variant="primary" onClick={() => setUse(i.id)} disabled={!athletes.length}>Utiliser pour un élève</Button>
                    <LinkButton size="sm" href={`/coach/${wid}/library/${i.id}`} icon="edit">Modifier</LinkButton>
                    <Popover label={`Plus d’actions pour « ${i.workout.title} »`} icon="more" iconOnly>
                      {(close) => (
                        <>
                          {teams.map((t) => (
                            <MenuItem key={t.id} icon="users" onClick={() => { close(); router.push(`/coach/${wid}/groups/${t.id}/sessions/new?modele=${i.id}`); }}>Pour le groupe « {t.name} »</MenuItem>
                          ))}
                          <MenuItem icon="copy" disabled={busy} onClick={() => { close(); void act('POST', `/api/v1/workspaces/${wid}/templates`, { category: i.category, workout: { ...i.workout, title: `${i.workout.title} (copie)`.slice(0, 120) } }); }}>Dupliquer</MenuItem>
                          <MenuItem icon="trash" tone="danger" disabled={busy} onClick={() => {
                            close();
                            if (window.confirm(`Archiver « ${i.workout.title} » ? Les séances déjà créées ne changent pas.`)) void act('PATCH', `/api/v1/workspaces/${wid}/templates/${i.id}`, { expectedRevision: i.revision, archive: true });
                          }}>Archiver</MenuItem>
                        </>
                      )}
                    </Popover>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : <Text muted>Aucune séance ne correspond.</Text>}
      {!athletes.length ? <Text size="sm" muted>Ajoute un élève pour utiliser une séance type.</Text> : null}
    </Stack>
  );
}

/** Ajouter les séances de départ. */
export function StarterButton({ wid }: { wid: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button icon="plus" loading={busy} onClick={async () => {
      setBusy(true);
      await mutate('POST', `/api/v1/workspaces/${wid}/templates/starter`, {}, newKey());
      setBusy(false);
      router.refresh();
    }}>Ajouter les séances de départ</Button>
  );
}

/** D-068 : importer la bibliothèque Foulée (324 séances en 79 familles, par paliers). Rien n’est doublé. */
export function FouleeButton({ wid, outdated = 0 }: { wid: string; outdated?: number }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | string>('idle');
  const ask = outdated
    ? `Mettre à jour ${outdated} séance${outdated > 1 ? 's' : ''} Foulée de fractionné court (30"/30", 200 m, 300 m) : la zone passe de Z7 (vitesse) à Z6 (VMA), comme dans tes programmes ? Seules les séances que tu n’as pas modifiées changent ; les programmes déjà donnés aux élèves ne bougent pas.`
    : 'Importer la bibliothèque Foulée (324 séances de course en 79 familles, par paliers) dans ta bibliothèque ? Les séances déjà présentes ne sont pas doublées.';
  return (
    <>
      <Button icon="download" loading={state === 'busy'} onClick={async () => {
        if (!window.confirm(ask)) return;
        setState('busy');
        const r = await mutate<{ added: number; skipped: number; updated: number }>('POST', `/api/v1/workspaces/${wid}/templates/foulee`, {}, newKey());
        const pl = (n: number) => (n > 1 ? 's' : '');
        setState(!r.ok ? 'Import impossible. Réessaie.'
          : [r.data.added ? `${r.data.added} séance${pl(r.data.added)} ajoutée${pl(r.data.added)}` : '', r.data.updated ? `${r.data.updated} mise${pl(r.data.updated)} à jour` : '', r.data.skipped && !r.data.updated ? `${r.data.skipped} déjà là` : ''].filter(Boolean).join(', ') + '.');
        router.refresh();
      }}>{outdated ? `Mettre à jour Foulée (${outdated})` : 'Importer la bibliothèque Foulée'}</Button>
      {state !== 'idle' && state !== 'busy' ? <Text as="span" size="sm" muted role="status">{state}</Text> : null}
    </>
  );
}
