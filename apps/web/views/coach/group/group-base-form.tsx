'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { SPORT_LABELS, type LibraryWorkout, type Sport, sportsFor, type Modules } from '@coachos/domain';
import { fieldError, useIntent } from '@/components/use-intent';
import { Banner, Button, Cluster, Disclosure, Field, Grid, Input, Select, Stack, Text, Textarea } from '@/design';
import { ErrorSummary } from '@/views/error-summary';
import { fromEditor, toEditor, WorkoutBuilder, type EBlock, type ExerciseOption } from '@/views/coach/workout/builder';

// D-046, refonte Chrono (D-148) : modifier la base commune d’une séance de groupe. Répercutée sur les séances qui la
// suivent encore ; les séances adaptées ne changent pas ; rien n’est publié (la publication reste un geste explicite).

export interface BaseRow { name: string; followsBase: boolean; published: boolean }

export function GroupBaseForm({ wid, gid, revision, base, rows, exercises, modules }: { wid: string; gid: string; revision: number; base: LibraryWorkout; rows: BaseRow[]; exercises?: ExerciseOption[]; modules?: Modules }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ revision: number; updated: unknown[]; kept: { name: string }[] }>();
  const [title, setTitle] = useState(base.title);
  const [sport, setSport] = useState<Sport>(base.sport);
  const [instructions, setInstructions] = useState(base.instructions ?? '');
  const [blocks, setBlocks] = useState<EBlock[]>(() => toEditor(base.intervals ?? [], 'b'));
  const [done, setDone] = useState<string | null>(null);
  const first = (n: string) => n.split(' ')[0];
  const follow = rows.filter((r) => r.followsBase);
  const kept = rows.filter((r) => !r.followsBase);
  const republish = follow.filter((r) => r.published);

  async function save(e: FormEvent) {
    e.preventDefault();
    const workout = { sport, title, instructions: instructions || null, durationSeconds: null, distanceM: null, intervals: fromEditor(blocks) };
    const r = await run('PATCH', `/api/v1/workspaces/${wid}/group-sessions/${gid}`, { expectedRevision: revision, workout });
    if (r && r.revision === revision) { setDone('Aucun changement à enregistrer.'); return; }
    if (r) {
      setDone(`Base modifiée et répercutée sur ${r.updated.length} séance${r.updated.length > 1 ? 's' : ''}.${republish.length ? ' Publie-la ci-dessous pour que les élèves la voient.' : ''}`);
      router.refresh();
    }
  }

  const conflict = error?.kind === 'error' && error.code === 'CONFLICT_OR_QUOTA';
  return (
    <Disclosure summary={`Modifier la base commune · ${follow.length} séance${follow.length > 1 ? 's' : ''} la sui${follow.length > 1 ? 'vent' : 't'}`}>
      <form onSubmit={save} noValidate>
        <Stack gap={5}>
          {done ? <Banner tone="success">{done}</Banner> : null}
          <ErrorSummary error={conflict ? null : error} labels={{ 'workout.title': 'Titre' }} ids={{ 'workout.title': 'gb-title' }} />
          {conflict ? <Banner tone="warning" title="La base a changé entre-temps">Ta saisie est conservée ; <a href="">recharge la page</a> pour repartir de la version actuelle.</Banner> : null}
          <Grid min={200} gap={4}>
            <Field id="gb-title" label="Titre" error={fieldError(error, 'workout.title')}>
              <Input id="gb-title" maxLength={120} required value={title} onChange={(e) => setTitle(e.target.value)} invalid={!!fieldError(error, 'workout.title')} />
            </Field>
            <Field id="gb-sport" label="Sport">
              <Select id="gb-sport" value={sport} onChange={(e) => setSport(e.target.value as Sport)}>{sportsFor(modules ?? { endurance: true, strength: true }, sport).map((x) => <option key={x} value={x}>{SPORT_LABELS[x]}</option>)}</Select>
            </Field>
          </Grid>
          <WorkoutBuilder wid={wid} strengthOn={modules?.strength ?? true} sport={sport} value={blocks} onChange={setBlocks} exercises={exercises} />
          <Field id="gb-instructions" label="Consignes" hint="Facultatif">
            <Textarea id="gb-instructions" maxLength={5000} value={instructions} onChange={(e) => setInstructions(e.target.value)} hasHint />
          </Field>
          <Stack gap={1} aria-live="polite">
            <Text><strong>Mise à jour pour {follow.length} élève{follow.length > 1 ? 's' : ''}</strong>{follow.length ? ` : ${follow.map((r) => first(r.name)).join(', ')}` : ''}.</Text>
            {republish.length ? <Text size="sm">Déjà publiée pour {republish.map((r) => first(r.name)).join(', ')} : l’élève garde l’ancienne version jusqu’à ce que tu republies.</Text> : null}
            {kept.length ? <Text size="sm" muted>Inchangées (adaptées) : {kept.map((r) => first(r.name)).join(', ')}.</Text> : null}
          </Stack>
          <Cluster>
            <Button type="submit" variant="primary" loading={pending} disabled={!title.trim()}>Enregistrer la base{follow.length ? ` pour ${follow.length} élève${follow.length > 1 ? 's' : ''}` : ''}</Button>
          </Cluster>
        </Stack>
      </form>
    </Disclosure>
  );
}
