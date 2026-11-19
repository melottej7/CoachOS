import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { athleteContext } from '@/server/repo/context';
import { athleteInbox, directThread } from '@/server/repo/messages';
import { toUi } from '@/server/repo/message-format';
import { ChatHeader } from '@/components/messages-shell';
import { Thread } from '@/components/messaging';

export const metadata = { title: 'Ton coach' };

export default async function AthleteCoachThread({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const t = await directThread(actor.userId, wid, ctx.athlete.id);
  if (!t) notFound();
  const hasGroups = (await athleteInbox(actor.userId, wid, ctx.athlete.id)).length > 1;
  return (
    <div className="mx-solo">
      <ChatHeader back={hasGroups ? `/athlete/${wid}/messages` : `/athlete/${wid}/today`} name={ctx.workspace.name} subtitle="Ton coach · conversation privée" />
      <Thread wid={wid} target={{ kind: 'direct', athleteId: ctx.athlete.id, conversationId: t.conversationId }} messages={toUi(t.messages, ctx.athlete.timeZone)} showNames={false} otherName={ctx.workspace.name}
        emptyText="Pose une question à ton coach, ou envoie-lui un vocal. Il te répondra ici." />
    </div>
  );
}
