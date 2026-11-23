import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext, isUuid } from '@/server/repo/context';
import { listBlockTemplates, readTemplate } from '@/server/repo/library';
import { listExercises } from '@/server/repo/exercises';
import { Cluster, Heading, LinkButton, Stack, Text } from '@/design';
import { LibraryForm } from '@/views/coach/library/library-form';

export const metadata = { title: 'Séance type' };

/** D-035, refonte Chrono (D-154) : modifier une séance type ; les séances déjà créées à partir d’elle ne changent pas. */
export default async function EditLibraryWorkout({ params }: { params: Promise<{ wid: string; tid: string }> }) {
  const { wid, tid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx || !isUuid(tid)) notFound();
  const [t, exercises, savedBlocks] = await Promise.all([readTemplate(actor.userId, wid, tid), listExercises(actor.userId, wid), listBlockTemplates(actor.userId, wid)]);
  if (!t || !t.mine) notFound();
  return (
    <Stack gap={6} className="ds-narrow-wide">
      <Stack gap={2}>
        <Cluster><LinkButton href={`/coach/${wid}/library`} variant="ghost" size="sm" icon="chevronLeft">Séances types</LinkButton></Cluster>
        <Heading level={1} size={1}>{t.workout.title}</Heading>
        <Text muted>Les séances déjà créées à partir de celle-ci ne changent pas.</Text>
      </Stack>
      <LibraryForm wid={wid} modules={ctx.modules} exercises={exercises.map((x) => ({ id: x.id, name: x.name }))} savedBlocks={savedBlocks}
        initial={{ id: t.id, revision: t.revision, category: t.category, workout: t.workout }} />
    </Stack>
  );
}
