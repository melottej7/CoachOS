import { notFound, redirect } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { athleteContext } from '@/server/repo/context';
import { athleteInbox } from '@/server/repo/messages';
import { toRows } from '@/components/messages-shell';
import { ConversationList } from '@/components/conversation-list';

export const metadata = { title: 'Échanges' };

/** X44 : discussions de l’élève (son coach, ses groupes). Sans groupe : directement la conversation avec le coach. */
export default async function AthleteMessages({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const base = `/athlete/${wid}/messages`;
  const entries = await athleteInbox(actor.userId, wid, ctx.athlete.id);
  if (entries.length <= 1) redirect(`${base}/coach`);
  const rows = toRows(entries.map((e) => (e.kind === 'athlete' ? { ...e, name: ctx.workspace.name } : e)), ctx.athlete.timeZone,
    (e) => (e.kind === 'team' ? `${base}/groupe/${e.id}` : `${base}/coach`), null);
  return (
    <div className="mx-mobile">
      <h1 className="mx-title">Échanges</h1>
      <ConversationList rows={rows} searchable={false} />
    </div>
  );
}
