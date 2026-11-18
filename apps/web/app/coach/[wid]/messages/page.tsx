import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { coachInbox } from '@/server/repo/messages';
import { InboxList } from '@/components/inbox-list';

export const metadata = { title: 'Messages' };

/** X25 : fils privés avec chaque élève, puis fils de groupe. */
export default async function CoachMessages({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const tz = ctx.workspace.timeZone;
  const entries = await coachInbox(actor.userId, wid);
  const athletes = entries.filter((e) => e.kind === 'athlete');
  const teams = entries.filter((e) => e.kind === 'team');
  const base = `/coach/${wid}/messages`;
  return (
    <>
      <div className="head"><div><div className="kicker">Échanges</div><h1>Messages</h1><p className="sub">Écris à un élève ou à tout un groupe, en texte ou en vocal.</p></div></div>
      <section className="card" aria-labelledby="m-athletes">
        <div className="card-head"><h2 id="m-athletes">Élèves</h2></div>
        <InboxList entries={athletes} tz={tz} href={(e) => `${base}/${e.id}`} empty="Aucun élève pour l’instant." />
      </section>
      <section className="card" aria-labelledby="m-teams">
        <div className="card-head"><h2 id="m-teams">Groupes</h2></div>
        <InboxList entries={teams} tz={tz} href={(e) => `${base}/groupe/${e.id}`} empty="Crée un groupe dans Élèves pour écrire à plusieurs élèves à la fois." />
      </section>
    </>
  );
}
