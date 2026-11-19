import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext, isUuid } from '@/server/repo/context';
import { coachInbox, teamThread } from '@/server/repo/messages';
import { toUi } from '@/server/repo/message-format';
import { ChatHeader, MessagesShell, toRows } from '@/components/messages-shell';
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
  const base = `/coach/${wid}/messages`;
  const tz = ctx.workspace.timeZone;
  const rows = toRows(await coachInbox(actor.userId, wid), tz, (e) => (e.kind === 'team' ? `${base}/groupe/${e.id}` : `${base}/${e.id}`), `team:${tid}`);
  const members = t.members ?? [];
  return (
    <MessagesShell rows={rows} active>
      <ChatHeader back={base} name={t.name} team
        subtitle={members.length ? `${members.length} membre${members.length > 1 ? 's' : ''} · ${members.join(', ')}` : 'Aucun membre : ajoute des élèves depuis leur fiche'}
        actions={<Link className="btn small" href={`/coach/${wid}/athletes?team=${tid}&by=none`}>Groupe</Link>} />
      <p className="mx-note">Tous les membres lisent ce fil et voient le prénom de qui écrit.</p>
      <Thread wid={wid} target={{ kind: 'team', teamId: tid }} messages={toUi(t.messages, tz)} showNames
        emptyText="Aucun message dans ce groupe. Écris le premier : tous les membres le verront." />
    </MessagesShell>
  );
}
