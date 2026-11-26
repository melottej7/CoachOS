'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  alternativeName, machineExercise, MACHINE_EXERCISES, STARTER_EXERCISES, starterKey,
  type Exercise, type FollowExtra, type FollowSwap,
} from '@coachos/domain';
import { Banner, Button, IconButton, Input, Text } from '@/design';
import s from './follow-change.module.css';

/**
 * D-182 · « Machine prise ? » : commencer par un autre exercice, en remplacer un, ou en ajouter un hors programme.
 * Les noms proposés : l’alternative prévue pour cette machine, puis les exercices de machine et de départ connus.
 */
export interface OpenPart { k: number; name: string; summary: string }

/** Ce que l’élève écrit, rattaché à un exercice connu quand le nom correspond (fiche et animation). */
function resolve(name: string, known: Exercise[]): Pick<FollowSwap, 'exerciseId' | 'starterKey'> & { name: string } {
  const n = name.trim();
  const lib = known.find((x) => x.name.toLowerCase() === n.toLowerCase());
  if (lib) return { name: lib.name, exerciseId: lib.id, starterKey: lib.starterKey };
  const m = MACHINE_EXERCISES.find((x) => x.name.toLowerCase() === n.toLowerCase());
  if (m) return { name: m.name, exerciseId: null, starterKey: m.key };
  const st = STARTER_EXERCISES.find(([x]) => x.toLowerCase() === n.toLowerCase());
  return { name: st ? st[0] : n, exerciseId: null, starterKey: st ? starterKey(st[0]) : null };
}

export function ChangeSheet({ current, others, swappable, swaps, known, onOrder, onSwap, onUndoSwap, onExtra, onClose, extraOnly = false }: {
  current: string;
  /** Exercices encore à faire, hors celui de l’écran. */
  others: OpenPart[];
  /** Noms d’origine remplaçables dans l’exercice en cours (un circuit en a plusieurs). */
  swappable: { from: string; starterKey: string | null }[];
  swaps: Record<string, FollowSwap | undefined>;
  known: Exercise[];
  onOrder: (k: number) => void;
  onSwap: (from: string, to: FollowSwap) => void;
  onUndoSwap: (from: string) => void;
  onExtra: (x: FollowExtra) => void;
  onClose: () => void;
  /** Fin de séance : seulement « Ajouter un exercice fait en plus ». */
  extraOnly?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const names = useMemo(() => [...new Set([...known.map((x) => x.name), ...MACHINE_EXERCISES.map((x) => x.name), ...STARTER_EXERCISES.map(([n]) => n)])].sort((a, b) => a.localeCompare(b, 'fr')), [known]);
  const [to, setTo] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState({ name: '', sets: '3', reps: '10', kg: '' });
  const [said, setSaid] = useState<string | null>(null);
  const num = (v: string) => { const n = Number(v.replace(',', '.')); return v.trim() && Number.isFinite(n) && n >= 0 ? n : null; };

  return (
    <dialog ref={ref} className={s.sheet} aria-labelledby={`${id}-t`} onClose={onClose} onCancel={onClose}>
      <div className={s.head}>
        <h2 id={`${id}-t`} className={s.title}>{extraOnly ? 'Ajouter un exercice' : 'Machine prise ?'}</h2>
        <IconButton icon="close" label="Fermer" onClick={() => ref.current?.close()} />
      </div>
      <div className={s.body}>
        {said ? <Banner tone="success">{said}</Banner> : null}
        {!extraOnly && others.length ? (
          <section className={s.part} aria-labelledby={`${id}-o`}>
            <h3 id={`${id}-o`} className={s.h}>Commencer par un autre exercice</h3>
            <Text size="sm" muted>« {current} » reste à faire : il te sera proposé ensuite.</Text>
            <ul className={s.list}>
              {others.map((o) => (
                <li key={o.k}>
                  <button type="button" className={s.pick} onClick={() => { onOrder(o.k); ref.current?.close(); }}>
                    <span className={s.pickName}>{o.name}</span>
                    {o.summary ? <span className={s.pickMeta}>{o.summary}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {!extraOnly && swappable.length ? (
          <section className={s.part} aria-labelledby={`${id}-r`}>
            <h3 id={`${id}-r`} className={s.h}>Remplacer par un autre exercice</h3>
            <Text size="sm" muted>Mêmes séries, même repos. Ton coach verra le changement dans ton retour.</Text>
            {swappable.map(({ from, starterKey: key }) => {
              const done = swaps[from.toLowerCase()];
              const alt = key ? machineExercise(key)?.alternative : undefined;
              const altName = alt ? alternativeName(alt) : null;
              const value = to[from] ?? '';
              return (
                <div key={from} className={s.swap}>
                  <Text strong>{from}</Text>
                  {done ? (
                    <div className={s.row}>
                      <Text size="sm">Remplacé par <strong>{done.name}</strong></Text>
                      <Button size="sm" variant="ghost" onClick={() => onUndoSwap(from)}>Annuler</Button>
                    </div>
                  ) : (
                    <>
                      {altName ? (
                        <Button variant="secondary" icon="repeat" onClick={() => { onSwap(from, { ...resolve(altName, known), from }); setSaid(`${from} remplacé par ${altName}.`); }}>
                          {altName} (conseillé)
                        </Button>
                      ) : null}
                      <div className={s.row}>
                        <label className="ds-visually-hidden" htmlFor={`${id}-${from}`}>Remplacer {from} par</label>
                        <Input id={`${id}-${from}`} list={`${id}-names`} maxLength={80} placeholder="Ou écris un exercice" value={value}
                          onChange={(e) => setTo((m) => ({ ...m, [from]: e.target.value }))} />
                        <Button disabled={!value.trim()} onClick={() => { const r = resolve(value, known); onSwap(from, { ...r, from }); setSaid(`${from} remplacé par ${r.name}.`); }}>Remplacer</Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </section>
        ) : null}
        <section className={s.part} aria-labelledby={`${id}-x`}>
          <h3 id={`${id}-x`} className={s.h}>{extraOnly ? 'Un exercice fait en plus' : 'Ajouter un exercice hors programme'}</h3>
          <Text size="sm" muted>Noté pour ton coach dans ton retour, sans changer la séance prévue.</Text>
          <label className={s.label} htmlFor={`${id}-xn`}>Exercice</label>
          <Input id={`${id}-xn`} list={`${id}-names`} maxLength={80} placeholder="Ex. Hack squat" value={extra.name} onChange={(e) => setExtra({ ...extra, name: e.target.value })} />
          <div className={s.nums}>
            <span><label className={s.label} htmlFor={`${id}-xs`}>Séries</label><Input id={`${id}-xs`} inputMode="numeric" value={extra.sets} onChange={(e) => setExtra({ ...extra, sets: e.target.value })} /></span>
            <span><label className={s.label} htmlFor={`${id}-xr`}>Répétitions</label><Input id={`${id}-xr`} inputMode="numeric" value={extra.reps} onChange={(e) => setExtra({ ...extra, reps: e.target.value })} /></span>
            <span><label className={s.label} htmlFor={`${id}-xk`}>Charge (kg)</label><Input id={`${id}-xk`} inputMode="decimal" placeholder="—" value={extra.kg} onChange={(e) => setExtra({ ...extra, kg: e.target.value })} /></span>
          </div>
          <Button icon="plus" disabled={!extra.name.trim()} onClick={() => {
            const r = resolve(extra.name, known);
            const kg = num(extra.kg);
            onExtra({ ...r, sets: Math.max(1, Math.min(30, Math.round(num(extra.sets) ?? 1))), reps: num(extra.reps) === null ? null : Math.round(num(extra.reps)!), kg: kg === null ? null : Math.round(kg * 2) / 2 });
            setSaid(`${r.name} ajouté, noté pour ton coach.`);
            setExtra({ name: '', sets: '3', reps: '10', kg: '' });
          }}>Ajouter</Button>
        </section>
        <datalist id={`${id}-names`}>{names.map((n) => <option key={n} value={n} />)}</datalist>
      </div>
      <div className={s.foot}><Button block onClick={() => ref.current?.close()}>{said ? 'Retour à la séance' : 'Fermer'}</Button></div>
    </dialog>
  );
}
