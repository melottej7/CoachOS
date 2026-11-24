import { notFound } from 'next/navigation';
import { isLocalDate, todayIn, weekStart, lastDoneByExercise, loadProgress, sportsFor } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { listAssignedAthletes } from '@/server/repo/coach';
import { listBlockTemplates, readTemplate } from '@/server/repo/library';
import { readAthleteReferences } from '@/server/commands/athlete-references';
import { coachContext, isUuid } from '@/server/repo/context';
import { listExercises } from '@/server/repo/exercises';
import { athleteGear, readAthleteProfile } from '@/server/commands/athlete-profile';
import { strengthHistory } from '@/server/repo/stats';
import { Cluster, Eyebrow, Heading, LinkButton, Stack, Text } from '@/design';
import { WorkoutForm } from '@/views/coach/workout/workout-form';

export const metadata = { title: 'Nouvelle séance' };

/** X20, refonte Chrono (D-147) : créer une prescription, enregistrée en brouillon. Lectures en parallèle. */
export default async function NewWorkout({ params, searchParams }: { params: Promise<{ wid: string; aid: string }>; searchParams: Promise<{ date?: string; template?: string }> }) {
  const { wid, aid } = await params;
  const { date, template } = await searchParams;
  const actor = await requireActor();
  const athlete = (await listAssignedAthletes(actor.userId, wid)).find((a) => a.id === aid);
  if (!athlete) notFound();
  const localDate = date && isLocalDate(date) ? date : todayIn(athlete.timeZone);
  const back = `/coach/${wid}/calendar?athlete=${aid}&week=${weekStart(localDate)}`;
  const [t, ctx, profile, exercises, gear, history, savedBlocks, refs] = await Promise.all([
    // Depuis la bibliothèque : la séance part du modèle choisi, modifiable avant enregistrement.
    template && isUuid(template) ? readTemplate(actor.userId, wid, template) : Promise.resolve(null),
    coachContext(actor.userId, wid),
    athlete.state === 'active' ? readAthleteProfile(actor.userId, wid, aid) : Promise.resolve(null),
    listExercises(actor.userId, wid),
    athleteGear(actor.userId, wid, aid),
    strengthHistory(actor.userId, wid, aid),
    listBlockTemplates(actor.userId, wid),
    readAthleteReferences(actor.userId, wid, aid),
  ]);
  const w = t?.workout;
  // D-121 : le sport proposé est celui de l’élève (bilan), sinon le premier du module actif ; jamais « course » par défaut pour un cycliste.
  const modules = ctx?.modules ?? { endurance: true, strength: true };
  const allowed = sportsFor(modules);
  const defaultSport = profile?.sport && allowed.includes(profile.sport) ? profile.sport : (allowed[0] ?? 'running');
  const first = athlete.displayName.split(' ')[0] ?? athlete.displayName;
  return (
    <Stack gap={6} className="ds-narrow-wide">
      <Cluster><LinkButton href={back} variant="ghost" size="sm" icon="chevronLeft">Semaine de {first}</LinkButton></Cluster>
      <Stack gap={1}>
        <Eyebrow tone="coach">{athlete.displayName}</Eyebrow>
        <Heading level={1} size={1}>Nouvelle séance</Heading>
        {w ? <Text muted>À partir de « {w.title} » (bibliothèque). Ajuste-la pour {first} : la séance de la bibliothèque ne change pas.</Text> : null}
      </Stack>
      <WorkoutForm modules={modules} exercises={exercises.map((x) => ({ id: x.id, name: x.name, equipment: x.equipment }))} gear={gear} lastDone={lastDoneByExercise(loadProgress(history))}
        savedBlocks={savedBlocks} refs={refs} wid={wid} aid={aid} athleteName={athlete.displayName} timeZone={athlete.timeZone} cancelHref={back}
        initial={w
          ? { title: w.title, localDate, sport: w.sport, minutes: w.durationSeconds ? String(Math.round(w.durationSeconds / 60)) : '', instructions: w.instructions ?? '', intervals: w.intervals }
          : { title: '', localDate, sport: defaultSport, minutes: '45', instructions: '' }} />
    </Stack>
  );
}
