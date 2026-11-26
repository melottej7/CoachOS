import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { athleteContext, isUuid } from '@/server/repo/context';
import { athleteWorkout } from '@/server/repo/athlete';
import { formatShortDate } from '@coachos/domain';
import { athleteInbox, directThread } from '@/server/repo/messages';
import { toUi } from '@/server/repo/message-format';
import { ChatHeader } from '@/views/messaging/chat-header';
import { Thread } from '@/views/messaging/thread';

export const metadata = { title: 'Ton coach' };

export default async function AthleteCoachThread({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ seance?: string }> }) {
  const { wid } = await params;
  const { seance } = await searchParams;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  // Trois lectures indépendantes, en parallèle.
  const [t, cited, inbox] = await Promise.all([
    directThread(actor.userId, wid, ctx.athlete.id),
    seance && isUuid(seance) ? athleteWorkout(actor.userId, wid, ctx.athlete.id, seance) : Promise.resolve(null),
    athleteInbox(actor.userId, wid, ctx.athlete.id),
  ]);
  if (!t) notFound();
  const about = cited ? { workoutId: cited.workout.id, label: `${cited.workout.title} · ${formatShortDate(cited.workout.localDate).replace(/\.$/, '')}` } : null;
  const hasGroups = inbox.length > 1;
  return (
    <>
      <ChatHeader back={hasGroups ? `/athlete/${wid}/messages` : `/athlete/${wid}/today`} backLabel={hasGroups ? 'Toutes les discussions' : 'Aujourd’hui'} name={ctx.workspace.name} subtitle="Ton coach · réponses ici" href={`/athlete/${wid}/coach`} hrefLabel="Voir la présentation de ton coach" />
      <Thread wid={wid} target={{ kind: 'direct', athleteId: ctx.athlete.id, conversationId: t.conversationId }} messages={toUi(t.messages, ctx.athlete.timeZone, { workoutHref: (sid) => `/athlete/${wid}/workouts/${sid}`, feedbacks: t.feedbacks })} showNames={false} otherName={ctx.workspace.name} about={about}
        emptyText="Pose une question à ton coach, ou envoie-lui un vocal. Il te répondra ici." />
    </>
  );
}
