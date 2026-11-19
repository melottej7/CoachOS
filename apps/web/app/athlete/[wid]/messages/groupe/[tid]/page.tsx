import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { athleteContext, isUuid } from '@/server/repo/context';
import { teamThread } from '@/server/repo/messages';
import { toUi } from '@/server/repo/message-format';
import { ChatHeader } from '@/components/messages-shell';
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
    <div className="mx-solo">
      <ChatHeader back={`/athlete/${wid}/messages`} name={t.name} team subtitle="Groupe · lu par ton coach et les membres" />
      <Thread wid={wid} target={{ kind: 'team', teamId: tid }} messages={toUi(t.messages, ctx.athlete.timeZone)} showNames emptyText="Aucun message dans ce groupe pour l’instant." />
    </div>
  );
}
