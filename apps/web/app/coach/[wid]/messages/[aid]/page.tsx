import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext, isUuid } from '@/server/repo/context';
import { directThread } from '@/server/repo/messages';
import { toUi } from '@/server/repo/message-format';
import { Thread } from '@/components/messaging';

export const metadata = { title: 'Conversation' };

/** X26 : fil privé avec un élève affecté. */
export default async function CoachThread({ params }: { params: Promise<{ wid: string; aid: string }> }) {
  const { wid, aid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx || !isUuid(aid)) notFound();
  const t = await directThread(actor.userId, wid, aid);
  if (!t) notFound();
  const first = t.athleteName.split(' ')[0] ?? t.athleteName;
  return (
    <>
      <Link className="back" href={`/coach/${wid}/messages`}>← Messages</Link>
      <div className="head">
        <div><div className="kicker">Conversation privée</div><h1>{t.athleteName}</h1></div>
        <Link className="btn" href={`/coach/${wid}/athletes/${aid}`}>Fiche de {first}</Link>
      </div>
      <section className="card thread-card">
        <Thread wid={wid} target={{ kind: 'direct', athleteId: aid, conversationId: t.conversationId }} messages={toUi(t.messages, ctx.workspace.timeZone)} showNames={false} otherName={t.athleteName}
          emptyText={`Aucun message avec ${first} pour l’instant. Écris-lui ou envoie un vocal.`} />
      </section>
    </>
  );
}
