'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  equivalents, formatDuration2, formatPace, parseDuration, PERFORMANCE_KIND_LABELS, PERFORMANCE_KINDS, SPORT_LABELS, SPORTS, vmaFromTest,
  type Performance, type PerformanceKind, type Sport,
} from '@coachos/domain';
import { useIntent } from '@/components/use-intent';
import { Button, Cluster, Disclosure, Field, Grid, Input, Select, Stack, Text } from '@/design';
import s from './fiche.module.css';

// D-060, refonte Chrono (D-151) : résultats de référence de l’élève. Allure, équivalences (course), VMA d’un test de 6 minutes.

const fmtDay = (d: string) => new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
const fmtDist = (m: number) => (m < 1000 ? `${m} m` : `${String(Math.round(m / 100) / 10).replace('.', ',')} km`);

/** « 10 », « 21,1 », « 21.1 km », « 400 m », « 1500m » → mètres. */
function parseDistance(t: string): number | null {
  const x = t.trim().toLowerCase().replace(',', '.');
  const m = x.match(/^(\d+(?:\.\d+)?)\s*(km|m)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Math.round(m[2] === 'm' ? n : n * 1000);
}

export function PerformancesPanel({ wid, aid, first, sport, items, today, vmaKmh }: {
  wid: string; aid: string; first: string; sport: Sport | null; items: Performance[]; today: string; vmaKmh: number | null;
}) {
  const router = useRouter();
  const add = useIntent<unknown>();
  const del = useIntent<unknown>();
  const useVma = useIntent<unknown>();
  const [kind, setKind] = useState<PerformanceKind>('race');
  const [sp, setSp] = useState<Sport>(sport ?? 'running');
  const [name, setName] = useState('');
  const [dist, setDist] = useState('');
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const distM = parseDistance(dist);
  const timeS = parseDuration(time);
  const ok = distM !== null && distM >= 50 && timeS !== null && Boolean(date) && date <= today;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ok) return;
    const r = await add.run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/performances`, { sport: sp, kind, name: name || null, distanceM: distM, durationS: timeS, doneOn: date });
    if (r) { setName(''); setDist(''); setTime(''); setDate(''); router.refresh(); }
  }

  return (
    <Stack gap={4}>
      <Text size="sm" muted>Courses, tests et séances de référence de {first}. Ils servent à juger un chrono visé (faisabilité) et à connaître son passif.</Text>
      {items.length ? (
        <ul className={s.list}>
          {items.map((p) => {
            const eq = equivalents(p);
            const vma = vmaFromTest(p);
            return (
              <li key={p.id}>
                <Stack gap={1} className={s.grow}>
                  <Text strong>{p.name ?? PERFORMANCE_KIND_LABELS[p.kind]} <Text as="span" size="sm" muted>· {PERFORMANCE_KIND_LABELS[p.kind]} · {SPORT_LABELS[p.sport]} · {fmtDay(p.doneOn)}</Text></Text>
                  <Text size="sm">{fmtDist(p.distanceM)} en <strong>{formatDuration2(p.durationS)}</strong>{p.sport === 'running' || p.sport === 'trail' ? ` · ${formatPace(Math.round(p.durationS / (p.distanceM / 1000)))}` : ''}</Text>
                  {eq.length ? <Text size="sm" muted>Équivalences : {eq.map((x) => `${x.label} ${formatDuration2(x.seconds)}`).join(' · ')}</Text> : null}
                  {vma ? (
                    <Cluster gap={2}>
                      <Text size="sm">VMA estimée : <strong>{String(vma).replace('.', ',')} km/h</strong>{vmaKmh === vma ? ' (VMA actuelle)' : ''}</Text>
                      {vmaKmh !== vma ? <Button size="sm" variant="ghost" loading={useVma.pending}
                        onClick={async () => { if (await useVma.run('PUT', `/api/v1/workspaces/${wid}/athletes/${aid}/references`, { vmaKmh: vma })) router.refresh(); }}>Utiliser comme VMA</Button> : null}
                    </Cluster>
                  ) : null}
                </Stack>
                <Button size="sm" variant="ghost" icon="trash" disabled={del.pending}
                  onClick={async () => { if (window.confirm('Retirer ce résultat ?') && await del.run('DELETE', `/api/v1/workspaces/${wid}/athletes/${aid}/performances/${p.id}`, {})) router.refresh(); }}>Retirer</Button>
              </li>
            );
          })}
        </ul>
      ) : <Text muted>Aucun résultat pour l’instant.</Text>}
      <Disclosure summary="Ajouter un résultat">
        <form onSubmit={submit} noValidate>
          <Stack gap={4}>
            <Grid min={170} gap={4}>
              <Field id="perf-kind" label="Type"><Select id="perf-kind" value={kind} onChange={(e) => setKind(e.target.value as PerformanceKind)}>{PERFORMANCE_KINDS.map((k) => <option key={k} value={k}>{PERFORMANCE_KIND_LABELS[k]}</option>)}</Select></Field>
              <Field id="perf-sport" label="Sport"><Select id="perf-sport" value={sp} onChange={(e) => setSp(e.target.value as Sport)}>{SPORTS.map((x) => <option key={x} value={x}>{SPORT_LABELS[x]}</option>)}</Select></Field>
            </Grid>
            <Field id="perf-name" label="Nom" hint="Facultatif · ex. « 10 km de Bruxelles », « Test 6 minutes »"><Input id="perf-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} hasHint /></Field>
            <Grid min={150} gap={4}>
              <Field id="perf-dist" label="Distance"><Input id="perf-dist" value={dist} placeholder="10 ou 1500 m" invalid={dist !== '' && distM === null} onChange={(e) => setDist(e.target.value)} /></Field>
              <Field id="perf-time" label="Temps"><Input id="perf-time" value={time} placeholder="45:30 ou 1h45" invalid={time !== '' && timeS === null} onChange={(e) => setTime(e.target.value)} /></Field>
              <Field id="perf-date" label="Date"><Input id="perf-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            </Grid>
            {add.error ? <Text size="sm" tone="danger" role="alert">{add.error.kind === 'error' ? (add.error.fields[0]?.rule ?? add.error.message) : 'Connexion perdue. Réessaie.'}</Text> : null}
            <Cluster><Button type="submit" size="sm" variant="primary" loading={add.pending} disabled={!ok}>Ajouter le résultat</Button></Cluster>
          </Stack>
        </form>
      </Disclosure>
    </Stack>
  );
}
