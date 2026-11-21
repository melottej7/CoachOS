import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatLongDate, SPORT_LABELS } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachContext, isUuid } from '@/server/repo/context';
import { groupSession } from '@/server/repo/group-sessions';
import { GroupPublish } from '@/components/group-publish';
import { GroupBaseForm } from '@/components/group-base-form';
import { listExercises } from '@/server/repo/exercises';

export const metadata = { title: 'Séance de groupe' };

/** CE-G2-02 : adapter par élève puis publier, exceptions montrées avant l’envoi. */
export default async function GroupSessionPage({ params }: { params: Promise<{ wid: string; tid: string; gid: string }> }) {
  const { wid, tid, gid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx || !isUuid(gid) || !isUuid(tid)) notFound();
  const v = await groupSession(actor.userId, wid, gid);
  if (!v || v.teamId !== tid) notFound();
  const base = `/coach/${wid}`;
  const back = encodeURIComponent(`${base}/groups/${tid}/sessions/${gid}`);
  return (
    <>
      <Link className="back" href={`${base}/group-sessions`}>← Séances de groupe</Link>
      <div className="kicker">Groupe · {v.teamName} · {SPORT_LABELS[v.sport]}</div>
      <h1>{v.title}</h1>
      <p className="sub">{formatLongDate(v.localDate)} · {v.rows.length} élève{v.rows.length > 1 ? 's' : ''}</p>
      <GroupBaseForm modules={(await coachContext(actor.userId, wid))?.modules} exercises={(await listExercises(actor.userId, wid)).map((x) => ({ id: x.id, name: x.name }))} wid={wid} gid={gid} revision={v.revision} base={v.base}
        rows={v.rows.map((r) => ({ name: r.athleteName, followsBase: r.followsBase, published: r.publishedRevision !== null }))} />
      <section className="card" aria-labelledby="gp-title">
        <div className="card-head"><h2 id="gp-title">Séance de chaque élève</h2></div>
        <div className="card-body">
          <p className="muted">« Adapter » modifie la séance d’un seul élève : elle ne suivra plus les modifications de la base. Rien n’est visible par les élèves avant la publication.</p>
          <GroupPublish wid={wid} gid={gid} without={v.without.map((m) => m.name)} title={v.title} dateLabel={formatLongDate(v.localDate).toLowerCase()} teamName={v.teamName}
            rows={v.rows.map((r) => ({
              athleteId: r.athleteId, name: r.athleteName, workoutId: r.workoutId, revision: r.workingRevision, state: r.state, title: r.title,
              base: r.followsBase, editHref: `${base}/athletes/${r.athleteId}/workouts/${r.workoutId}/edit?from=${back}`,
              viewHref: `${base}/athletes/${r.athleteId}/workouts/${r.workoutId}`,
            }))} />
        </div>
      </section>
    </>
  );
}
