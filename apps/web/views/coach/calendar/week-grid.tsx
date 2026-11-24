'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { dayOfMonth, formatDuration, formatShortDate, formatWeekday, RESULT_STATE_LABELS, SPORT_LABELS, WORKOUT_STATUS_LABELS } from '@coachos/domain';
import type { CoachWorkoutCard } from '@/server/repo/coach';
import { mutate, newKey } from '@/components/api-client';
import { Badge, Banner, Button, Icon, Input, MenuItem, Popover, Text, Toast, type Tone } from '@/design';
import { cx } from '@/design/cx';
import s from './calendar.module.css';

const STATUS_TONE: Record<CoachWorkoutCard['status'], Tone> = { draft: 'neutral', published: 'success', changed: 'warning' };
const CLIP = 'coachos:calendar-clip';
const UNDO_MS = 10_000;

/** Séance copiée, gardée dans l’onglet : on peut la coller un autre jour, une autre semaine ou chez un autre élève. */
interface Clip { wid: string; aid: string; id: string; title: string }
interface Undo { text: string; run: () => Promise<boolean> }

const day = (d: string) => `${formatWeekday(d).toLowerCase()} ${formatShortDate(d)}`;
const readClip = (wid: string): Clip | null => {
  try { const c = JSON.parse(sessionStorage.getItem(CLIP) ?? 'null') as Clip | null; return c && c.wid === wid ? c : null; } catch { return null; }
};

/**
 * Semaine d’un élève (X18, refonte Chrono D-146), gestes du calendrier (D-158) : glisser une séance sur un autre jour pour
 * la déplacer (Option ou Alt : la copier) ; menu de chaque séance (déplacer, copier, retirer un brouillon) ; « Coller ici »
 * sur chaque jour tant qu’une séance est copiée, même dans une autre semaine ou chez un autre élève ; « Annuler » pendant
 * 10 secondes (aussi ⌘Z / Ctrl+Z). Clavier : ⌘C / Ctrl+C sur une séance la copie, ⌘V / Ctrl+V la colle au jour où l’on est.
 * Rien n’est publié : une séance publiée déplacée attend ta republication.
 */
export function WeekGrid({ wid, aid, first, days, workouts, today, tourDay }: {
  wid: string; aid: string; first: string; days: string[]; workouts: CoachWorkoutCard[]; today: string; tourDay: string;
}) {
  const router = useRouter();
  const base = `/coach/${wid}/athletes/${aid}/workouts`;
  const api = (rest: string) => `/api/v1/workspaces/${wid}/athletes/${aid}/workouts/${rest}`;
  const [clip, setClip] = useState<Clip | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; overDay: string | null } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setClip(readClip(wid)); }, [wid]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const offerUndo = useCallback((u: Undo) => {
    if (timer.current) clearTimeout(timer.current);
    setUndo(u);
    timer.current = setTimeout(() => setUndo(null), UNDO_MS);
  }, []);

  async function call<T>(url: string, body: unknown): Promise<T | null> {
    setBusy(true); setError(null);
    const r = await mutate<T>('POST', url, body, newKey());
    setBusy(false);
    if (!r.ok) { setError(r.kind === 'error' ? (r.fields[0]?.rule ?? r.message) : 'Connexion perdue. Réessaie.'); return null; }
    return r.data;
  }

  async function move(w: CoachWorkoutCard, to: string) {
    if (to === w.localDate) return;
    const r = await call<{ workingRevision: number; previousDate: string; published: boolean }>(api(`${w.id}/move`), { expectedRevision: w.workingRevision, localDate: to });
    if (!r) return;
    router.refresh();
    offerUndo({
      text: `« ${w.title} » déplacée au ${day(to)}${r.published ? ` · à republier pour que ${first} la voie` : ''}`,
      run: async () => Boolean(await call(api(`${w.id}/move`), { expectedRevision: r.workingRevision, localDate: r.previousDate })),
    });
  }

  async function copyTo(c: Clip, to: string) {
    const r = await call<{ id: string; athleteId: string }>(`/api/v1/workspaces/${wid}/athletes/${c.aid}/workouts/${c.id}/copy`, { localDate: to, athleteId: aid });
    if (!r) return;
    router.refresh();
    offerUndo({
      text: `« ${c.title} » copiée au ${day(to)}, en brouillon`,
      run: async () => Boolean(await call(`/api/v1/workspaces/${wid}/athletes/${r.athleteId}/workouts/${r.id}/discard`, { expectedRevision: 1 })),
    });
  }

  async function discard(w: CoachWorkoutCard) {
    const r = await call<{ workingRevision: number }>(api(`${w.id}/discard`), { expectedRevision: w.workingRevision });
    if (!r) return;
    router.refresh();
    offerUndo({ text: `Brouillon « ${w.title} » retiré`, run: async () => Boolean(await call(api(`${w.id}/restore`), { expectedRevision: r.workingRevision })) });
  }

  function takeClip(w: CoachWorkoutCard) {
    const c: Clip = { wid, aid, id: w.id, title: w.title };
    try { sessionStorage.setItem(CLIP, JSON.stringify(c)); } catch { /* commodité seulement */ }
    setClip(c);
  }
  function dropClip() {
    try { sessionStorage.removeItem(CLIP); } catch { /* commodité seulement */ }
    setClip(null);
  }

  async function runUndo() {
    const u = undo;
    if (!u) return;
    setUndo(null);
    if (await u.run()) router.refresh();
  }

  // Raccourcis : ⌘C / Ctrl+C sur une séance, ⌘V / Ctrl+V dans un jour, ⌘Z / Ctrl+Z pour annuler le dernier geste.
  function onKeyDown(e: React.KeyboardEvent<HTMLOListElement>) {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
    const k = e.key.toLowerCase();
    const el = document.activeElement as HTMLElement | null;
    if (k === 'c') {
      const id = el?.closest<HTMLElement>('[data-workout]')?.dataset.workout;
      const w = workouts.find((x) => x.id === id);
      if (w && !w.canceled && !window.getSelection()?.toString()) { e.preventDefault(); takeClip(w); }
    } else if (k === 'v' && clip) {
      const d = el?.closest<HTMLElement>('[data-day]')?.dataset.day;
      if (d) { e.preventDefault(); void copyTo(clip, d); }
    } else if (k === 'z' && undo) {
      e.preventDefault(); void runUndo();
    }
  }

  function onDrop(e: DragEvent<HTMLLIElement>, d: string) {
    e.preventDefault();
    const id = drag?.id ?? e.dataTransfer.getData('text/plain');
    setDrag(null);
    const w = workouts.find((x) => x.id === id);
    if (!w || d === w.localDate) return;
    // Option (Mac) ou Alt / Ctrl (Windows) : copier ; sinon déplacer.
    if (e.altKey || e.ctrlKey || !movable(w)) void copyTo({ wid, aid, id: w.id, title: w.title }, d);
    else void move(w, d);
  }

  const movable = (w: CoachWorkoutCard) => !w.canceled && !w.feedback;

  return (
    <>
      {clip ? (
        <Banner tone="coach" title={`« ${clip.title} » est copiée`}
          action={<Button size="sm" variant="ghost" icon="close" onClick={dropClip}>Terminer</Button>}>
          Touche « Coller ici » sous un jour, ou change de semaine ou d’élève pour la coller ailleurs. Elle arrive en brouillon.
        </Banner>
      ) : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <ol className={s.week} onKeyDown={onKeyDown} aria-busy={busy || undefined}>
        {days.map((d) => {
          const items = workouts.filter((w) => w.localDate === d);
          return (
            <li key={d} data-day={d} className={cx(s.day, d === today && s.today, d < today && s.past, drag?.overDay === d && s.dropTarget)} aria-current={d === today ? 'date' : undefined}
              onDragOver={(e) => { if (!drag) return; e.preventDefault(); e.dataTransfer.dropEffect = e.altKey || e.ctrlKey ? 'copy' : 'move'; if (drag.overDay !== d) setDrag({ ...drag, overDay: d }); }}
              onDragLeave={(e) => { if (drag && !e.currentTarget.contains(e.relatedTarget as Node)) setDrag({ ...drag, overDay: null }); }}
              onDrop={(e) => onDrop(e, d)}>
              <h3 className={s.dayHead}><span>{formatWeekday(d)}</span> <strong>{dayOfMonth(d)}</strong>{d === today ? <span className="ds-visually-hidden"> (aujourd’hui)</span> : null}</h3>
              {items.length ? (
                <ul className={s.cards}>
                  {items.map((w) => (
                    <li key={w.id} data-workout={w.id} className={cx(s.cardWrap, drag?.id === w.id && s.dragging)} draggable={!w.canceled}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', w.id); e.dataTransfer.effectAllowed = 'copyMove'; setDrag({ id: w.id, overDay: null }); }}
                      onDragEnd={() => setDrag(null)}>
                      <Link className={cx(s.card, s[w.status], w.canceled && s.canceled)} href={`${base}/${w.id}`} draggable={false}>
                        <span className={s.cardTitle}>{w.title}</span>
                        <span className={s.cardMeta}>{[SPORT_LABELS[w.sport], formatDuration(w.durationSeconds)].filter(Boolean).join(' · ')}</span>
                        <span className={s.badges}>
                          {w.canceled
                            ? <Badge tone="danger">{w.status === 'published' ? 'Annulée' : 'Annulée · à republier'}</Badge>
                            : <Badge tone={STATUS_TONE[w.status]}>{WORKOUT_STATUS_LABELS[w.status]}</Badge>}
                          {w.feedback ? <Badge tone={w.feedback.reviewed ? 'neutral' : 'signal'} dot={!w.feedback.reviewed}>{RESULT_STATE_LABELS[w.feedback.state]}{w.feedback.reviewed ? ' · traité' : ' · à traiter'}</Badge> : null}
                        </span>
                      </Link>
                      {w.canceled ? null : (
                        <span className={s.cardMenu}>
                          <Popover label={`Gestes pour « ${w.title} »`} icon="more" iconOnly>
                            {(close) => <CardMenu w={w} days={days} movable={movable(w)} close={close} busy={busy}
                              onMove={(to) => void move(w, to)} onCopy={() => takeClip(w)} onDiscard={() => void discard(w)} />}
                          </Popover>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : <p className={s.rest}>Rien de prévu</p>}
              {clip ? (
                <button type="button" className={s.paste} disabled={busy} onClick={() => void copyTo(clip, d)}
                  aria-label={`Coller « ${clip.title} » le ${day(d)}`}><Icon name="copy" size={16} />Coller ici</button>
              ) : null}
              <Link className={s.add} href={`${base}/new?date=${d}`} aria-label={`Ajouter une séance le ${day(d)}`} data-tour={d === tourDay ? 'day-add' : undefined}>
                <Icon name="plus" size={16} />Ajouter
              </Link>
            </li>
          );
        })}
      </ol>
      <Text size="sm" muted className="ds-hide-narrow">Glisse une séance sur un autre jour pour la déplacer ; avec Option (Alt), tu la copies. ⌘Z (Ctrl+Z) annule le dernier geste.</Text>
      {undo ? <Toast action={{ label: 'Annuler', onClick: () => void runUndo() }}>{undo.text}</Toast> : null}
    </>
  );
}

/** Menu d’une séance : déplacer à une date, copier pour la coller ailleurs, retirer un brouillon jamais publié. */
function CardMenu({ w, days, movable, close, busy, onMove, onCopy, onDiscard }: {
  w: CoachWorkoutCard; days: string[]; movable: boolean; close: () => void; busy: boolean;
  onMove: (to: string) => void; onCopy: () => void; onDiscard: () => void;
}) {
  const [moving, setMoving] = useState(false);
  const [to, setTo] = useState(days.find((d) => d > w.localDate) ?? w.localDate);
  if (moving) {
    return (
      <form className={s.menuForm} onSubmit={(e) => { e.preventDefault(); close(); setMoving(false); onMove(to); }}>
        <label htmlFor={`mv-${w.id}`}><Text as="span" size="sm" strong>Déplacer au</Text></label>
        <Input id={`mv-${w.id}`} type="date" value={to} onChange={(e) => setTo(e.target.value)} required />
        <Button type="submit" size="sm" variant="primary" disabled={busy || !to || to === w.localDate}>Déplacer</Button>
        <Button size="sm" variant="ghost" onClick={() => setMoving(false)}>Retour</Button>
      </form>
    );
  }
  return (
    <>
      {movable ? <MenuItem icon="calendar" onClick={() => setMoving(true)}>Déplacer à une date…</MenuItem> : null}
      <MenuItem icon="copy" onClick={() => { close(); onCopy(); }}>Copier (pour coller ailleurs)</MenuItem>
      {w.status === 'draft' && w.publishedRevision === null && !w.feedback
        ? <MenuItem icon="trash" tone="danger" disabled={busy} onClick={() => { close(); onDiscard(); }}>Retirer le brouillon</MenuItem> : null}
      {!movable ? <Text as="p" size="sm" muted>{w.feedback ? 'Déjà renseignée par l’élève : elle reste à sa date.' : ''}</Text> : null}
    </>
  );
}
