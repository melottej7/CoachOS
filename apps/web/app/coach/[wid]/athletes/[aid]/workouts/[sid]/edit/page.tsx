import { notFound } from 'next/navigation';
import { lastDoneByExercise, loadProgress } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachWorkout } from '@/server/repo/coach';
import { listBlockTemplates } from '@/server/repo/library';
import { readAthleteReferences } from '@/server/commands/athlete-references';
import { listExercises } from '@/server/repo/exercises';
import { coachContext } from '@/server/repo/context';
import { athleteGear } from '@/server/commands/athlete-profile';
import { strengthHistory } from '@/server/repo/stats';
import { Cluster, Eyebrow, Heading, LinkButton, Stack } from '@/design';
import { WorkoutForm } from '@/views/coach/workout/workout-form';

export const metadata = { title: 'Modifier la séance' };

/** X21, refonte Chrono (D-147) : chaque enregistrement crée une révision immuable. Lectures en parallèle. */
export default async function EditWorkout({ params, searchParams }: { params: Promise<{ wid: string; aid: string; sid: string }>; searchParams: Promise<{ from?: string }> }) {
  const { wid, aid, sid } = await params;
  const { from } = await searchParams;
  // Retour sûr : seulement une page coach du même espace (séance de groupe, D-042).
  const returnTo = from && from.startsWith(`/coach/${wid}/`) && !from.includes('//') ? from : undefined;
  const actor = await requireActor();
  const [w, ctx, exercises, gear, history, savedBlocks, refs] = await Promise.all([
    coachWorkout(actor.userId, wid, aid, sid),
    coachContext(actor.userId, wid),
    listExercises(actor.userId, wid),
    athleteGear(actor.userId, wid, aid),
    strengthHistory(actor.userId, wid, aid),
    listBlockTemplates(actor.userId, wid),
    readAthleteReferences(actor.userId, wid, aid),
  ]);
  if (!w) notFound();
  const detail = `/coach/${wid}/athletes/${aid}/workouts/${sid}`;
  const r = w.working;
  return (
    <Stack gap={6} className="ds-narrow-wide">
      <Cluster><LinkButton href={returnTo ?? detail} variant="ghost" size="sm" icon="chevronLeft">{returnTo ? 'Séance de groupe' : 'Retour à la séance'}</LinkButton></Cluster>
      <Stack gap={1}>
        <Eyebrow tone="coach">{w.athlete.displayName} · version {r.number}</Eyebrow>
        <Heading level={1} size={1}>Modifier la séance</Heading>
      </Stack>
      <WorkoutForm modules={ctx?.modules} exercises={exercises.map((x) => ({ id: x.id, name: x.name, equipment: x.equipment }))} gear={gear} lastDone={lastDoneByExercise(loadProgress(history))}
        savedBlocks={savedBlocks} refs={refs} wid={wid} aid={aid} athleteName={w.athlete.displayName} timeZone={r.timeZone} cancelHref={returnTo ?? detail} returnTo={returnTo}
        edit={{ sid, expectedRevision: r.number, published: w.published !== null }}
        initial={{ title: r.title, localDate: r.localDate, sport: r.sport, minutes: r.durationSeconds ? String(Math.round(r.durationSeconds / 60)) : '', instructions: r.instructions, intervals: r.intervals }} />
    </Stack>
  );
}
