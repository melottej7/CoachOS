import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { athleteContext } from '@/server/repo/context';
import { directThread } from '@/server/repo/messages';
import { toUi } from '@/server/repo/message-format';
import { Thread } from '@/components/messaging';

export const metadata = { title: 'Ton coach' };

export default async function AthleteCoachThread({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const t = await directThread(actor.userId, wid, ctx.athlete.id);
  if (!t) notFound();
  return (
    <>
      <Link className="back" href={`/athlete/${wid}/messages`}>← Échanges</Link>
      <h1>Ton coach</h1>
      <section className="card thread-card">
        <Thread wid={wid} target={{ kind: 'direct', athleteId: ctx.athlete.id, conversationId: t.conversationId }} messages={toUi(t.messages, ctx.athlete.timeZone)} showNames={false} otherName={ctx.workspace.name}
          emptyText="Pose une question à ton coach, ou envoie-lui un vocal. Il te répondra ici." />
      </section>
    </>
  );
}
