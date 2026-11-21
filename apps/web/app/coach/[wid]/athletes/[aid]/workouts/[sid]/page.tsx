import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDistance, formatDuration, formatLongDate, weekStart, RESULT_STATE_LABELS, SPORT_LABELS, type References } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachWorkout, type RevisionView } from '@/server/repo/coach';
import { PublishButton } from '@/components/publish-button';
import { Notice, Pill, StatusBadge } from '@/components/ui';
import { StructureView } from '@/components/structure-view';
import { SaveToLibrary } from '@/components/save-to-library';
import { FitDownload } from '@/components/fit-download';
import { readAthleteReferences } from '@/server/commands/athlete-references';
import { exerciseMap } from '@/server/repo/exercises';
import type { ExerciseInfo } from '@/components/structure-view';


export const metadata = { title: 'Séance' };

const NOTICES: Record<string, string> = {
  saved: 'Brouillon enregistré. Il reste invisible pour l’athlète tant qu’il n’est pas publié.',
  published: 'Séance publiée. L’athlète la voit maintenant dans Aujourd’hui et Programme.',
};

function Prescription({ r, refs, wid, exercises }: { r: RevisionView; refs: References; wid: string; exercises: Record<string, ExerciseInfo> }) {
  return (
    <div className="stack">
      <dl className="details">
        <div><dt>Date</dt><dd>{formatLongDate(r.localDate)}</dd></div>
        <div><dt>Sport</dt><dd>{SPORT_LABELS[r.sport]}</dd></div>
        {r.intervals.length ? null : <div><dt>Durée</dt><dd>{formatDuration(r.durationSeconds) ?? 'Non précisée'}</dd></div>}
        {r.distanceM && !r.intervals.length ? <div><dt>Distance</dt><dd>{formatDistance(r.distanceM)}</dd></div> : null}
      </dl>
      <StructureView blocks={r.intervals} sport={r.sport} refs={refs} wid={wid} exercises={exercises} />
      {r.instructions || !r.intervals.length ? (
        <div>
          <h3>Consignes</h3>
          <p className="prose">{r.instructions || 'Aucune consigne supplémentaire.'}</p>
        </div>
      ) : null}
    </div>
  );
}

/** X21 + confirmation X22 pour une séance : version de travail, version publiée, publication explicite. */
export default async function CoachWorkout({ params, searchParams }: { params: Promise<{ wid: string; aid: string; sid: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { wid, aid, sid } = await params;
  const refs = await readAthleteReferences((await requireActor()).userId, wid, aid);
  const { notice } = await searchParams;
  const actor = await requireActor();
  const w = await coachWorkout(actor.userId, wid, aid, sid);
  if (!w) notFound();
  const exercises = await exerciseMap(actor.userId, wid, w.working.intervals, w.published?.intervals ?? []);
  const first = w.athlete.displayName.split(' ')[0];
  const base = `/coach/${wid}`;
  const back = `${base}/calendar?athlete=${aid}&week=${weekStart(w.working.localDate)}`;

  return (
    <>
      <Link className="back" href={back}>← Planning de {w.athlete.displayName}</Link>
      <Notice message={notice ? NOTICES[notice] ?? null : null} />
      <div className="head">
        <div>
          <div className="kicker">{w.athlete.displayName} · {formatLongDate(w.working.localDate)}</div>
          <h1>{w.working.title}</h1>
          <p className="sub"><StatusBadge status={w.status} /> {w.status === 'draft' ? `Invisible pour ${first}.` : w.status === 'published' ? `${first} lit cette version.` : `${first} lit encore la version ${w.published?.number}.`}</p>
        </div>
        <div className="actions">
          <Link className="btn" href={`${base}/messages/${aid}?seance=${sid}`}>💬 En parler à {w.athlete.displayName.split(' ')[0]}</Link>
          <SaveToLibrary wid={wid} aid={aid} sid={sid} />
          {w.working.canceled ? null : <FitDownload wid={wid} aid={aid} sid={sid} label="Fichier FIT" compact />}
          <Link className="btn" href={`${base}/athletes/${aid}/workouts/${sid}/edit`}>Modifier</Link>
        </div>
      </div>

      <div className={w.status === 'changed' ? 'compare' : undefined}>
        <section className="card" aria-labelledby="working-title">
          <div className="card-head"><h2 id="working-title">{w.status === 'changed' ? `Brouillon · version ${w.working.number}` : `Version ${w.working.number}`}</h2></div>
          <div className="card-body"><Prescription r={w.working} refs={refs} wid={wid} exercises={exercises} /></div>
        </section>
        {w.status === 'changed' && w.published ? (
          <section className="card" aria-labelledby="published-title" style={{ marginTop: 0 }}>
            <div className="card-head"><h2 id="published-title">Publiée · version {w.published.number}</h2><Pill tone="neutral">Lue par {first}</Pill></div>
            <div className="card-body"><Prescription r={w.published} refs={refs} wid={wid} exercises={exercises} /></div>
          </section>
        ) : null}
      </div>

      {w.status !== 'published' ? (
        <section className="card" aria-labelledby="publish-title">
          <div className="card-head"><h2 id="publish-title">{w.status === 'draft' ? 'Publier' : 'Publier la modification'}</h2></div>
          <div className="card-body stack">
            <p>
              {first} verra « {w.working.title} » le <strong>{formatLongDate(w.working.localDate).toLowerCase()}</strong> (fuseau {w.working.timeZone}).
              {w.status === 'changed' ? ' La version actuellement lue sera remplacée.' : ''}
            </p>
            <PublishButton wid={wid} aid={aid} sid={sid} revision={w.working.number} label={w.status === 'draft' ? `Publier pour ${first}` : 'Publier la version ' + w.working.number} />
          </div>
        </section>
      ) : null}

      <section className="card" aria-labelledby="fb-title">
        <div className="card-head"><h2 id="fb-title">Retour de {first}</h2></div>
        {w.feedback ? (
          <div className="row">
            <div className="row-text">
              <h3>{RESULT_STATE_LABELS[w.feedback.state]}{w.feedback.rpe !== null ? ` · Effort ${w.feedback.rpe}/10` : ''}</h3>
              <p>{w.feedback.reviewedAt ? 'Traité' : 'À traiter'} · sur la version {w.feedback.observedRevision}</p>
            </div>
            {w.reviewItemId ? <Link className="btn" href={`${base}/review/${w.reviewItemId}?from=calendar`}>Ouvrir le retour</Link> : null}
          </div>
        ) : (
          <p className="empty">Pas encore de retour. L’absence de retour ne signifie pas que la séance a été manquée.</p>
        )}
      </section>
    </>
  );
}
