import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { coachInbox } from '@/server/repo/messages';
import { MessagesShell, toRows } from '@/components/messages-shell';

export const metadata = { title: 'Messages' };

/** X25 : discussions avec chaque élève et chaque groupe. */
export default async function CoachMessages({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const entries = await coachInbox(actor.userId, wid);
  const base = `/coach/${wid}/messages`;
  const rows = toRows(entries, ctx.workspace.timeZone, (e) => (e.kind === 'team' ? `${base}/groupe/${e.id}` : `${base}/${e.id}`), null);
  return (
    <MessagesShell rows={rows} active={false}>
      <div className="mx-placeholder">
        <span aria-hidden="true">💬</span>
        <h2>Tes discussions</h2>
        <p>Choisis un élève ou un groupe à gauche. Tu peux écrire ou envoyer un vocal.</p>
      </div>
    </MessagesShell>
  );
}
