'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { chainLabel, GYM_CHAINS, MACHINE_LEVEL_LABELS, machineLibrary, type GymChain, type MachineExercise } from '@coachos/domain';
import { mutate, newKey } from '@/components/api-client';
import { Badge, Banner, Button, IconButton, Input, Text } from '@/design';
import { cx } from '@/design/cx';
import s from './machine-picker.module.css';

/**
 * D-181 · Choisir des exercices de machine directement depuis la séance, avec la salle de l’élève (« Basic-Fit » ou
 * toutes les machines). Un exercice absent de la bibliothèque du coach y entre en même temps (réglages et consignes
 * compris), pour que l’élève voie sa fiche et son animation. La salle choisie est retenue sur cet appareil.
 */
export type Gym = GymChain | 'all';
const GYM_KEY = 'coachos:salle';
export function readGym(): Gym {
  try { const v = localStorage.getItem(GYM_KEY); return v === 'basic-fit-be' ? v : 'all'; } catch { return 'all'; }
}
export function keepGym(g: Gym) {
  try { localStorage.setItem(GYM_KEY, g); } catch { /* stockage indisponible */ }
}
/** Machines d’une salle : sûres ou très probables (« selon le club » reste dans « Toutes les machines »). */
export function inGym(chains: Partial<Record<GymChain, string>>, gym: Gym): boolean {
  return gym === 'all' || chains[gym] === 'sure' || chains[gym] === 'likely';
}

export interface PickedExercise { id: string; name: string }

const fold = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function MachinePicker({ wid, mode, gym, onGym, inSession, onPick, onClose }: {
  wid: string;
  /** « many » : ajouter plusieurs exercices à la séance, dans l’ordre des touchers ; « one » : choisir celui d’une étape. */
  mode: 'many' | 'one';
  gym: Gym; onGym: (g: Gym) => void;
  /** Noms (en minuscules) des exercices déjà dans la séance. */
  inSession: Set<string>;
  onPick: (items: PickedExercise[]) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const lib = useMemo(() => machineLibrary(), []);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);

  // Sans accents ni majuscules, chaque mot dans n’importe quel ordre : « developpe », « row seated ».
  const words = fold(q).split(/\s+/).filter(Boolean);
  const match = (e: MachineExercise, en: string, machine: string) => {
    const hay = fold(`${e.name} ${e.muscles} ${en} ${machine}`);
    return words.every((w) => hay.includes(w));
  };
  const groups = lib.map((g) => ({
    ...g,
    machines: g.machines
      .filter(({ machine }) => inGym(machine.chains, gym))
      .map((m) => ({ ...m, exercises: m.exercises.filter((e) => match(e, m.machine.en, m.machine.name)) }))
      .filter((m) => m.exercises.length),
  })).filter((g) => g.machines.length);

  async function confirm(keys: string[]) {
    if (!keys.length) return;
    setBusy(true); setFailed(false);
    const r = await mutate<{ items: { key: string; id: string; name: string }[] }>('POST', `/api/v1/workspaces/${wid}/exercises/machines`, { keys }, newKey());
    setBusy(false);
    if (!r.ok) { setFailed(true); return; }
    const byKey = new Map(r.data.items.map((x) => [x.key, x]));
    onPick(keys.map((key) => byKey.get(key)).filter((x): x is { key: string; id: string; name: string } => Boolean(x)).map(({ id, name }) => ({ id, name })));
  }
  const toggle = (key: string) => {
    if (mode === 'one') { void confirm([key]); return; }
    setPicked((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));
  };

  return (
    <dialog ref={ref} className={s.sheet} aria-labelledby="mp-title" onClose={onClose} onCancel={onClose}>
      <div className={s.head}>
        <h2 id="mp-title" className={s.title}>{mode === 'many' ? 'Ajouter des machines' : 'Choisir une machine'}</h2>
        <IconButton icon="close" label="Fermer" onClick={() => ref.current?.close()} />
      </div>
      <div className={s.tools}>
        <div className={s.gyms} role="radiogroup" aria-label="Salle">
          {(['basic-fit-be', 'all'] as const).map((g) => (
            <button key={g} type="button" role="radio" aria-checked={gym === g} className={cx(s.gym, gym === g && s.gymOn)}
              onClick={() => { onGym(g); keepGym(g); }}>{g === 'all' ? 'Toutes les machines' : GYM_CHAINS[g]}</button>
          ))}
        </div>
        <label className="ds-visually-hidden" htmlFor="mp-q">Chercher une machine ou un muscle</label>
        <Input id="mp-q" type="search" placeholder="Chercher : presse, dos, fessiers…" value={q} onChange={(e) => setQ(e.target.value)} />
        {gym !== 'all' ? <Text size="sm" muted>Machines présentes chez Basic-Fit (sûres ou très probables). Le nom anglais est celui écrit sur la machine.</Text> : null}
      </div>
      <div className={s.list}>
        {groups.length ? groups.map((g) => (
          <section key={g.kind} aria-label={g.label}>
            <h3 className={s.kind}>{g.label}</h3>
            {g.machines.map(({ machine, exercises }) => (
              <div key={machine.key} className={s.machine}>
                <p className={s.mName}>{machine.name} <span className={s.mEn}>{gym === 'all' ? machine.en : chainLabel(machine)}</span></p>
                <ul className={s.exercises}>
                  {exercises.map((e) => {
                    const n = picked.indexOf(e.key);
                    const there = inSession.has(e.name.toLowerCase());
                    return (
                      <li key={e.key}>
                        <button type="button" className={cx(s.ex, n >= 0 && s.exOn)} aria-pressed={mode === 'many' ? n >= 0 : undefined} disabled={busy} onClick={() => toggle(e.key)}>
                          <span className={s.mark} aria-hidden="true">{n >= 0 ? n + 1 : '+'}</span>
                          <span className={s.exText}>
                            <span className={s.exName}>{e.name}</span>
                            <span className={s.exMeta}>{e.muscles} · {MACHINE_LEVEL_LABELS[e.level]}</span>
                          </span>
                          {there ? <Badge>Déjà dans la séance</Badge> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        )) : <Text muted>Aucune machine ne correspond. Essaie un autre mot, ou « Toutes les machines ».</Text>}
      </div>
      {failed ? <div className={s.foot}><Banner tone="danger">Ajout impossible. Vérifie la connexion et réessaie.</Banner></div> : null}
      {mode === 'many' ? (
        <div className={s.foot}>
          <Text size="sm" muted>{picked.length ? 'Dans l’ordre de tes touchers ; 3 séries de 10, repos 1 min 30, à ajuster ensuite.' : 'Touche les exercices dans l’ordre de la séance.'}</Text>
          <Button variant="primary" icon="plus" loading={busy} disabled={!picked.length} onClick={() => void confirm(picked)}>
            {picked.length ? `Ajouter ${picked.length} exercice${picked.length > 1 ? 's' : ''}` : 'Ajouter'}
          </Button>
        </div>
      ) : null}
    </dialog>
  );
}
