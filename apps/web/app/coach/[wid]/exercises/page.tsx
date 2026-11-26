import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { listExercises } from '@/server/repo/exercises';
import { Banner, Heading, LinkButton, Stack, Text } from '@/design';
import { ExerciseLibrary } from '@/views/coach/library/exercises';
import { MachineCatalog } from '@/views/coach/library/machine-catalog';

export const metadata = { title: 'Exercices' };

/** D-096, refonte Chrono (D-154) · Exercices de musculation du coach, avec ses consignes et ses vidéos. */
export default async function Exercises({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const items = await listExercises(actor.userId, wid);
  return (
    <Stack gap={6}>
      <Stack gap={1}>
        <Heading level={1} size={1}>Exercices</Heading>
        <Text muted>Tes exercices de musculation, avec tes consignes et tes vidéos. Compose ensuite une séance « Musculation » : tes élèves la suivent à distance, vidéo à l’appui.</Text>
      </Stack>
      {!ctx.modules.strength ? (
        <Banner tone="warning" title="La musculation n’est pas cochée dans tes sports encadrés"
          action={ctx.role === 'owner' ? <LinkButton href={`/coach/${wid}/settings`} size="sm">Ouvrir les paramètres</LinkButton> : undefined}>
          L’onglet Exercices est masqué et le sport « Musculation » n’est pas proposé dans tes séances.
        </Banner>
      ) : null}
      <ExerciseLibrary wid={wid} items={items} />
      <MachineCatalog wid={wid} have={items.flatMap((e) => (e.starterKey ? [e.starterKey] : []))} />
    </Stack>
  );
}
