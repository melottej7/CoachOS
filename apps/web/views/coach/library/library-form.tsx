'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { LIBRARY_CATEGORIES, LIBRARY_CATEGORY_LABELS, SPORT_LABELS, SPORT_TITLE_EXAMPLES, sportsFor, type LibraryCategory, type LibraryWorkout, type Modules, type Sport } from '@coachos/domain';
import { fieldError, useIntent } from '@/components/use-intent';
import { AnchorButton, Button, Cluster, Field, Grid, Input, Select, Stack, Textarea } from '@/design';
import { ErrorSummary } from '@/views/error-summary';
import { fromEditor, toEditor, WorkoutBuilder, type EBlock, type ExerciseOption, type SavedBlock } from '@/views/coach/workout/builder';

/** Créer ou modifier une séance type (D-035), refonte Chrono (D-154) : titre, sport, catégorie, déroulé par blocs, consignes. */
export function LibraryForm({ wid, initial, savedBlocks, exercises, modules }: {
  wid: string;
  modules?: Modules;
  savedBlocks?: SavedBlock[];
  exercises?: ExerciseOption[];
  initial?: { id: string; revision: number; category: LibraryCategory; workout: LibraryWorkout };
}) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ id: string; revision: number }>();
  const [title, setTitle] = useState(initial?.workout.title ?? '');
  const [sport, setSport] = useState<Sport>(initial?.workout.sport ?? 'running');
  const [category, setCategory] = useState<LibraryCategory>(initial?.category ?? 'other');
  const [instructions, setInstructions] = useState(initial?.workout.instructions ?? '');
  const [blocks, setBlocks] = useState<EBlock[]>(() => toEditor(initial?.workout.intervals ?? [], 'i'));

  async function save(e?: FormEvent) {
    e?.preventDefault();
    const workout = { sport, title, instructions: instructions || null, durationSeconds: null, distanceM: null, intervals: fromEditor(blocks) };
    const r = initial
      ? await run('PATCH', `/api/v1/workspaces/${wid}/templates/${initial.id}`, { expectedRevision: initial.revision, category, workout })
      : await run('POST', `/api/v1/workspaces/${wid}/templates`, { category, workout });
    if (r) { router.push(`/coach/${wid}/library`); router.refresh(); }
  }

  const titleError = fieldError(error, 'workout.title');
  return (
    <form onSubmit={save} noValidate>
      <Stack gap={5}>
        <ErrorSummary error={error} onRetry={() => void save()} labels={{ 'workout.title': 'Titre' }} ids={{ workout: 'lib-title', 'workout.title': 'lib-title' }} />
        <Field id="lib-title" label="Titre" error={titleError}>
          <Input id="lib-title" required maxLength={120} autoFocus={!initial} value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder={SPORT_TITLE_EXAMPLES[sport] ?? 'Fractionné 10 × 400 m'} invalid={!!titleError} />
        </Field>
        <Grid min={200} gap={4}>
          <Field id="lib-sport" label="Sport">
            <Select id="lib-sport" value={sport} onChange={(e) => setSport(e.target.value as Sport)}>
              {sportsFor(modules ?? { endurance: true, strength: true }, sport).map((x) => <option key={x} value={x}>{SPORT_LABELS[x]}</option>)}
            </Select>
          </Field>
          <Field id="lib-category" label="Catégorie">
            <Select id="lib-category" value={category} onChange={(e) => setCategory(e.target.value as LibraryCategory)}>
              {LIBRARY_CATEGORIES.map((c) => <option key={c} value={c}>{LIBRARY_CATEGORY_LABELS[c]}</option>)}
            </Select>
          </Field>
        </Grid>
        <WorkoutBuilder strengthOn={modules?.strength ?? true} sport={sport} value={blocks} onChange={setBlocks}
          library={savedBlocks ? { wid, blocks: savedBlocks } : undefined} exercises={exercises} />
        <Field id="lib-instructions" label="Consignes" hint="Facultatif · reprises dans chaque séance créée à partir de celle-ci">
          <Textarea id="lib-instructions" maxLength={5000} value={instructions} onChange={(e) => setInstructions(e.target.value)} hasHint />
        </Field>
        <Cluster gap={2}>
          <Button type="submit" variant="primary" icon="check" loading={pending}>{initial ? 'Enregistrer les modifications' : 'Ajouter à la bibliothèque'}</Button>
          <AnchorButton href={`/coach/${wid}/library`} variant="ghost">Annuler</AnchorButton>
        </Cluster>
      </Stack>
    </form>
  );
}
