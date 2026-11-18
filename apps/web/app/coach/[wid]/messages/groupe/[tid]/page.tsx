import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext, isUuid } from '@/server/repo/context';
import { teamThread } from '@/server/repo/messages';
import { toUi } from '@/server/repo/message-format';
import { Thread } from '@/components/messaging';

export const metadata = { title: 'Groupe' };

/** Fil d’un groupe : le coach écrit à tous les membres ; les membres peuvent répondre. */
export default async function CoachTeamThread({ params }: { params: Promise<{ wid: string; tid: string }> }) {
  const { wid, tid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx || !isUuid(tid)) notFound();
  const t = await teamThread(actor.userId, wid, tid);
  if (!t) notFound();
  return (
    <>
      <Link className="back" href={`/coach/${wid}/messages`}>← Messages</Link>
      <div className="head">
        <div><div className="kicker">Groupe</div><h1>{t.name}</h1>
          <p className="sub">{t.members?.length ? `${t.members.length} membre${t.members.length > 1 ? 's' : ''} : ${t.members.join(', ')}` : 'Aucun membre : ajoute des élèves depuis leur fiche.'}</p></div>
        <Link className="btn" href={`/coach/${wid}/athletes?team=${tid}&by=none`}>Voir le groupe</Link>
      </div>
      <p className="banner">Les membres du groupe voient ce fil et le prénom de ceux qui écrivent. Pour un sujet personnel, utilise la conversation privée.</p>
      <section className="card thread-card">
        <Thread wid={wid} target={{ kind: 'team', teamId: tid }} messages={toUi(t.messages, ctx.workspace.timeZone)} showNames
          emptyText="Aucun message dans ce groupe. Écris le premier : tous les membres le verront." />
      </section>
    </>
  );
}
