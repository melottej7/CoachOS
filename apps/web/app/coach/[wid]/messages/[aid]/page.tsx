import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext, isUuid } from '@/server/repo/context';
import { coachInbox, directThread } from '@/server/repo/messages';
import { toUi } from '@/server/repo/message-format';
import { ChatHeader, MessagesShell, toRows } from '@/components/messages-shell';
import { Thread } from '@/components/messaging';

export const metadata = { title: 'Conversation' };

/** X26 : conversation privée avec un élève affecté. */
export default async function CoachThread({ params }: { params: Promise<{ wid: string; aid: string }> }) {
  const { wid, aid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx || !isUuid(aid)) notFound();
  const t = await directThread(actor.userId, wid, aid);
  if (!t) notFound();
  const base = `/coach/${wid}/messages`;
  const tz = ctx.workspace.timeZone;
  const rows = toRows(await coachInbox(actor.userId, wid), tz, (e) => (e.kind === 'team' ? `${base}/groupe/${e.id}` : `${base}/${e.id}`), `athlete:${aid}`);
  const first = t.athleteName.split(' ')[0] ?? t.athleteName;
  return (
    <MessagesShell rows={rows} active>
      <ChatHeader back={base} name={t.athleteName} subtitle="Conversation privée"
        actions={<Link className="btn small" href={`/coach/${wid}/athletes/${aid}`}>Fiche</Link>} />
      <Thread wid={wid} target={{ kind: 'direct', athleteId: aid, conversationId: t.conversationId }} messages={toUi(t.messages, tz)} showNames={false} otherName={t.athleteName}
        emptyText={`Démarre la discussion avec ${first} : écris-lui ou envoie un vocal.`} />
    </MessagesShell>
  );
}
