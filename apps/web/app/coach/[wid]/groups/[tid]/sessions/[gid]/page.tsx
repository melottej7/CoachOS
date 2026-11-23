import { notFound } from 'next/navigation';
import { formatLongDate, SPORT_LABELS } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachContext, isUuid } from '@/server/repo/context';
import { groupSession } from '@/server/repo/group-sessions';
import { listExercises } from '@/server/repo/exercises';
import { Cluster, Eyebrow, Heading, LinkButton, Stack, Text } from '@/design';
import { GroupBaseForm } from '@/views/coach/group/group-base-form';
import { GroupPublish } from '@/views/coach/group/group-publish';

export const metadata = { title: 'Séance de groupe' };

/** CE-G2-02, refonte Chrono (D-148) : adapter par élève puis publier, exceptions montrées avant l’envoi. */
export default async function GroupSessionPage({ params }: { params: Promise<{ wid: string; tid: string; gid: string }> }) {
  const { wid, tid, gid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx || !isUuid(gid) || !isUuid(tid)) notFound();
  const [v, exercises] = await Promise.all([groupSession(actor.userId, wid, gid), listExercises(actor.userId, wid)]);
  if (!v || v.teamId !== tid) notFound();
  const base = `/coach/${wid}`;
  const back = encodeURIComponent(`${base}/groups/${tid}/sessions/${gid}`);
  return (
    <Stack gap={6} className="ds-narrow-wide">
      <Cluster><LinkButton href={`${base}/groups/${tid}/week?semaine=${v.localDate}`} variant="ghost" size="sm" icon="chevronLeft">Semaine du groupe</LinkButton></Cluster>
      <Stack gap={1}>
        <Eyebrow tone="coach">Groupe · {v.teamName} · {SPORT_LABELS[v.sport]}</Eyebrow>
        <Heading level={1} size={1}>{v.title}</Heading>
        <Text muted>{formatLongDate(v.localDate)} · {v.rows.length} élève{v.rows.length > 1 ? 's' : ''}</Text>
      </Stack>
      <GroupBaseForm modules={ctx.modules} exercises={exercises.map((x) => ({ id: x.id, name: x.name }))} wid={wid} gid={gid} revision={v.revision} base={v.base}
        rows={v.rows.map((r) => ({ name: r.athleteName, followsBase: r.followsBase, published: r.publishedRevision !== null }))} />
      <Stack as="section" gap={3} aria-labelledby="gp-title">
        <Stack gap={1}>
          <Heading level={2} size={4} id="gp-title">Séance de chaque élève</Heading>
          <Text size="sm" muted>« Adapter » modifie la séance d’un seul élève : elle ne suivra plus les modifications de la base. Rien n’est visible par les élèves avant la publication.</Text>
        </Stack>
        <GroupPublish wid={wid} gid={gid} without={v.without.map((m) => m.name)} title={v.title} dateLabel={formatLongDate(v.localDate).toLowerCase()} teamName={v.teamName}
          rows={v.rows.map((r) => ({
            athleteId: r.athleteId, name: r.athleteName, workoutId: r.workoutId, revision: r.workingRevision, state: r.state, title: r.title,
            base: r.followsBase, editHref: `${base}/athletes/${r.athleteId}/workouts/${r.workoutId}/edit?from=${back}`,
            viewHref: `${base}/athletes/${r.athleteId}/workouts/${r.workoutId}`,
          }))} />
      </Stack>
    </Stack>
  );
}
