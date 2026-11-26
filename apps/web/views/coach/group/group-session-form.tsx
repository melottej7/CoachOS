'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { formatLongDate, SPORT_LABELS, type LibraryWorkout, type Sport, sportsFor, type Modules } from '@coachos/domain';
import { fieldError, useIntent } from '@/components/use-intent';
import { AnchorButton, Button, Card, Checkbox, Cluster, Field, Grid, Input, Select, Stack, Text, Textarea } from '@/design';
import { ErrorSummary } from '@/views/error-summary';
import { fromEditor, toEditor, WorkoutBuilder, type EBlock, type ExerciseOption } from '@/views/coach/workout/builder';

// Lot G2 (D-042), refonte Chrono (D-148) : une base commune → un brouillon par élève choisi. Liste exacte des destinataires avant création.

export interface Recipient { id: string; name: string; state: 'invited' | 'active' }

export function GroupSessionForm({ wid, teamId, teamName, members, date, initial, exercises, modules }: {
  modules?: Modules; exercises?: ExerciseOption[];
  wid: string; teamId: string; teamName: string; members: Recipient[]; date: string; initial?: LibraryWorkout;
}) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ id: string }>();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [sport, setSport] = useState<Sport>(initial?.sport ?? 'running');
  const [localDate, setLocalDate] = useState(date);
  const [instructions, setInstructions] = useState(initial?.instructions ?? '');
  const [blocks, setBlocks] = useState<EBlock[]>(() => toEditor(initial?.intervals ?? [], 'i'));
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(members.map((m) => m.id)));
  const toggle = (id: string) => setChosen((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const picked = members.filter((m) => chosen.has(m.id));
  const left = members.filter((m) => !chosen.has(m.id));
  const first = (n: string) => n.split(' ')[0];

  async function save(e: FormEvent) {
    e.preventDefault();
    const workout = { sport, title, instructions: instructions || null, durationSeconds: null, distanceM: null, intervals: fromEditor(blocks) };
    const r = await run('POST', `/api/v1/workspaces/${wid}/group-sessions`, { teamId, localDate, workout, athleteIds: picked.map((m) => m.id) });
    if (r) { router.push(`/coach/${wid}/groups/${teamId}/sessions/${r.id}`); router.refresh(); }
  }

  return (
    <form onSubmit={save} noValidate>
      <Stack gap={5}>
        <ErrorSummary error={error} labels={{ 'workout.title': 'Titre', localDate: 'Date', athleteIds: 'Destinataires' }} ids={{ 'workout.title': 'gs-title', localDate: 'gs-date' }} />
        <Grid min={200} gap={4}>
          <Field id="gs-date" label="Date" hint="À l’heure locale de chaque élève" error={fieldError(error, 'localDate')}>
            <Input id="gs-date" type="date" required value={localDate} onChange={(e) => setLocalDate(e.target.value)} invalid={!!fieldError(error, 'localDate')} hasHint />
          </Field>
          <Field id="gs-sport" label="Sport">
            <Select id="gs-sport" value={sport} onChange={(e) => setSport(e.target.value as Sport)}>{sportsFor(modules ?? { endurance: true, strength: true }, sport).map((x) => <option key={x} value={x}>{SPORT_LABELS[x]}</option>)}</Select>
          </Field>
        </Grid>
        <Field id="gs-title" label="Titre" error={fieldError(error, 'workout.title')}>
          <Input id="gs-title" maxLength={120} required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Piste : 10 × 400 m" invalid={!!fieldError(error, 'workout.title')} />
        </Field>
        <WorkoutBuilder wid={wid} strengthOn={modules?.strength ?? true} sport={sport} value={blocks} onChange={setBlocks} exercises={exercises} />
        <Field id="gs-instructions" label="Consignes" hint="Facultatif · identiques pour tous, modifiables ensuite par élève">
          <Textarea id="gs-instructions" maxLength={5000} value={instructions} onChange={(e) => setInstructions(e.target.value)} hasHint />
        </Field>
        <Card pad={5}>
          <Stack gap={3}>
            <Stack gap={1}>
              <Text strong size="md">Destinataires · {teamName}</Text>
              <Text size="sm" muted>Un brouillon sera créé pour chaque élève coché. Rien n’est envoyé avant la publication.</Text>
            </Stack>
            <Stack gap={0}>
              {members.map((m) => (
                <Checkbox key={m.id} checked={chosen.has(m.id)} onChange={() => toggle(m.id)} label={m.name}
                  hint={m.state === 'invited' ? 'Pas encore connecté·e : verra la séance en rejoignant.' : undefined} />
              ))}
            </Stack>
            {fieldError(error, 'athleteIds') ? <Text size="sm" tone="danger">{fieldError(error, 'athleteIds')}</Text> : null}
            <div aria-live="polite">
              <Text><strong>{picked.length} brouillon{picked.length > 1 ? 's' : ''}</strong> le {localDate ? formatLongDate(localDate).toLowerCase() : '…'} : {picked.map((m) => first(m.name)).join(', ') || 'personne'}.</Text>
              {left.length ? <Text size="sm" muted>Sans cette séance : {left.map((m) => first(m.name)).join(', ')}.</Text> : null}
            </div>
          </Stack>
        </Card>
        <Cluster gap={2}>
          <Button type="submit" variant="primary" loading={pending} disabled={!picked.length || !title.trim()}>Créer {picked.length} brouillon{picked.length > 1 ? 's' : ''}</Button>
          <AnchorButton href={`/coach/${wid}/group-sessions`} variant="ghost">Annuler</AnchorButton>
        </Cluster>
      </Stack>
    </form>
  );
}
