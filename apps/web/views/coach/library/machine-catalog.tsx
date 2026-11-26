'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  AVAILABILITY_LABELS, chainLabel, GYM_CHAINS, MACHINE_LEVEL_LABELS, MACHINE_MOTIONS, machineInstructions, machineLibrary, MOTION_STATUS_LABELS, motionStatus,
  type MachineExercise,
} from '@coachos/domain';
import { mutate, newKey } from '@/components/api-client';
import { Badge, Banner, Button, Checkbox, Cluster, Disclosure, Heading, Input, Stack, Text } from '@/design';
import { MachineMotion } from '@/views/shared/machine-motion';
import { MachineSteps } from '@/views/athlete/exercise-howto';
import s from './machine-catalog.module.css';

/**
 * D-178 · Bibliothèque des machines de salle, rangée par type de machine : le coach coche les exercices utiles à ses
 * élèves et les ajoute à sa bibliothèque, réglages et consignes compris. « Basic-Fit » n’est qu’une étiquette.
 */
export function MachineCatalog({ wid, have }: { wid: string; have: string[] }) {
  const router = useRouter();
  const lib = useMemo(() => machineLibrary(), []);
  const owned = useMemo(() => new Set(have), [have]);
  const [q, setQ] = useState('');
  const [bf, setBf] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const k = q.trim().toLowerCase();
  const match = (e: MachineExercise) => !k || e.name.toLowerCase().includes(k) || e.muscles.toLowerCase().includes(k);
  const total = lib.reduce((n, g) => n + g.machines.reduce((m, x) => m + x.exercises.length, 0), 0);

  async function add() {
    setBusy(true);
    const r = await mutate<{ added: number; skipped: number }>('POST', `/api/v1/workspaces/${wid}/exercises/machines`, { keys: picked }, newKey());
    setBusy(false);
    if (!r.ok) { setNote({ ok: false, text: 'Ajout impossible. Réessaie.' }); return; }
    setNote({ ok: true, text: `${r.data.added} exercice${r.data.added > 1 ? 's' : ''} ajouté${r.data.added > 1 ? 's' : ''} à ta bibliothèque${r.data.skipped ? ` (${r.data.skipped} déjà présent${r.data.skipped > 1 ? 's' : ''})` : ''}.` });
    setPicked([]);
    router.refresh();
  }

  return (
    <section aria-labelledby="machines" className={s.wrap}>
      <Stack gap={4}>
        <Stack gap={1}>
          <Heading level={2} size={3} id="machines">Machines de salle</Heading>
          <Text muted>{total} exercices sur machine, avec réglages, consignes, erreur fréquente et alternative si la machine est prise. Coche ceux dont tes élèves ont besoin.</Text>
        </Stack>
        <div className={s.filters}>
          <label className="ds-visually-hidden" htmlFor="mc-q">Chercher une machine ou un muscle</label>
          <Input id="mc-q" type="search" placeholder="Chercher : presse, dos, fessiers…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Checkbox id="mc-bf" checked={bf} onChange={setBf} label={`Vue ${GYM_CHAINS['basic-fit-be']}`} hint="Machines présentes chez Basic-Fit (sûres ou très probables), avec le nom écrit sur la machine et son numéro dans le club." />
        </div>
        {note ? <Banner tone={note.ok ? 'success' : 'danger'}>{note.text}</Banner> : null}
        {lib.map((g) => {
          const machines = g.machines
            .filter(({ machine }) => !bf || machine.chains['basic-fit-be'] === 'sure' || machine.chains['basic-fit-be'] === 'likely')
            .map((m) => ({ ...m, exercises: m.machine.en.toLowerCase().includes(k) && k ? m.exercises : m.exercises.filter(match) }))
            .filter((m) => m.exercises.length);
          if (!machines.length) return null;
          return (
            <Stack gap={2} key={g.kind}>
              <Text strong>{g.label}</Text>
              <ul className={s.machines}>
                {machines.map(({ machine, exercises }) => {
                  const bfa = machine.chains['basic-fit-be'];
                  return (
                    <li key={machine.key}>
                      <Disclosure open={Boolean(k)} summary={<span className={s.summary}>
                        <span className={s.mName}>{machine.name}</span>
                        <span className={s.mMeta}>{bf ? chainLabel(machine) : machine.en} · {exercises.length} exercice{exercises.length > 1 ? 's' : ''}</span>
                        {bfa ? <Badge tone={bfa === 'verify' ? 'neutral' : 'info'}>Basic-Fit · {AVAILABILITY_LABELS[bfa].toLowerCase()}</Badge> : null}
                      </span>}>
                        <Stack gap={2}>
                          <Text size="sm" muted>{machine.looks}</Text>
                          <ul className={s.exercises}>
                            {exercises.map((e) => {
                              const status = motionStatus(e.key);
                              const inLib = owned.has(e.key);
                              return (
                                <li key={e.key} className={s.ex}>
                                  <Cluster between gap={2} align="start">
                                    {inLib ? <Text size="sm"><strong>{e.name}</strong> · déjà dans ta bibliothèque</Text> : (
                                      <Checkbox id={`mc-${e.key}`} checked={picked.includes(e.key)} label={e.name}
                                        hint={`${e.muscles} · ${MACHINE_LEVEL_LABELS[e.level]}`}
                                        onChange={(v) => setPicked((p) => (v ? [...p, e.key] : p.filter((x) => x !== e.key)))} />
                                    )}
                                    {status ? <Badge tone={status === 'validated' ? 'success' : 'warning'}>Animation {MOTION_STATUS_LABELS[status].toLowerCase()}</Badge> : null}
                                  </Cluster>
                                  <Disclosure summary="Voir la fiche">
                                    <Stack gap={2}>
                                      {MACHINE_MOTIONS[e.key] ? <MachineMotion spec={MACHINE_MOTIONS[e.key]!} title={e.name}
                                        caption={status === 'validated' ? 'Animation CoachOS' : 'Animation CoachOS · à relire : invisible pour les élèves tant qu’elle n’est pas validée'} /> : null}
                                      <MachineSteps exercise={{ starterKey: e.key, instructions: machineInstructions(e) }} />
                                    </Stack>
                                  </Disclosure>
                                </li>
                              );
                            })}
                          </ul>
                        </Stack>
                      </Disclosure>
                    </li>
                  );
                })}
              </ul>
            </Stack>
          );
        })}
        {picked.length ? (
          <div className={s.bar}>
            <Button variant="primary" icon="plus" loading={busy} onClick={() => void add()}>
              Ajouter {picked.length} exercice{picked.length > 1 ? 's' : ''} à ma bibliothèque
            </Button>
          </div>
        ) : null}
      </Stack>
    </section>
  );
}
