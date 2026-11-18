import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { athleteContext } from '@/server/repo/context';
import { athleteInbox, directThread } from '@/server/repo/messages';
import { toUi } from '@/server/repo/message-format';
import { InboxList } from '@/components/inbox-list';
import { Thread } from '@/components/messaging';

export const metadata = { title: 'Échanges' };

/** X44 : l’élève écrit à son coach ; s’il fait partie de groupes, il choisit d’abord le fil. */
export default async function AthleteMessages({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const tz = ctx.athlete.timeZone;
  const entries = await athleteInbox(actor.userId, wid, ctx.athlete.id);
  const base = `/athlete/${wid}/messages`;
  if (entries.length > 1) {
    return (
      <>
        <div className="kicker">Échanges</div>
        <h1>Échanges</h1>
        <section className="card" aria-label="Conversations">
          <InboxList entries={entries} tz={tz} href={(e) => (e.kind === 'team' ? `${base}/groupe/${e.id}` : `${base}/coach`)} empty="" />
        </section>
      </>
    );
  }
  const t = await directThread(actor.userId, wid, ctx.athlete.id);
  if (!t) notFound();
  return (
    <>
      <div className="kicker">Échanges</div>
      <h1>Ton coach</h1>
      <section className="card thread-card">
        <Thread wid={wid} target={{ kind: 'direct', athleteId: ctx.athlete.id, conversationId: t.conversationId }} messages={toUi(t.messages, tz)} showNames={false} otherName={ctx.workspace.name}
          emptyText="Pose une question à ton coach, ou envoie-lui un vocal. Il te répondra ici." />
      </section>
    </>
  );
}
