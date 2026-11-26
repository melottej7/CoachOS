import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext, isUuid } from '@/server/repo/context';
import { coachInbox, teamThread } from '@/server/repo/messages';
import { toUi } from '@/server/repo/message-format';
import { toRows } from '@/components/messages-shell';
import { LinkButton, Text } from '@/design';
import { ChatHeader } from '@/views/messaging/chat-header';
import { MessagesLayout } from '@/views/messaging/messages-layout';
import { Thread } from '@/views/messaging/thread';

export const metadata = { title: 'Groupe' };

/** Fil d’un groupe (refonte Chrono, D-145) : le coach écrit à tous les membres ; les membres peuvent répondre. */
export default async function CoachTeamThread({ params }: { params: Promise<{ wid: string; tid: string }> }) {
  const { wid, tid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx || !isUuid(tid)) notFound();
  const [t, inbox] = await Promise.all([teamThread(actor.userId, wid, tid), coachInbox(actor.userId, wid)]);
  if (!t) notFound();
  const base = `/coach/${wid}/messages`;
  const tz = ctx.workspace.timeZone;
  const rows = toRows(inbox, tz, (e) => (e.kind === 'team' ? `${base}/groupe/${e.id}` : `${base}/${e.id}`), `team:${tid}`);
  const members = t.members ?? [];
  return (
    <MessagesLayout rows={rows} active>
      <ChatHeader back={base} backLabel="Toutes les discussions" name={t.name} team
        href={`/coach/${wid}/athletes?team=${tid}&by=none`} hrefLabel={`Voir les élèves du groupe ${t.name}`}
        subtitle={members.length ? `${members.length} membre${members.length > 1 ? 's' : ''} · ${members.join(', ')}` : 'Aucun membre : ajoute des élèves depuis leur fiche'}
        actions={<LinkButton size="sm" icon="users" title="Voir le groupe" href={`/coach/${wid}/athletes?team=${tid}&by=none`}><span className="ds-hide-narrow">Groupe</span></LinkButton>} />
      <Text size="sm" muted>Tous les membres lisent ce fil et voient le prénom de qui écrit.</Text>
      <Thread wid={wid} target={{ kind: 'team', teamId: tid }} messages={toUi(t.messages, tz)} showNames
        emptyText="Aucun message dans ce groupe. Écris le premier : tous les membres le verront." />
    </MessagesLayout>
  );
}
