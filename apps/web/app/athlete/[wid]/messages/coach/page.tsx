import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { athleteContext, isUuid } from '@/server/repo/context';
import { athleteWorkout } from '@/server/repo/athlete';
import { formatShortDate } from '@coachos/domain';
import { athleteInbox, directThread } from '@/server/repo/messages';
import { toUi } from '@/server/repo/message-format';
import { ChatHeader } from '@/components/messages-shell';
import { Thread } from '@/components/messaging';

export const metadata = { title: 'Ton coach' };

export default async function AthleteCoachThread({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ seance?: string }> }) {
  const { wid } = await params;
  const { seance } = await searchParams;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const t = await directThread(actor.userId, wid, ctx.athlete.id);
  if (!t) notFound();
  const cited = seance && isUuid(seance) ? await athleteWorkout(actor.userId, wid, ctx.athlete.id, seance) : null;
  const about = cited ? { workoutId: cited.workout.id, label: `${cited.workout.title} · ${formatShortDate(cited.workout.localDate).replace(/\.$/, '')}` } : null;
  const hasGroups = (await athleteInbox(actor.userId, wid, ctx.athlete.id)).length > 1;
  return (
    <div className="mx-solo">
      <ChatHeader back={hasGroups ? `/athlete/${wid}/messages` : `/athlete/${wid}/today`} name={ctx.workspace.name} subtitle={`Ton coach · espace ${ctx.workspace.name}`} />
      <Thread wid={wid} target={{ kind: 'direct', athleteId: ctx.athlete.id, conversationId: t.conversationId }} messages={toUi(t.messages, ctx.athlete.timeZone, { workoutHref: (sid) => `/athlete/${wid}/workouts/${sid}`, feedbacks: t.feedbacks })} showNames={false} otherName={ctx.workspace.name} about={about}
        emptyText="Pose une question à ton coach, ou envoie-lui un vocal. Il te répondra ici." />
    </div>
  );
}
