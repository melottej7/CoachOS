import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { readWorkspacePublic } from '@/server/commands/workspace-profile';
import { athleteContext } from '@/server/repo/context';
import { CoachDetails, CoachHeader } from '@/components/coach-card';

export const metadata = { title: 'Ton coach' };

/** « Ton coach » : présentation de l’espace, lue sous RLS par l’athlète de l’espace. */
export default async function AthleteCoach({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  const ws = ctx ? await readWorkspacePublic(actor.userId, wid) : null;
  if (!ctx || !ws) notFound();
  return (
    <>
      <div className="kicker">Ton coach</div>
      <div className="card" style={{ marginTop: 12 }}><div className="card-body stack">
        <CoachHeader data={ws} />
        <CoachDetails data={ws} />
      </div></div>
    </>
  );
}
