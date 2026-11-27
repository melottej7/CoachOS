'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { athleteFileHref, SPORT_LABELS, type Block, type References, type Sport, sportsFor, type Modules, type LastDone, SPORT_TITLE_EXAMPLES } from '@coachos/domain';
import { fromEditor, toEditor, WorkoutBuilder, type AthleteGearInfo, type EBlock, type ExerciseOption, type SavedBlock } from './builder';
import { fieldError, useIntent } from '@/components/use-intent';
import { AnchorButton, Banner, Button, Cluster, Field, Grid, Input, Select, Stack, Text, Textarea } from '@/design';
import { ErrorSummary } from '@/views/error-summary';

export interface WorkoutFormValues {
  title: string;
  localDate: string;
  sport: Sport;
  minutes: string;
  instructions: string;
  intervals?: Block[];
}

interface Props {
  /** IA-1 (D-189) : IA allumée pour l’espace (« Dicter ou écrire avec l’IA »). */
  ai?: boolean;
  wid: string;
  aid: string;
  athleteName: string;
  timeZone: string;
  initial: WorkoutFormValues;
  /** Absent : création. Présent : nouvelle révision sur cette séance. */
  edit?: { sid: string; expectedRevision: number; published: boolean };
  cancelHref: string;
  /** Page où revenir après l’enregistrement (ex. séance de groupe, D-042). */
  returnTo?: string;
  /** Repères de l’athlète (VMA) : allures des zones et kilomètres estimés. */
  refs?: References;
  /** D-074 : blocs réutilisables du coach. */
  savedBlocks?: SavedBlock[];
  /** D-096 : exercices de la bibliothèque (séances de musculation). */
  exercises?: ExerciseOption[];
  /** D-111 : matériel de l’élève, d’après son bilan. */
  gear?: AthleteGearInfo | null;
  /** D-112 : dernière fois de l’élève, par exercice. */
  lastDone?: Record<string, LastDone>;
  /** D-102 : sports proposés selon les modules de l’espace. */
  modules?: Modules;
}

export function WorkoutForm({ wid, aid, athleteName, timeZone, initial, edit, cancelHref, refs, returnTo, savedBlocks, exercises, modules, gear, lastDone, ai }: Props) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [blocks, setBlocks] = useState<EBlock[]>(() => toEditor(initial.intervals ?? [], 'i'));
  const { run, pending, error } = useIntent<{ id: string; workingRevision: number }>();
  const set = (k: keyof WorkoutFormValues) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const minutes = values.minutes.trim() === '' ? null : Number(values.minutes);
    const data = {
      localDate: values.localDate,
      timeZone,
      sortOrder: 0,
      sport: values.sport,
      title: values.title,
      instructions: values.instructions,
      // Avec des blocs, le serveur calcule durée et distance à partir de la structure.
      durationSeconds: blocks.length || minutes === null || Number.isNaN(minutes) ? null : Math.round(minutes * 60),
      intervals: fromEditor(blocks),
    };
    const base = `/api/v1/workspaces/${wid}/athletes/${aid}/workouts`;
    const result = edit
      ? await run('PATCH', `${base}/${edit.sid}`, { expectedRevision: edit.expectedRevision, data })
      : await run('POST', base, { data });
    if (result) { router.push(returnTo ?? `/coach/${wid}/athletes/${aid}/workouts/${result.id}?notice=saved`); if (returnTo) router.refresh(); }
  }

  const err = (path: string) => fieldError(error, path);
  const conflict = error?.kind === 'error' && error.code === 'CONFLICT_OR_QUOTA';

  return (
    <form onSubmit={submit} noValidate aria-describedby="form-context">
      <Stack gap={5}>
        <Text id="form-context" size="sm" muted>
          Pour {athleteName} · fuseau {timeZone.replace(/_/g, ' ')}. {edit?.published ? 'La version publiée reste visible jusqu’à la republication.' : 'Le brouillon reste invisible pour l’élève jusqu’à la publication.'}
        </Text>
        <ErrorSummary error={error} onRetry={() => void submit()} />
        {conflict ? (
          <Banner tone="warning" title="La séance a changé entre-temps">Ta saisie est conservée ici. <a href={cancelHref}>Voir la version actuelle</a> puis reprends ta modification.</Banner>
        ) : null}
        <Field id="title" label="Titre" error={err('data.title')}>
          <Input id="title" name="title" required maxLength={120} autoFocus value={values.title} onChange={set('title')} placeholder={SPORT_TITLE_EXAMPLES[values.sport as Sport] ?? 'Footing facile'}
            invalid={!!err('data.title')} />
        </Field>
        <Grid min={200} gap={4}>
          <Field id="localDate" label="Date" error={err('data.localDate')}>
            <Input id="localDate" type="date" required value={values.localDate} onChange={set('localDate')} invalid={!!err('data.localDate')} />
          </Field>
          <Field id="sport" label="Sport">
            <Select id="sport" value={values.sport} onChange={set('sport')}>
              {sportsFor(modules ?? { endurance: true, strength: true }, values.sport).map((x) => (
                <option key={x} value={x}>{SPORT_LABELS[x]}</option>
              ))}
            </Select>
          </Field>
        </Grid>
        <WorkoutBuilder wid={wid} strengthOn={modules?.strength ?? true} sport={values.sport} value={blocks} onChange={setBlocks} refs={refs} athleteFirst={athleteName.split(' ')[0] ?? athleteName} vmaHref={athleteFileHref(wid, aid, 'refs-title')}
          library={savedBlocks ? { wid, blocks: savedBlocks } : undefined} exercises={exercises} gear={gear} lastDone={lastDone} dictation={ai ? { athleteId: aid } : undefined} />
        {blocks.length ? null : (
          <Field id="duration" label="Durée en minutes" hint="Facultatif" error={err('data.durationSeconds')}>
            <Input id="duration" type="number" inputMode="numeric" min={1} max={1440} value={values.minutes} onChange={set('minutes')} invalid={!!err('data.durationSeconds')} hasHint />
          </Field>
        )}
        <Field id="instructions" label="Consignes générales" hint="Facultatif · ce que l’élève lira en plus des blocs">
          <Textarea id="instructions" maxLength={5000} value={values.instructions} onChange={set('instructions')} hasHint />
        </Field>
        <Cluster gap={2}>
          <Button type="submit" variant="primary" icon="check" loading={pending} data-tour="save-draft">Enregistrer le brouillon</Button>
          <AnchorButton href={cancelHref} variant="ghost">Annuler</AnchorButton>
        </Cluster>
      </Stack>
    </form>
  );
}
