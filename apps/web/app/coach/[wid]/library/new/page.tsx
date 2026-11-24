import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { listBlockTemplates } from '@/server/repo/library';
import { listExercises } from '@/server/repo/exercises';
import { Cluster, Heading, LinkButton, Stack } from '@/design';
import { LibraryForm } from '@/views/coach/library/library-form';

export const metadata = { title: 'Nouvelle séance type' };

/** D-035, refonte Chrono (D-154) : créer une séance type. */
export default async function NewLibraryWorkout({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const [exercises, savedBlocks] = await Promise.all([listExercises(actor.userId, wid), listBlockTemplates(actor.userId, wid)]);
  return (
    <Stack gap={6} className="ds-narrow-wide">
      <Stack gap={2}>
        <Cluster><LinkButton href={`/coach/${wid}/library`} variant="ghost" size="sm" icon="chevronLeft">Séances types</LinkButton></Cluster>
        <Heading level={1} size={1}>Nouvelle séance type</Heading>
      </Stack>
      <LibraryForm wid={wid} modules={ctx.modules} exercises={exercises.map((x) => ({ id: x.id, name: x.name }))} savedBlocks={savedBlocks} />
    </Stack>
  );
}
