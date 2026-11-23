import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { readWorkspacePublic } from '@/server/commands/workspace-profile';
import { athleteContext } from '@/server/repo/context';
import { Cluster, EmptyState, LinkButton, Stack } from '@/design';
import { CoachDetails, CoachIdentity } from '@/views/coach-profile';

export const metadata = { title: 'Ton coach' };

/** « Ton coach » : présentation de l’espace, lue sous RLS par l’athlète de l’espace (refonte Chrono, D-139). */
export default async function AthleteCoach({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  const ws = ctx ? await readWorkspacePublic(actor.userId, wid) : null;
  if (!ctx || !ws) notFound();
  const base = `/athlete/${wid}`;
  const write = <LinkButton href={`${base}/messages/coach`} variant="coach" icon="chat">Écrire à mon coach</LinkButton>;
  return (
    <Stack gap={8}>
      <Stack gap={4}>
        <Cluster><LinkButton href={`${base}/setup`} variant="ghost" size="sm" icon="chevronLeft">Profil</LinkButton></Cluster>
        <CoachIdentity data={ws} eyebrow="Ton coach" />
        <Cluster>{write}</Cluster>
      </Stack>
      <CoachDetails data={ws} empty={
        <EmptyState icon="user" title="Pas encore de présentation">Ton coach n’a pas encore écrit sa présentation. Tu peux lui écrire à tout moment.</EmptyState>
      } />
    </Stack>
  );
}
