import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { coachInbox } from '@/server/repo/messages';
import { toRows } from '@/components/messages-shell';
import { EmptyState } from '@/design';
import { MessagesLayout } from '@/views/messaging/messages-layout';

export const metadata = { title: 'Messages' };

/** X25, refonte Chrono (D-145) : discussions avec chaque élève et chaque groupe. */
export default async function CoachMessages({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const entries = await coachInbox(actor.userId, wid);
  const base = `/coach/${wid}/messages`;
  const rows = toRows(entries, ctx.workspace.timeZone, (e) => (e.kind === 'team' ? `${base}/groupe/${e.id}` : `${base}/${e.id}`), null);
  return (
    <MessagesLayout rows={rows} active={false}>
      <EmptyState icon="chat" title="Tes discussions">Choisis un élève ou un groupe. Tu peux écrire ou envoyer un vocal.</EmptyState>
    </MessagesLayout>
  );
}
