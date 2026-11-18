import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { athleteContext, isUuid } from '@/server/repo/context';
import { teamThread } from '@/server/repo/messages';
import { toUi } from '@/server/repo/message-format';
import { Thread } from '@/components/messaging';

export const metadata = { title: 'Groupe' };

export default async function AthleteTeamThread({ params }: { params: Promise<{ wid: string; tid: string }> }) {
  const { wid, tid } = await params;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx || !isUuid(tid)) notFound();
  const t = await teamThread(actor.userId, wid, tid);
  if (!t) notFound();
  return (
    <>
      <Link className="back" href={`/athlete/${wid}/messages`}>← Échanges</Link>
      <div className="kicker">Groupe</div>
      <h1>{t.name}</h1>
      <p className="muted">Tous les membres du groupe et ton coach lisent ce fil.</p>
      <section className="card thread-card">
        <Thread wid={wid} target={{ kind: 'team', teamId: tid }} messages={toUi(t.messages, ctx.athlete.timeZone)} showNames emptyText="Aucun message dans ce groupe pour l’instant." />
      </section>
    </>
  );
}
