import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext, isUuid } from '@/server/repo/context';
import { coachInbox, directThread } from '@/server/repo/messages';
import { coachWorkout } from '@/server/repo/coach';
import { toUi } from '@/server/repo/message-format';
import { ChatHeader, MessagesShell, toRows } from '@/components/messages-shell';
import { Thread } from '@/components/messaging';
import { AppointmentForm } from '@/components/portfolio-forms';
import { formatShortDate, todayIn } from '@coachos/domain';

export const metadata = { title: 'Conversation' };

/** X26 : conversation privée avec un élève affecté. */
export default async function CoachThread({ params, searchParams }: { params: Promise<{ wid: string; aid: string }>; searchParams: Promise<{ seance?: string }> }) {
  const { wid, aid } = await params;
  const { seance } = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx || !isUuid(aid)) notFound();
  const t = await directThread(actor.userId, wid, aid);
  if (!t) notFound();
  const base = `/coach/${wid}/messages`;
  const tz = ctx.workspace.timeZone;
  const rows = toRows(await coachInbox(actor.userId, wid), tz, (e) => (e.kind === 'team' ? `${base}/groupe/${e.id}` : `${base}/${e.id}`), `athlete:${aid}`);
  const first = t.athleteName.split(' ')[0] ?? t.athleteName;
  const cited = seance && isUuid(seance) ? await coachWorkout(actor.userId, wid, aid, seance) : null;
  const about = cited ? { workoutId: cited.id, label: `${cited.working.title} · ${formatShortDate(cited.working.localDate).replace(/\.$/, '')}` } : null;
  const href = (sid: string) => `/coach/${wid}/athletes/${aid}/workouts/${sid}`;
  return (
    <MessagesShell rows={rows} active>
      <ChatHeader back={base} name={t.athleteName} subtitle={`Conversation privée · espace ${ctx.workspace.name}`}
        actions={<>
          <AppointmentForm wid={wid} athletes={[{ id: aid, name: t.athleteName, timeZone: t.athleteTimeZone }]} athleteId={aid} timeZone={tz} today={todayIn(t.athleteTimeZone)} label="📅 Planifier" />
          <Link className="btn small" href={`/coach/${wid}/athletes/${aid}`}>Fiche</Link>
        </>} />
      <Thread wid={wid} target={{ kind: 'direct', athleteId: aid, conversationId: t.conversationId }} messages={toUi(t.messages, tz, { workoutHref: href, feedbacks: t.feedbacks })} showNames={false} otherName={t.athleteName} about={about}
        emptyText={`Démarre la discussion avec ${first} : écris-lui ou envoie un vocal.`} />
    </MessagesShell>
  );
}
