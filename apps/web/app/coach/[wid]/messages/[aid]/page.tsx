import { notFound } from 'next/navigation';
import { formatShortDate, todayIn } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachContext, isUuid } from '@/server/repo/context';
import { coachInbox, directThread } from '@/server/repo/messages';
import { coachWorkout } from '@/server/repo/coach';
import { toUi } from '@/server/repo/message-format';
import { toRows } from '@/components/messages-shell';
import { CoachThreadHeader } from '@/views/coach/thread-header';
import { MessagesLayout } from '@/views/messaging/messages-layout';
import { Thread } from '@/views/messaging/thread';

export const metadata = { title: 'Conversation' };

/** X26, refonte Chrono (D-145) : conversation privée avec un élève affecté ; lectures en parallèle. */
export default async function CoachThread({ params, searchParams }: { params: Promise<{ wid: string; aid: string }>; searchParams: Promise<{ seance?: string }> }) {
  const { wid, aid } = await params;
  const { seance } = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx || !isUuid(aid)) notFound();
  const [t, inbox, cited] = await Promise.all([
    directThread(actor.userId, wid, aid),
    coachInbox(actor.userId, wid),
    seance && isUuid(seance) ? coachWorkout(actor.userId, wid, aid, seance) : Promise.resolve(null),
  ]);
  if (!t) notFound();
  const base = `/coach/${wid}/messages`;
  const tz = ctx.workspace.timeZone;
  const rows = toRows(inbox, tz, (e) => (e.kind === 'team' ? `${base}/groupe/${e.id}` : `${base}/${e.id}`), `athlete:${aid}`);
  const first = t.athleteName.split(' ')[0] ?? t.athleteName;
  const about = cited ? { workoutId: cited.id, label: `${cited.working.title} · ${formatShortDate(cited.working.localDate).replace(/\.$/, '')}` } : null;
  const href = (sid: string) => `/coach/${wid}/athletes/${aid}/workouts/${sid}`;
  return (
    <MessagesLayout rows={rows} active>
      <CoachThreadHeader wid={wid} back={base} athlete={{ id: aid, name: t.athleteName, timeZone: t.athleteTimeZone }}
        subtitle={`Conversation privée · ${ctx.workspace.name}`} timeZone={tz} today={todayIn(t.athleteTimeZone)} />
      <Thread wid={wid} target={{ kind: 'direct', athleteId: aid, conversationId: t.conversationId }} messages={toUi(t.messages, tz, { workoutHref: href, feedbacks: t.feedbacks })} showNames={false} otherName={t.athleteName} about={about}
        emptyText={`Démarre la discussion avec ${first} : écris-lui ou envoie un vocal.`} />
    </MessagesLayout>
  );
}
